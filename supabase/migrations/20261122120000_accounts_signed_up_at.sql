-- When each person joined the app. One "Personal" account exists per user with id = user id
-- (see 20261121210000_account_id_equals_user_id.sql), so the timestamp lives on that account.
--
-- New accounts: the app creates the account on the user's first sign-in (ensureDefaultAccount in
-- src/components/AuthProvider.tsx), so the now() default records that first sign-in. For magic-link
-- sign-ups this is when the link was opened, not when it was requested.
-- Existing accounts: backfilled from auth.users.created_at.
-- Safe to run more than once.

alter table public.accounts
  add column if not exists signed_up_at timestamptz not null default now();

update public.accounts a
set signed_up_at = u.created_at
from auth.users u
where u.id = a.id
  and u.created_at < a.signed_up_at;

-- Example: sign-ups per month.
-- select date_trunc('month', signed_up_at) as month, count(*) from public.accounts group by 1 order by 1;
