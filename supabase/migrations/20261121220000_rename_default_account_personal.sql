-- The default account created for each user (AuthProvider.ensureDefaultAccount) is now called
-- "Personal" instead of "My Kitchen". Rename the existing ones; accounts someone renamed are left alone.
-- Safe to run more than once.

update public.accounts
set name = 'Personal'
where name = 'My Kitchen';
