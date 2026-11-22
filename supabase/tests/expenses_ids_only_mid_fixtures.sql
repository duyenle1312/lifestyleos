-- Phase 3: after the existing migrations, before the new one. A already owns Revolut
-- (the payment-methods migration backfills it; this makes the precondition explicit).
insert into public.payment_methods (account_id, name, sort_order)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Revolut', 4)
on conflict do nothing;
