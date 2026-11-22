-- Expenses reference categories and payment methods by id only.
-- The iOS app (the reason for the plain-text expenses.category / expenses.payment_method columns,
-- their sync trigger and the rename/delete functions) is retired, so the web app is the only client.
-- Order: add payment_method_id, backfill both ids from the old text (no label is lost),
-- drop the triggers/functions, then drop the text columns.
-- Also drops public.get_account_data_for_user() and public.account_data_view: iOS-era leftovers,
-- unused by the web app, whose view selects expenses.category and would block dropping the column.
-- Safe to run more than once.

-- 1. expenses.payment_method_id
alter table public.expenses
  add column if not exists payment_method_id uuid references public.payment_methods (id) on delete set null;

create index if not exists expenses_payment_method_id_idx on public.expenses (payment_method_id);

-- 2. Backfill from the text columns (only while they still exist). Dynamic SQL so this
--    file still compiles on a database where the columns are already gone.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'expenses' and column_name = 'category') then
    execute $q$
      insert into public.categories (account_id, name, sort_order)
      select distinct on (e.account_id, lower(left(btrim(e.category), 50)))
             e.account_id, left(btrim(e.category), 50), 1000
      from public.expenses e
      where e.deleted_at is null
        and e.category is not null
        and char_length(btrim(e.category)) >= 1
        and exists (select 1 from auth.users u where u.id = e.account_id)
        and not exists (
          select 1 from public.categories c
          where c.account_id = e.account_id and lower(c.name) = lower(left(btrim(e.category), 50))
        )
      on conflict do nothing
    $q$;
    execute $q$
      update public.expenses e
      set category_id = c.id
      from public.categories c
      where e.category_id is null
        and e.category is not null
        and c.account_id = e.account_id
        and lower(c.name) = lower(left(btrim(e.category), 50))
    $q$;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'expenses' and column_name = 'payment_method') then
    execute $q$
      insert into public.payment_methods (account_id, name, sort_order)
      select distinct on (e.account_id, lower(left(btrim(e.payment_method), 50)))
             e.account_id, left(btrim(e.payment_method), 50), 1000
      from public.expenses e
      where e.deleted_at is null
        and e.payment_method is not null
        and char_length(btrim(e.payment_method)) >= 1
        and exists (select 1 from auth.users u where u.id = e.account_id)
        and not exists (
          select 1 from public.payment_methods p
          where p.account_id = e.account_id and lower(p.name) = lower(left(btrim(e.payment_method), 50))
        )
      on conflict do nothing
    $q$;
    execute $q$
      update public.expenses e
      set payment_method_id = p.id
      from public.payment_methods p
      where e.payment_method_id is null
        and e.payment_method is not null
        and p.account_id = e.account_id
        and lower(p.name) = lower(left(btrim(e.payment_method), 50))
    $q$;
  end if;
end $$;

-- 3. Sync triggers and rename/delete functions
drop trigger if exists expenses_sync_category on public.expenses;
drop trigger if exists categories_sync_expense_names on public.categories;
drop function if exists public.expenses_sync_category();
drop function if exists public.categories_sync_expense_names();
drop function if exists public.rename_category(uuid, text);
drop function if exists public.delete_category(uuid, uuid);
drop function if exists public.rename_payment_method(uuid, text);
drop function if exists public.delete_payment_method(uuid, uuid);

-- 4. iOS-era view (reads expenses.category) and the function using it; function first, no CASCADE
drop function if exists public.get_account_data_for_user();
drop view if exists public.account_data_view;

-- 5. Text columns
alter table public.expenses
  drop column if exists category,
  drop column if exists payment_method;
