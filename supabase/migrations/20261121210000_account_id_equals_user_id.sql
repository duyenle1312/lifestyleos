-- The app writes every row with account_id = auth.uid(), so each user needs an account whose id
-- is their user id, with themselves linked as owner. Older sign-ups got an account with a random
-- id instead, which made RLS reject their inserts ("new row violates row-level security policy").
-- Safe to run more than once.

insert into public.accounts (id, name)
select u.id, 'Personal'
from auth.users u
where not exists (select 1 from public.accounts a where a.id = u.id);

insert into public.account_users (account_id, user_id, role)
select u.id, u.id, 'owner'
from auth.users u
where not exists (
  select 1 from public.account_users au where au.account_id = u.id and au.user_id = u.id
);
