-- admin.users: add the user's display name (Settings → Name, stored in auth user metadata).
-- Recreated rather than "create or replace" so the column can sit next to email.

drop view if exists admin.users;

create view admin.users as
select
  u.id                              as user_id,
  u.email,
  nullif(btrim(u.raw_user_meta_data ->> 'full_name'), '') as name,
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
