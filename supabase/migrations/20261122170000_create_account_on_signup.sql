-- Create each new user's "Personal" account (id = user id) and owner link in the database,
-- so sign-up no longer depends on the browser's ensureDefaultAccount succeeding.
-- Triggers for the same event fire in name order, so this one ("..._account") runs before
-- the "..._seed_categories" / "..._seed_payment_methods" triggers.

create or replace function public.create_default_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounts (id, name, signed_up_at)
  values (new.id, 'Personal', new.created_at)
  on conflict (id) do nothing;

  insert into public.account_users (account_id, user_id, role)
  values (new.id, new.id, 'owner')
  on conflict do nothing;

  return new;
end;
$$;

-- Only the trigger should call it.
revoke execute on function public.create_default_account() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_account on auth.users;
create trigger on_auth_user_created_account
  after insert on auth.users
  for each row execute function public.create_default_account();
