-- Fixtures for dashboard.usage_stats(); run in a fresh database AFTER all migrations.
-- The sign-up triggers seed default categories / payment methods for each new user; those rows are
-- moved back to the user's sign-up time at the end so seeding does not count as activity today.
\set ON_ERROR_STOP on

insert into auth.users (id, email, created_at) values
  ('d0000000-0000-0000-0000-00000000000a', 'dash-a@example.com', now() - interval '60 days'),
  ('d0000000-0000-0000-0000-00000000000b', 'dash-b@example.com', now() - interval '60 days'),
  ('d0000000-0000-0000-0000-00000000000c', 'dash-c@example.com', now() - interval '1 day');

-- A: expenses today (EUR/eur), one 40 days after sign-up (USD, i.e. 20 days ago), one soft-deleted today.
insert into public.expenses (account_id, created_by_user_id, amount, currency, description, created_at, updated_at, deleted_at) values
  ('d0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000a', 10, 'EUR', 'dash-eur', now(), now(), null),
  ('d0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000a', 20, 'eur', 'dash-eur-lower', now(), now(), null),
  ('d0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000a', 5, 'USD', 'dash-usd', now() - interval '20 days', now() - interval '20 days', null),
  ('d0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000a', 99, 'EUR', 'dash-deleted', now(), now(), now());

insert into public.categories (account_id, name, created_at, updated_at)
  values ('d0000000-0000-0000-0000-00000000000a', 'Pets', now() - interval '50 days', now() - interval '50 days');
insert into public.payment_methods (account_id, name, created_at, updated_at)
  values ('d0000000-0000-0000-0000-00000000000a', 'Wise', now() - interval '50 days', now() - interval '50 days');

-- C: shopping (open, ticked, soft-deleted) and inventory (expiring in 3 days, soft-deleted).
insert into public.shopping_lists (account_id, created_by_user_id, item, purchased, deleted_at) values
  ('d0000000-0000-0000-0000-00000000000c', 'd0000000-0000-0000-0000-00000000000c', 'dash-open', false, null),
  ('d0000000-0000-0000-0000-00000000000c', 'd0000000-0000-0000-0000-00000000000c', 'dash-ticked', true, null),
  ('d0000000-0000-0000-0000-00000000000c', 'd0000000-0000-0000-0000-00000000000c', 'dash-deleted', false, now());
insert into public.inventory_items (account_id, created_by_user_id, name, expiration_date, deleted_at) values
  ('d0000000-0000-0000-0000-00000000000c', 'd0000000-0000-0000-0000-00000000000c', 'dash-expiring', now() + interval '3 days', null),
  ('d0000000-0000-0000-0000-00000000000c', 'd0000000-0000-0000-0000-00000000000c', 'dash-gone', now() + interval '3 days', now());

-- Undo the activity the sign-up seeding caused (rows seeded for the fixture users only).
update public.categories c set created_at = u.created_at, updated_at = u.created_at
from auth.users u
where u.id = c.account_id and u.email like 'dash-%@example.com' and c.name <> 'Pets';
update public.payment_methods p set created_at = u.created_at, updated_at = u.created_at
from auth.users u
where u.id = p.account_id and u.email like 'dash-%@example.com' and p.name <> 'Wise';
