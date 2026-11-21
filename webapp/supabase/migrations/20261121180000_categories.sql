-- Per-user expense categories.
-- expenses.category stays a text column (the iOS app writes plain names), so renaming a
-- category goes through rename_category(), which also updates the user's existing expenses.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists categories_account_name_key on public.categories (account_id, lower(name));
create index if not exists categories_account_sort_idx on public.categories (account_id, sort_order);

-- Row Level Security: like the other tables, account_id is the signed-in user's id.
alter table public.categories enable row level security;

drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own" on public.categories
  for select to authenticated using (account_id = auth.uid());

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories
  for insert to authenticated with check (account_id = auth.uid());

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
  for update to authenticated using (account_id = auth.uid()) with check (account_id = auth.uid());

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories
  for delete to authenticated using (account_id = auth.uid());

-- Rename a category and re-label the caller's expenses that used the old name, atomically.
-- security invoker: runs with the caller's permissions, so RLS still applies.
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

  if v_row.name is distinct from v_old then
    update public.expenses
    set category = v_row.name, updated_at = now()
    where account_id = auth.uid() and category = v_old;
  end if;

  return v_row;
end;
$$;

-- New users (web or iOS sign-up) start with a small default set.
create or replace function public.seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (account_id, name, sort_order)
  values (new.id, 'Food & Drink', 1), (new.id, 'Utilities', 2), (new.id, 'Transport', 3)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_seed_categories on auth.users;
create trigger on_auth_user_created_seed_categories
  after insert on auth.users
  for each row execute function public.seed_default_categories();

-- Backfill: the original owner gets the full list the app used to hard-code ...
insert into public.categories (account_id, name, sort_order)
select u.id, c.name, c.ord
from auth.users u
cross join unnest(array[
  'Food & Drink', 'Home', 'Rent & Utilities', 'Gold/Silver', 'ETFs', 'Transport', 'Telecom',
  'Crochet', 'Fun', 'Eating Out', 'Work', 'Garden', 'Other'
]) with ordinality as c (name, ord)
where u.email = 'duyenle.vacl@gmail.com'
on conflict do nothing;

-- ... and every other existing user without categories gets the defaults.
insert into public.categories (account_id, name, sort_order)
select u.id, c.name, c.ord
from auth.users u
cross join unnest(array['Food & Drink', 'Utilities', 'Transport']) with ordinality as c (name, ord)
where not exists (select 1 from public.categories x where x.account_id = u.id)
on conflict do nothing;
