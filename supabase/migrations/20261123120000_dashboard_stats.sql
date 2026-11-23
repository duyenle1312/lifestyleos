-- Usage dashboard: one read-only function returning aggregate usage statistics as JSON, and a
-- login role that can call only that function (no access to public, auth or admin tables).
--
-- One-time owner step, run in the Supabase SQL editor (the password never goes into git):
--   alter role dashboard_reader with login password '<generated>';
-- The pooler username is then: dashboard_reader.<project-ref>
--
-- "Activity" = any created_at / updated_at / deleted_at on a row of expenses, shopping_lists,
-- inventory_items, categories or payment_methods, attributed by account_id. Days are Helsinki days.
-- Bucket b of a view with range R days and N buckets covers day indices
--   [730 - R + (b*R)/N, 730 - R + ((b+1)*R)/N)   (integer division; index 729 = today).

create schema if not exists dashboard;
revoke all on schema dashboard from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'dashboard_reader') then
    create role dashboard_reader nologin;
  end if;
end $$;

create or replace function dashboard.usage_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with
t as (select (now() at time zone 'Europe/Helsinki')::date as today),
-- every activity event: (account, time, kind)
ev0 as (
  select account_id, unnest(array[created_at, updated_at, deleted_at]) as ts, 'expense' as kind from public.expenses
  union all
  select account_id, unnest(array[created_at, updated_at, deleted_at]), 'shopping' from public.shopping_lists
  union all
  select account_id, unnest(array[created_at, updated_at, deleted_at]), 'inventory' from public.inventory_items
  union all
  select account_id, unnest(array[created_at, updated_at]), 'category' from public.categories
  union all
  select account_id, unnest(array[created_at, updated_at]), 'payment_method' from public.payment_methods
),
ev as (
  select e.account_id, e.ts, e.kind,
         729 - (t.today - (e.ts at time zone 'Europe/Helsinki')::date) as idx
  from ev0 e cross join t
  where e.ts is not null and e.account_id is not null
    and e.ts <= now() -- ignore future timestamps (device clock skew)
),
-- per-day metric rows: (metric, day index, value)
mrows as (
  select m.metric, 729 - (t.today - m.d) as idx, m.val
  from t cross join lateral (
    select 'signups' as metric, (u.created_at at time zone 'Europe/Helsinki')::date as d, 1::numeric as val from auth.users u
    union all select 'expAdded', (x.created_at at time zone 'Europe/Helsinki')::date, 1 from public.expenses x where x.created_at is not null
    union all select 'expDeleted', (x.deleted_at at time zone 'Europe/Helsinki')::date, 1 from public.expenses x where x.deleted_at is not null
    union all select 'expEur', (x.created_at at time zone 'Europe/Helsinki')::date, coalesce(x.amount, 0)
      from public.expenses x where x.deleted_at is null and x.created_at is not null and upper(x.currency) = 'EUR'
    union all select 'shopCreated', (s.created_at at time zone 'Europe/Helsinki')::date, 1 from public.shopping_lists s
    union all select 'shopTicked', (s.updated_at at time zone 'Europe/Helsinki')::date, 1
      from public.shopping_lists s where s.purchased and s.deleted_at is null
    union all select 'shopDeleted', (s.deleted_at at time zone 'Europe/Helsinki')::date, 1 from public.shopping_lists s where s.deleted_at is not null
    union all select 'invAdded', (i.created_at at time zone 'Europe/Helsinki')::date, 1 from public.inventory_items i
    union all select 'invDeleted', (i.deleted_at at time zone 'Europe/Helsinki')::date, 1 from public.inventory_items i where i.deleted_at is not null
  ) m
),
mday as (select metric, idx, sum(val) as v from mrows where idx between 0 and 729 group by metric, idx),
daily as (
  select jsonb_object_agg(metric, arr) as j from (
    select n.metric, jsonb_agg(coalesce(d.v, 0) order by g.i) as arr
    from (values ('signups'), ('expAdded'), ('expDeleted'), ('expEur'), ('shopCreated'),
                 ('shopTicked'), ('shopDeleted'), ('invAdded'), ('invDeleted')) n(metric)
    cross join generate_series(0, 729) g(i)
    left join mday d on d.metric = n.metric and d.idx = g.i
    group by n.metric
  ) z
),
buckets as (
  select jsonb_object_agg(name, arr) as j from (
    select k.name,
           jsonb_agg((select count(distinct e.account_id) from ev e
                      where e.idx >= 730 - k.r + (b.b * k.r) / k.n
                        and e.idx <  730 - k.r + ((b.b + 1) * k.r) / k.n)
                     order by b.b) as arr
    from (values ('d30', 30, 30), ('w12', 84, 12), ('m12', 365, 12)) k(name, r, n)
    cross join lateral generate_series(0, k.n - 1) b(b)
    group by k.name
  ) z
),
cur as (
  select upper(currency) as c, sum(amount) as amt
  from public.expenses
  where deleted_at is null and upper(currency) <> 'EUR'
  group by upper(currency)
),
ret as (
  select count(*) as eligible,
         count(*) filter (where exists (
           select 1 from ev e where e.account_id = u.id and e.ts >= u.created_at + interval '30 days'
         )) as kept
  from auth.users u cross join t
  where (u.created_at at time zone 'Europe/Helsinki')::date <= t.today - 30
),
last as (select ts, kind from ev order by ts desc limit 1)
select jsonb_build_object(
  'generatedAt', now(),
  'today', (select today from t),
  'daily', (select j from daily),
  'activeBuckets', (select j from buckets),
  'totals', jsonb_build_object(
    'users', (select count(*) from auth.users),
    'active7', (select count(distinct account_id) from ev where idx >= 723),
    'active30', (select count(distinct account_id) from ev where idx >= 700),
    'expensesAllTime', (select count(*) from public.expenses where deleted_at is null),
    'expensesDeletedAllTime', (select count(*) from public.expenses where deleted_at is not null),
    'eurAllTime', (select coalesce(sum(amount), 0) from public.expenses where deleted_at is null and upper(currency) = 'EUR'),
    'otherCurrencies', coalesce((select jsonb_agg(jsonb_build_object('currency', c, 'amount', amt) order by amt desc) from cur), '[]'::jsonb),
    'shoppingOpen', (select count(*) from public.shopping_lists where coalesce(purchased, false) = false and deleted_at is null),
    'inventoryInStock', (select count(*) from public.inventory_items where deleted_at is null),
    'inventoryExpiring7', (select count(*) from public.inventory_items i cross join t
                           where i.deleted_at is null and i.expiration_date::date between t.today and t.today + 7),
    'usersWithCustomCategories', (select count(distinct account_id) from public.categories
      where lower(btrim(name)) not in ('food & drink', 'utilities', 'transport', 'home', 'rent & utilities', 'gold/silver',
                                       'etfs', 'telecom', 'crochet', 'fun', 'eating out', 'work', 'garden', 'other')),
    'usersWithCustomPaymentMethods', (select count(distinct account_id) from public.payment_methods
      where lower(btrim(name)) not in ('cash', 'card', 'food voucher', 't212', 'revolut', 'ubb', 'curve', 'paypal', 'vcb', 'other')),
    'retentionD30', (select case when eligible = 0 then null else kept::float8 / eligible end from ret)
  ),
  'lastActivity', jsonb_build_object(
    'at', (select ts from last),
    'kind', (select kind from last)
  )
);
$$;

revoke all on function dashboard.usage_stats() from public, anon, authenticated;
grant usage on schema dashboard to dashboard_reader;
grant execute on function dashboard.usage_stats() to dashboard_reader;
