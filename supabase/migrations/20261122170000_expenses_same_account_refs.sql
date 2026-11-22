-- An expense may only reference categories and payment methods of its own account.
-- Foreign-key checks bypass row level security, so without this a signed-in user could point
-- their expense at another account's category or payment method id.
-- A trigger rather than composite foreign keys: it works on Postgres 14 and 17 and leaves the
-- existing single-column FKs (on delete set null) untouched.
-- SQLSTATE 23503 (foreign_key_violation) lets the offline sync treat this as a missing reference.

create or replace function public.expenses_check_same_account()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c
    where c.id = new.category_id and c.account_id = new.account_id
  ) then
    raise exception 'category % does not belong to account %', new.category_id, new.account_id
      using errcode = '23503';
  end if;

  if new.payment_method_id is not null and not exists (
    select 1 from public.payment_methods p
    where p.id = new.payment_method_id and p.account_id = new.account_id
  ) then
    raise exception 'payment method % does not belong to account %', new.payment_method_id, new.account_id
      using errcode = '23503';
  end if;

  return new;
end;
$$;

drop trigger if exists expenses_same_account_refs on public.expenses;
create trigger expenses_same_account_refs
  before insert or update of account_id, category_id, payment_method_id on public.expenses
  for each row execute function public.expenses_check_same_account();
