-- Phase 1: users and expenses with the old text columns (before any migration).
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.test');

insert into public.expenses (id, account_id, amount, category, payment_method, description) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 1, 'Food & Drink',   'Revolut',  'a1'),
  ('a2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 2, ' food & drink ', ' revolut ', 'a2'),
  ('a3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 3, 'Knitting',       'Cash Jar', 'a3'),
  ('a4000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 4, null,             null,       'a4'),
  ('a5000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 5, repeat('c', 60),  repeat('p', 60), 'a5'),
  ('b1000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 6, 'Knitting',       'Cash Jar', 'b1');
