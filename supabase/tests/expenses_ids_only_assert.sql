-- Assertions after the new migration has run (twice).
\set ON_ERROR_STOP on

do $$
declare
  a constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  b constant uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  e1 record; e2 record; e3 record; e4 record; e5 record; f1 record;
  n int;
begin
  select * into e1 from public.expenses where description = 'a1';
  select * into e2 from public.expenses where description = 'a2';
  select * into e3 from public.expenses where description = 'a3';
  select * into e4 from public.expenses where description = 'a4';
  select * into e5 from public.expenses where description = 'a5';
  select * into f1 from public.expenses where description = 'b1';

  -- a1: linked to A's existing rows
  if e1.category_id is distinct from (select id from public.categories where account_id = a and lower(name) = 'food & drink') then
    raise exception 'a1 category not linked to existing Food & Drink'; end if;
  if e1.payment_method_id is distinct from (select id from public.payment_methods where account_id = a and name = 'Revolut') then
    raise exception 'a1 payment method not linked to existing Revolut'; end if;

  -- a2: same ids as a1
  if e2.category_id is distinct from e1.category_id then raise exception 'a2 category differs from a1'; end if;
  if e2.payment_method_id is distinct from e1.payment_method_id then raise exception 'a2 payment method differs from a1'; end if;

  -- a3: new rows for A
  if e3.category_id is distinct from (select id from public.categories where account_id = a and name = 'Knitting') then
    raise exception 'a3 category not linked to new Knitting'; end if;
  if e3.payment_method_id is distinct from (select id from public.payment_methods where account_id = a and name = 'Cash Jar') then
    raise exception 'a3 payment method not linked to new Cash Jar'; end if;

  -- a4: nothing
  if e4.category_id is not null or e4.payment_method_id is not null then raise exception 'a4 should have null ids'; end if;

  -- a5: truncated to 50 and linked
  if e5.category_id is distinct from (select id from public.categories where account_id = a and name = repeat('c', 50)) then
    raise exception 'a5 category not linked to truncated name'; end if;
  if e5.payment_method_id is distinct from (select id from public.payment_methods where account_id = a and name = repeat('p', 50)) then
    raise exception 'a5 payment method not linked to truncated name'; end if;

  -- b1: B's own rows, not A's
  if f1.category_id is distinct from (select id from public.categories where account_id = b and name = 'Knitting') then
    raise exception 'b1 category not B''s own Knitting'; end if;
  if f1.payment_method_id is distinct from (select id from public.payment_methods where account_id = b and name = 'Cash Jar') then
    raise exception 'b1 payment method not B''s own Cash Jar'; end if;
  if f1.category_id = e3.category_id or f1.payment_method_id = e3.payment_method_id then
    raise exception 'b1 shares rows with A'; end if;

  -- no duplicates
  select count(*) into n from public.categories where account_id = a and lower(name) = 'food & drink';
  if n <> 1 then raise exception 'expected 1 Food & Drink for A, got %', n; end if;
  select count(*) into n from public.payment_methods where account_id = a and lower(name) = 'revolut';
  if n <> 1 then raise exception 'expected 1 Revolut for A, got %', n; end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'expenses' and column_name in ('category', 'payment_method')) then
    raise exception 'expenses still has a text column'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'expenses' and column_name = 'payment_method_id') then
    raise exception 'expenses.payment_method_id missing'; end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname in ('rename_category', 'delete_category', 'rename_payment_method',
               'delete_payment_method', 'expenses_sync_category', 'categories_sync_expense_names')) then
    raise exception 'a dropped function still exists'; end if;
  if exists (select 1 from pg_proc where proname = 'get_account_data_for_user') then
    raise exception 'get_account_data_for_user still exists'; end if;
  if to_regclass('public.account_data_view') is not null then
    raise exception 'account_data_view still exists'; end if;
  if exists (select 1 from pg_trigger where tgname in ('expenses_sync_category', 'categories_sync_expense_names')) then
    raise exception 'a sync trigger still exists'; end if;
end $$;

-- Deleting a payment method clears payment_method_id on its expenses.
do $$
declare pm uuid;
begin
  select payment_method_id into pm from public.expenses where description = 'a3';
  delete from public.payment_methods where id = pm;
  if (select payment_method_id from public.expenses where description = 'a3') is not null then
    raise exception 'payment_method_id not cleared on delete'; end if;
  if not exists (select 1 from public.expenses where description = 'a3') then
    raise exception 'expense vanished'; end if;
end $$;

select 'assertions ok' as result;
