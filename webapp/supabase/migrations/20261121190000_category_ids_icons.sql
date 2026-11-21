-- Link expenses to categories by id, add icon/color to categories, support deleting categories.
--
-- expenses.category (text) is KEPT because the iOS app still reads/writes plain names.
-- A trigger keeps expenses.category and expenses.category_id in sync in both directions:
--   * web sets category_id  → trigger fills category with the category's name
--   * iOS writes category   → trigger links category_id to the matching category (if any)
--   * category renamed      → linked expenses get the new name
--   * category deleted      → linked expenses become uncategorized (or are moved, via delete_category)
-- Safe to run more than once.

-- MARK: 1. Icon + color per category ------------------------------------------------------------

alter table public.categories
  add column if not exists icon text not null default 'tag' check (char_length(icon) between 1 and 40),
  add column if not exists color text not null default 'gray' check (char_length(color) between 1 and 20);

-- Give existing categories the icons/colors the apps used to hard-code.
update public.categories c
set icon = m.icon, color = m.color
from (values
  ('food & drink', 'utensils', 'blue'),
  ('home', 'cart', 'indigo'),
  ('rent & utilities', 'house', 'cyan'),
  ('utilities', 'house', 'cyan'),
  ('gold/silver', 'coins', 'yellow'),
  ('etfs', 'landmark', 'green'),
  ('transport', 'tram', 'orange'),
  ('telecom', 'phone', 'mint'),
  ('crochet', 'paw', 'orange'),
  ('fun', 'dumbbell', 'purple'),
  ('eating out', 'utensils', 'pink'),
  ('work', 'monitor', 'gray'),
  ('garden', 'leaf', 'green'),
  ('other', 'tag', 'gray')
) as m (lname, icon, color)
where lower(c.name) = m.lname and c.icon = 'tag' and c.color = 'gray';

-- Seed new users with icons too (replaces the function from the previous migration).
create or replace function public.seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (account_id, name, sort_order, icon, color)
  values
    (new.id, 'Food & Drink', 1, 'utensils', 'blue'),
    (new.id, 'Utilities', 2, 'house', 'cyan'),
    (new.id, 'Transport', 3, 'tram', 'orange')
  on conflict do nothing;
  return new;
end;
$$;

-- MARK: 2. expenses.category_id -------------------------------------------------------------------

alter table public.expenses
  add column if not exists category_id uuid references public.categories (id) on delete set null;

create index if not exists expenses_category_id_idx on public.expenses (category_id);

-- Create categories for names used by (non-deleted) expenses that the user doesn't have yet,
-- so no expense loses its category when switching to ids.
insert into public.categories (account_id, name, sort_order)
select distinct on (e.account_id, lower(btrim(e.category))) e.account_id, btrim(e.category), 1000
from public.expenses e
where e.deleted_at is null
  and e.category is not null
  and char_length(btrim(e.category)) between 1 and 50
  and exists (select 1 from auth.users u where u.id = e.account_id)
  and not exists (
    select 1 from public.categories c
    where c.account_id = e.account_id and lower(c.name) = lower(btrim(e.category))
  )
on conflict do nothing;

-- Link every expense to its category by name (runs before the sync trigger exists).
update public.expenses e
set category_id = c.id, category = c.name
from public.categories c
where e.category_id is null
  and e.category is not null
  and c.account_id = e.account_id
  and lower(c.name) = lower(btrim(e.category));

-- MARK: 3. Keep expenses.category (text) and expenses.category_id in sync ------------------------

create or replace function public.expenses_sync_category()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
begin
  if tg_op = 'INSERT' then
    if new.category_id is not null then
      v_name := (select name from public.categories where id = new.category_id and account_id = new.account_id);
      if v_name is null then
        raise exception 'Category not found';
      end if;
      new.category := v_name;
    elsif new.category is not null then
      new.category_id := (
        select id from public.categories
        where account_id = new.account_id and lower(name) = lower(btrim(new.category))
      );
    end if;

  elsif new.category_id is distinct from old.category_id then
    if new.category_id is not null then
      v_name := (select name from public.categories where id = new.category_id and account_id = new.account_id);
      if v_name is null then
        raise exception 'Category not found';
      end if;
      new.category := v_name;
    elsif new.category is not distinct from old.category then
      -- Category removed (e.g. ON DELETE SET NULL) without new text: uncategorized.
      new.category := null;
    end if;

  elsif new.category is distinct from old.category then
    -- Written as plain text (iOS app): link to the matching category, or none.
    new.category_id := (
      select id from public.categories
      where account_id = new.account_id and lower(name) = lower(btrim(new.category))
    );
  end if;

  return new;
end;
$$;

drop trigger if exists expenses_sync_category on public.expenses;
create trigger expenses_sync_category
  before insert or update of category, category_id on public.expenses
  for each row execute function public.expenses_sync_category();

-- Renaming a category updates the name stored on its linked expenses.
create or replace function public.categories_sync_expense_names()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.name is distinct from old.name then
    update public.expenses
    set category = new.name, updated_at = now()
    where category_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists categories_sync_expense_names on public.categories;
create trigger categories_sync_expense_names
  after update of name on public.categories
  for each row execute function public.categories_sync_expense_names();

-- MARK: 4. rename_category / delete_category ----------------------------------------------------

-- Linked expenses now follow via the trigger; this also adopts unlinked rows still using the old name.
create or replace function public.rename_category(p_id uuid, p_name text)
returns public.categories
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old text;
  v_row public.categories;
begin
  select name into v_old
  from public.categories
  where id = p_id and account_id = auth.uid()
  for update;

  if not found then
    raise exception 'Category not found';
  end if;

  update public.categories
  set name = btrim(p_name), updated_at = now()
  where id = p_id
  returning * into v_row;

  update public.expenses
  set category_id = p_id
  where account_id = auth.uid() and category_id is null and lower(btrim(category)) = lower(v_old);

  return v_row;
end;
$$;

-- Deletes a category. Its expenses move to p_move_to, or become uncategorized when it is null.
-- Returns how many expenses were affected.
create or replace function public.delete_category(p_id uuid, p_move_to uuid default null)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
  v_count integer;
begin
  select name into v_name
  from public.categories
  where id = p_id and account_id = auth.uid()
  for update;

  if not found then
    raise exception 'Category not found';
  end if;

  if p_move_to is not null and (
    p_move_to = p_id
    or not exists (select 1 from public.categories where id = p_move_to and account_id = auth.uid())
  ) then
    raise exception 'Invalid replacement category';
  end if;

  update public.expenses
  set category_id = p_move_to,
      category = case when p_move_to is null then null else category end,
      updated_at = now()
  where account_id = auth.uid()
    and (category_id = p_id or (category_id is null and lower(btrim(category)) = lower(v_name)));
  get diagnostics v_count = row_count;

  delete from public.categories where id = p_id;

  return v_count;
end;
$$;
