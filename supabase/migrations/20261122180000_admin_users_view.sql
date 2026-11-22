-- Admin-only overview of users and their accounts, for the Supabase SQL editor:
--   select * from admin.users;
-- Lives in its own "admin" schema, which the Data API does not expose, and the API roles get no
-- access, so emails from auth.users never reach the browser. (A view in public would run with its
-- owner's rights and leak every user's email to any signed-in user.)

-- Accounts created by the 20261122160000 backfill got signed_up_at = now(); use the real sign-up time.
update public.accounts a set signed_up_at = u.created_at
from auth.users u
where u.id = a.id and a.signed_up_at is distinct from u.created_at;

create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

create or replace view admin.users as
select
  u.id                              as user_id,
  u.email,
  a.name                            as account_name,
  coalesce(a.signed_up_at, u.created_at) as signed_up_at,
  u.last_sign_in_at,
  u.email_confirmed_at is not null  as email_confirmed,
  exists (
    select 1 from public.account_users au where au.account_id = u.id and au.user_id = u.id
  )                                 as has_owner_link,
  (select count(*) from public.expenses e where e.account_id = u.id and e.deleted_at is null) as expenses,
  (select max(e.created_at) from public.expenses e where e.account_id = u.id) as last_expense_at
from auth.users u
left join public.accounts a on a.id = u.id
order by u.created_at;

revoke all on admin.users from public, anon, authenticated;
