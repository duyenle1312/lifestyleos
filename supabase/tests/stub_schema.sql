-- Minimal stand-in for what Supabase provides plus the app schema that exists before the
-- repo's migrations (test-only; never applied to a real project).

create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
end $$;

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb,
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

-- Tables that exist in production but not in supabase/migrations (definitions read live 2026-11-23).
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  created_by_user_id uuid not null,
  item text not null,
  description text,
  metadata jsonb not null default '{}',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  location varchar,
  available_date_start date,
  available_date_end date,
  unit_price numeric,
  quantity integer,
  purchased boolean default false,
  scheduled_date date,
  priority smallint
);

create trigger trg_shopping_lists_updated_at before update on public.shopping_lists
  for each row execute function public.set_updated_at();

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  created_by_user_id uuid not null,
  name text not null,
  quantity numeric not null default 0,
  unit text,
  description text,
  metadata jsonb not null default '{}',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expiration_date timestamp
);

create trigger trg_inventory_updated_at before update on public.inventory_items
  for each row execute function public.set_updated_at();
