-- Assertions for dashboard.usage_stats() against dashboard_stats_fixtures.sql (run after all migrations).
\set ON_ERROR_STOP on

do $$
declare s jsonb; t jsonb; b boolean;
begin
  s := dashboard.usage_stats();
  t := s->'totals';

  if jsonb_array_length(s->'daily'->'expAdded') <> 730 then raise exception 'FAIL: daily length'; end if;
  if jsonb_array_length(s->'activeBuckets'->'d30') <> 30
     or jsonb_array_length(s->'activeBuckets'->'w12') <> 12
     or jsonb_array_length(s->'activeBuckets'->'m12') <> 12 then
    raise exception 'FAIL: activeBuckets lengths %', s->'activeBuckets';
  end if;

  if (t->>'users')::int <> 3 then raise exception 'FAIL: users %', t->>'users'; end if;
  if (t->>'active7')::int <> 2 then raise exception 'FAIL: active7 %', t->>'active7'; end if;
  if (t->>'active30')::int <> 2 then raise exception 'FAIL: active30 %', t->>'active30'; end if;
  if (t->>'shoppingOpen')::int <> 1 then raise exception 'FAIL: shoppingOpen %', t->>'shoppingOpen'; end if;
  if (t->>'inventoryInStock')::int <> 1 then raise exception 'FAIL: inventoryInStock %', t->>'inventoryInStock'; end if;
  if (t->>'inventoryExpiring7')::int <> 1 then raise exception 'FAIL: inventoryExpiring7 %', t->>'inventoryExpiring7'; end if;
  if (t->>'usersWithCustomCategories')::int <> 1 then raise exception 'FAIL: custom categories %', t->>'usersWithCustomCategories'; end if;
  if (t->>'usersWithCustomPaymentMethods')::int <> 1 then raise exception 'FAIL: custom payment methods %', t->>'usersWithCustomPaymentMethods'; end if;
  if (t->>'eurAllTime')::numeric <> 30 then raise exception 'FAIL: eurAllTime %', t->>'eurAllTime'; end if;
  if t->'otherCurrencies' <> '[{"currency":"USD","amount":5}]'::jsonb then raise exception 'FAIL: otherCurrencies %', t->'otherCurrencies'; end if;
  if (t->>'expensesAllTime')::int <> 3 then raise exception 'FAIL: expensesAllTime %', t->>'expensesAllTime'; end if;
  if (t->>'expensesDeletedAllTime')::int <> 1 then raise exception 'FAIL: expensesDeletedAllTime %', t->>'expensesDeletedAllTime'; end if;
  if (t->>'retentionD30')::numeric <> 0.5 then raise exception 'FAIL: retentionD30 %', t->>'retentionD30'; end if;
  if (s->'daily'->'expAdded'->>729)::int < 2 then raise exception 'FAIL: expAdded today'; end if;
  if (s->'daily'->'expEur'->>729)::numeric <> 30 then raise exception 'FAIL: expEur today %', s->'daily'->'expEur'->>729; end if;
  if (s->'daily'->'signups'->>728)::int <> 1 then raise exception 'FAIL: signups yesterday'; end if;
  if s->'lastActivity'->>'kind' is null then raise exception 'FAIL: lastActivity kind'; end if;
  if s->>'today' is null or s->>'generatedAt' is null then raise exception 'FAIL: today/generatedAt'; end if;
  -- today's activity is A and C: the last bucket of each view counts 2 (a day, a week or month may also hold B's... no, B is inactive)
  if (s->'activeBuckets'->'d30'->>29)::int <> 2 then raise exception 'FAIL: d30 last bucket %', s->'activeBuckets'->'d30'->>29; end if;
end $$;

-- anon / authenticated cannot call it.
do $$ begin
  set local role anon;
  begin
    perform dashboard.usage_stats();
    raise exception 'FAIL: anon could call usage_stats';
  exception when insufficient_privilege then null; end;
  reset role;
  set local role authenticated;
  begin
    perform dashboard.usage_stats();
    raise exception 'FAIL: authenticated could call usage_stats';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;

-- dashboard_reader: can call it, and can read nothing else.
do $$
declare s jsonb;
begin
  set local role dashboard_reader;
  s := dashboard.usage_stats();
  if (s->'totals'->>'users')::int <> 3 then raise exception 'FAIL: reader users'; end if;
  begin
    perform 1 from public.expenses limit 1;
    raise exception 'FAIL: dashboard_reader could read public.expenses';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from auth.users limit 1;
    raise exception 'FAIL: dashboard_reader could read auth.users';
  exception when insufficient_privilege then null; end;
  reset role;
  if (select rolcanlogin from pg_roles where rolname = 'dashboard_reader') then
    raise exception 'FAIL: dashboard_reader can log in';
  end if;
end $$;
