-- 1. Drop tables the app never used (all empty, no code, functions or views reference them).
--    Their own policies, foreign keys and triggers go with them; set_updated_at() stays,
--    it is still used by expenses, inventory_items and shopping_lists.
drop table if exists public.audit_logs;
drop table if exists public.expense_field_definitions;
drop table if exists public.inventory_field_definitions;
drop table if exists public.shopping_list_items;

-- 2. Let a user link themselves to their own account. account_users only had a SELECT policy,
--    so the insert in ensureDefaultAccount (AuthProvider.tsx) was always rejected by RLS and new
--    users ended up without a membership row. Only the self-owned account (id = user id) is allowed.
drop policy if exists "Users can link themselves to their own account" on public.account_users;
create policy "Users can link themselves to their own account"
  on public.account_users for insert
  to authenticated
  with check (user_id = auth.uid() and account_id = auth.uid());

-- 3. Repair users who signed up while the insert was blocked. Safe to run more than once.
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
