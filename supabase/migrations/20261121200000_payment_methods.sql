-- Per-user payment methods (previously a hard-coded list in the apps).
-- expenses.payment_method stays a plain text column; renaming or deleting a method goes through
-- the functions below, which also update the caller's expenses that use it.
-- Safe to run more than once.

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_methods_account_name_key on public.payment_methods (account_id, lower(name));
create index if not exists payment_methods_account_sort_idx on public.payment_methods (account_id, sort_order);

alter table public.payment_methods enable row level security;

drop policy if exists "payment_methods_select_own" on public.payment_methods;
create policy "payment_methods_select_own" on public.payment_methods
  for select to authenticated using (account_id = auth.uid());

drop policy if exists "payment_methods_insert_own" on public.payment_methods;
create policy "payment_methods_insert_own" on public.payment_methods
  for insert to authenticated with check (account_id = auth.uid());

drop policy if exists "payment_methods_update_own" on public.payment_methods;
create policy "payment_methods_update_own" on public.payment_methods
  for update to authenticated using (account_id = auth.uid()) with check (account_id = auth.uid());

drop policy if exists "payment_methods_delete_own" on public.payment_methods;
create policy "payment_methods_delete_own" on public.payment_methods
  for delete to authenticated using (account_id = auth.uid());

-- Rename a method and re-label the caller's expenses that used the old name, atomically.
create or replace function public.rename_payment_method(p_id uuid, p_name text)
returns public.payment_methods
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old text;
  v_row public.payment_methods;
begin
  select name into v_old
  from public.payment_methods
  where id = p_id and account_id = auth.uid()
  for update;

  if not found then
    raise exception 'Payment method not found';
  end if;

  update public.payment_methods
  set name = btrim(p_name), updated_at = now()
  where id = p_id
  returning * into v_row;

  update public.expenses
  set payment_method = v_row.name, updated_at = now()
  where account_id = auth.uid()
    and lower(btrim(payment_method)) = lower(v_old)
    and payment_method is distinct from v_row.name;

  return v_row;
end;
$$;

-- Delete a method. Its expenses move to p_move_to, or get no payment method when it is null.
-- Returns how many expenses were affected.
create or replace function public.delete_payment_method(p_id uuid, p_move_to uuid default null)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
  v_new text;
  v_count integer;
begin
  select name into v_name
  from public.payment_methods
  where id = p_id and account_id = auth.uid()
  for update;

  if not found then
    raise exception 'Payment method not found';
  end if;

  if p_move_to is not null then
    select name into v_new
    from public.payment_methods
    where id = p_move_to and id <> p_id and account_id = auth.uid();
    if v_new is null then
      raise exception 'Invalid replacement payment method';
    end if;
  end if;

  update public.expenses
  set payment_method = v_new, updated_at = now()
  where account_id = auth.uid()
    and lower(btrim(payment_method)) = lower(v_name);
  get diagnostics v_count = row_count;

  delete from public.payment_methods where id = p_id;

  return v_count;
end;
$$;

-- New users start with a small default set.
create or replace function public.seed_default_payment_methods()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.payment_methods (account_id, name, sort_order)
  values (new.id, 'Cash', 1), (new.id, 'Card', 2)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_seed_payment_methods on auth.users;
create trigger on_auth_user_created_seed_payment_methods
  after insert on auth.users
  for each row execute function public.seed_default_payment_methods();

-- Backfill: every existing user gets the list the app used to hard-code ...
insert into public.payment_methods (account_id, name, sort_order)
select u.id, m.name, m.ord
from auth.users u
cross join unnest(array[
  'Food Voucher', 'T212', 'Revolut', 'UBB', 'Curve', 'Paypal', 'VCB', 'Cash', 'Other'
]) with ordinality as m (name, ord)
where not exists (select 1 from public.payment_methods x where x.account_id = u.id)
on conflict do nothing;

-- ... plus any other method already used on their expenses, so nothing becomes unselectable.
insert into public.payment_methods (account_id, name, sort_order)
select distinct on (e.account_id, lower(btrim(e.payment_method))) e.account_id, btrim(e.payment_method), 1000
from public.expenses e
where e.deleted_at is null
  and e.payment_method is not null
  and char_length(btrim(e.payment_method)) between 1 and 50
  and exists (select 1 from auth.users u where u.id = e.account_id)
on conflict do nothing;
