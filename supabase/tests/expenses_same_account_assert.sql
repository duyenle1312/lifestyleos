-- Assertions for the same-account reference check (run after all migrations, mine applied twice).
\set ON_ERROR_STOP on

do $$
declare
  a constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  b constant uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  a_cat uuid; b_cat uuid; a_pm uuid; b_pm uuid; eid uuid; st text; n int; v uuid;
begin
  insert into public.categories (account_id, name) values (a, 'SA-A-cat') returning id into a_cat;
  insert into public.categories (account_id, name) values (b, 'SA-B-cat') returning id into b_cat;
  insert into public.payment_methods (account_id, name) values (a, 'SA-A-pm') returning id into a_pm;
  insert into public.payment_methods (account_id, name) values (b, 'SA-B-pm') returning id into b_pm;

  -- accepted: own ids, nulls
  insert into public.expenses (account_id, amount, description, category_id, payment_method_id)
    values (a, 1, 'sa-own', a_cat, a_pm) returning id into eid;
  insert into public.expenses (account_id, amount, description) values (a, 1, 'sa-null');

  -- rejected on insert: other account's category
  begin
    insert into public.expenses (account_id, amount, description, category_id) values (a, 1, 'sa-x1', b_cat);
    raise exception 'insert with foreign category was accepted';
  exception when foreign_key_violation then null; end;

  -- rejected on insert: other account's payment method
  begin
    insert into public.expenses (account_id, amount, description, payment_method_id) values (a, 1, 'sa-x2', b_pm);
    raise exception 'insert with foreign payment method was accepted';
  exception when foreign_key_violation then null; end;

  -- rejected on update (category, payment method)
  begin
    update public.expenses set category_id = b_cat where id = eid;
    raise exception 'update to foreign category was accepted';
  exception when foreign_key_violation then null; end;
  begin
    update public.expenses set payment_method_id = b_pm where id = eid;
    raise exception 'update to foreign payment method was accepted';
  exception when foreign_key_violation then null; end;

  -- rejected when moving the expense to another account while keeping its refs
  begin
    update public.expenses set account_id = b where id = eid;
    raise exception 'moving expense to another account with old refs was accepted';
  exception when foreign_key_violation then null; end;

  -- the SQLSTATE is exactly 23503
  begin
    insert into public.expenses (account_id, amount, description, category_id) values (a, 1, 'sa-x3', b_cat);
  exception when others then get stacked diagnostics st = returned_sqlstate;
  end;
  if st is distinct from '23503' then raise exception 'expected SQLSTATE 23503, got %', st; end if;

  -- nonexistent id is rejected too
  begin
    insert into public.expenses (account_id, amount, description, category_id) values (a, 1, 'sa-x4', gen_random_uuid());
    raise exception 'insert with nonexistent category was accepted';
  exception when foreign_key_violation then null; end;

  -- unrelated updates still work
  update public.expenses set amount = 2 where id = eid;

  -- deleting A's category / payment method nulls the ids and keeps the row
  delete from public.categories where id = a_cat;
  delete from public.payment_methods where id = a_pm;
  select count(*) into n from public.expenses where id = eid and category_id is null and payment_method_id is null;
  if n <> 1 then raise exception 'delete of category/payment method did not null ids on a kept row'; end if;

  select count(*) into n from public.expenses where description like 'sa-x%';
  if n <> 0 then raise exception 'rejected rows were stored'; end if;
end $$;
