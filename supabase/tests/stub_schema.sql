-- Minimal stand-in for what Supabase provides plus the app schema that exists before the
-- repo's migrations (test-only; never applied to a real project).

create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end $$;

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table public.account_users (
  account_id uuid not null references public.accounts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner',
  primary key (account_id, user_id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  account_id uuid,
  created_by_user_id uuid,
  amount numeric,
  currency text,
  expense_date timestamptz,
  category text,
  description text,
  location text,
  unit numeric,
  unit_price numeric,
  expire_date timestamptz,
  payment_method text,
  item text,
  metadata jsonb default '{}',
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- iOS-era leftovers present in production: a view over expenses.category and a function reading it.
create view public.account_data_view as
select e.account_id,
       json_agg(json_build_object('id', e.id, 'category', e.category)) as expenses
from public.expenses e
group by e.account_id;

create function public.get_account_data_for_user() returns jsonb
language plpgsql
as $$
declare v jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(v2)), '[]'::jsonb) into v from public.account_data_view v2;
  return v;
end;
$$;

create function public.set_updated_at() returns trigger
language plpgsql
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger trg_expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
