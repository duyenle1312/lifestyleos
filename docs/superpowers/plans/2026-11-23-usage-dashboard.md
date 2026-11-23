# Usage Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A separate, no-sign-in Next.js app in `/dashboard` that shows aggregate usage of Lifestyle OS, fed by a least-privilege Postgres function.

**Architecture:** A migration in the main repo adds schema `dashboard` with a `security definer` function `dashboard.usage_stats()` returning one JSON document of aggregates, executable only by a new role `dashboard_reader`. The dashboard's server component connects as that role with the `postgres` package, times the call, and hands the JSON to one client component that does the bucketing, charts and switches of the approved mockup. Without a connection string it renders mock data behind a loud banner.

**Tech Stack:** Postgres 17 (Supabase), Next.js 16.4.6, React 19.3.0, TypeScript, `postgres` (porsager), `server-only`, Vitest 5.1.1, plain CSS.

**Spec:** `docs/superpowers/specs/2026-11-23-usage-dashboard-design.md` · **Visual reference:** `docs/superpowers/mockups/expense_app_usage_performance_dashboard.html`

## Global Constraints

- Only aggregates leave the database: no emails, names, ids, item text, category names, locations, per-user rows.
- Never use the Supabase service-role key; `dashboard_reader` may execute `dashboard.usage_stats()` and nothing else.
- `anon` and `authenticated` must not be able to execute the function or use schema `dashboard`.
- No password in git: the migration creates `dashboard_reader` as `nologin`.
- Day boundaries use `Europe/Helsinki`.
- Activity = any `created_at`, `updated_at` or `deleted_at` on `expenses`, `shopping_lists`, `inventory_items`, `categories`, `payment_methods`, attributed by `account_id`. Sign-ins are not activity. Everyone counts (owner included).
- Next.js 16.4.6 differs from training data: before writing Next code read the relevant guide under `dashboard/node_modules/next/dist/docs/` (rendering per request, metadata/robots, `headers` in `next.config.ts`).
- Never `next build` in the repo root while the main app's `next dev` runs on :3000. Building inside `dashboard/` is fine (separate `.next/`).
- Main app untouched except: migration + SQL tests, root `tsconfig.json` / `eslint.config.mjs` ignoring `dashboard/`, README.
- The page sends `noindex` three ways: robots metadata, `app/robots.ts`, `X-Robots-Tag` header.

## Review Focus

1. **Brand-new database / zero users or zero rows** — every number renders as `0` or `—`, no `NaN`, `Infinity` or crash (retention with no eligible users is `null` → `—`; % change with previous period 0 → no badge). Tests in Task 2 (`pctChange`, `ratio`) and Task 1 (empty-db assertion).
2. **Database unreachable / wrong password** — page renders the error card, HTML contains no connection string. Test in Task 3.
3. **Soft-deleted rows** — never counted as open, in stock, EUR tracked or custom. Fixtures in Task 1.
4. **Non-EUR and lowercase currency codes** (`eur`, `usd`) — `eur` counts as EUR; others listed raw. Fixture in Task 1.
5. **Phone width (390px)** — no horizontal scroll, header controls wrap, tooltips work on touch. Check in Task 4.

---

### Task 1: `dashboard.usage_stats()` migration + SQL tests

**Files:**
- Create: `supabase/migrations/20261123120000_dashboard_stats.sql`
- Modify: `supabase/tests/stub_schema.sql` (add `shopping_lists`, `inventory_items`)
- Create: `supabase/tests/dashboard_stats_fixtures.sql`, `supabase/tests/dashboard_stats_assert.sql`
- Modify: `scripts/test-migrations.sh`

**Interfaces:**
- Produces: `dashboard.usage_stats() returns jsonb` with exactly this shape (camelCase keys; Task 2's `UsageStats` type mirrors it):

```text
{
  generatedAt: timestamptz ISO,
  today: 'YYYY-MM-DD' (Helsinki),
  daily: {            -- each an int/numeric array of length 730; index 729 = today, index i = today - (729 - i)
    signups, expAdded, expDeleted, expEur, shopCreated, shopTicked, shopDeleted, invAdded, invDeleted
  },
  activeBuckets: { d30: int[30], w12: int[12], m12: int[12] },
  totals: {
    users, active7, active30,
    expensesAllTime, expensesDeletedAllTime, eurAllTime,
    otherCurrencies: [{ currency, amount }],   -- sorted by amount desc
    shoppingOpen, inventoryInStock, inventoryExpiring7,
    usersWithCustomCategories, usersWithCustomPaymentMethods,
    retentionD30: number 0..1 | null
  },
  lastActivity: { at: timestamptz | null, kind: 'expense'|'shopping'|'inventory'|'category'|'payment_method'|null }
}
```

Definitions the SQL must implement (from the spec):
- Day of a timestamp: `(ts at time zone 'Europe/Helsinki')::date`; `today = (now() at time zone 'Europe/Helsinki')::date`.
- `signups`: `auth.users.created_at`. `expAdded` / `shopCreated` / `invAdded`: `created_at`. `*Deleted`: `deleted_at`. `expEur`: sum of `amount` of non-deleted expenses with `upper(currency) = 'EUR'`, by `created_at` day. `shopTicked`: `updated_at` of rows with `purchased` true and `deleted_at` null.
- **Bucket bounds (shared with Task 2's `bucketBounds`)**: for range `R` and count `N` ∈ {(30,30), (84,12), (365,12)}, bucket `b` covers day indices `[730 - R + (b*R)/N, 730 - R + ((b+1)*R)/N)` with integer (floor) division. `activeBuckets` = count of distinct `account_id` with any activity on a day in the bucket.
- `active7` / `active30`: distinct accounts with activity on days `[today-6, today]` / `[today-29, today]`.
- `retentionD30`: among users with `created_at` day ≤ `today - 30`, share having any activity at `ts >= created_at + interval '30 days'`; `null` if none eligible.
- `shoppingOpen`: not purchased (`coalesce(purchased,false) = false`), not deleted. `inventoryInStock`: not deleted. `inventoryExpiring7`: not deleted and `expiration_date::date` between `today` and `today + 7`.
- `eurAllTime` / `otherCurrencies`: non-deleted expenses, all time; other = `upper(currency) <> 'EUR'`, grouped by `upper(currency)`.
- Custom = non-deleted row whose `lower(btrim(name))` is not in the defaults:
  - categories: Food & Drink, Utilities, Transport, Home, Rent & Utilities, Gold/Silver, ETFs, Telecom, Crochet, Fun, Eating Out, Work, Garden, Other
  - payment methods: Cash, Card, Food Voucher, T212, Revolut, UBB, Curve, Paypal, VCB, Other
  (`categories` / `payment_methods` have no `deleted_at` — every row is live.)
- `lastActivity`: the max activity timestamp and the table it came from.

Security (all in the migration, idempotent — the harness re-runs the newest migration):
- `create schema if not exists dashboard; revoke all on schema dashboard from public, anon, authenticated;`
- Create role `dashboard_reader nologin` only if missing (`do $$ … pg_roles … $$`).
- `create or replace function dashboard.usage_stats() returns jsonb language sql stable security definer set search_path = ''` (all names schema-qualified, incl. `pg_catalog` functions where needed).
- `revoke all on function dashboard.usage_stats() from public, anon, authenticated; grant usage on schema dashboard to dashboard_reader; grant execute on function dashboard.usage_stats() to dashboard_reader;`
- Header comment: the one-time owner step `alter role dashboard_reader with login password '…';` and the pooler username `dashboard_reader.<project-ref>`.

- [ ] **Step 1: Add the two tables to `stub_schema.sql`**, matching production exactly (read live 2026-11-23):

`shopping_lists`: `id uuid pk default gen_random_uuid()`, `account_id uuid not null`, `created_by_user_id uuid not null`, `item text not null`, `description text`, `metadata jsonb not null default '{}'`, `deleted_at timestamptz`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`, `location varchar`, `available_date_start date`, `available_date_end date`, `unit_price numeric`, `quantity integer`, `purchased boolean default false`, `scheduled_date date`, `priority smallint`; trigger `trg_shopping_lists_updated_at before update … set_updated_at()`.
`inventory_items`: `id uuid pk default gen_random_uuid()`, `account_id uuid not null`, `created_by_user_id uuid not null`, `name text not null`, `quantity numeric not null default 0`, `unit text`, `description text`, `metadata jsonb not null default '{}'`, `deleted_at timestamptz`, `created_at`/`updated_at timestamptz not null default now()`, `expiration_date timestamp` (without time zone); trigger `trg_inventory_updated_at`.

- [ ] **Step 2: Write `dashboard_stats_assert.sql` first** (runs after all migrations, after `dashboard_stats_fixtures.sql`). Use the existing assert files' style (`do $$ … raise exception 'FAIL: …' $$`). Assertions:
  - as `postgres`: `select dashboard.usage_stats()` returns `jsonb_array_length(daily->'expAdded') = 730` and each `activeBuckets` length 30/12/12.
  - fixture counts (fixture file below): `totals.users = 3`, `active7 = 2`, `active30 = 2`, `shoppingOpen = 1`, `inventoryInStock = 1`, `inventoryExpiring7 = 1`, `usersWithCustomCategories = 1`, `usersWithCustomPaymentMethods = 1`, `eurAllTime = 30` (10 + 20 from `EUR` and `eur`; the deleted 99 EUR excluded), `otherCurrencies = [{"currency":"USD","amount":5}]`, `expensesDeletedAllTime = 1`, `daily.expAdded[729] >= 2`, `lastActivity.kind is not null`.
  - `retentionD30 = 0.5` (two users signed up 60 days ago; one active 40 days after signup, one never after).
  - `set role anon; select dashboard.usage_stats()` raises `insufficient_privilege` — catch it and pass; same for `authenticated`. `reset role`.
  - `set role dashboard_reader;` function call succeeds; `select 1 from public.expenses limit 1` and `select 1 from auth.users limit 1` raise `insufficient_privilege`; `reset role`.
  - `select rolcanlogin from pg_roles where rolname = 'dashboard_reader'` is false.
- [ ] **Step 3: Write `dashboard_stats_fixtures.sql`** — inserted *after* all migrations (sign-up triggers will seed default categories/payment methods for new `auth.users` rows; that's expected and must not count as custom). Three users: A and B `created_at = now() - 60 days`, C `now() - 1 day`. A: expenses 10 `EUR` today, 20 `eur` today, 5 `USD` 40 days after signup, 99 `EUR` soft-deleted today; one custom category `Pets`; one custom payment method `Wise`; one renamed default is not needed. B: no rows after signup. C: one shopping item open, one ticked, one soft-deleted; inventory item expiring in 3 days, one soft-deleted. Then move every trigger-seeded `categories` / `payment_methods` row's `created_at` and `updated_at` to its user's `created_at` (those tables have no `updated_at` trigger), so seeding doesn't make A or B active today. Expected: active = A (today's expenses) and C (signed up yesterday) → 2; B inactive.
- [ ] **Step 4: Write `dashboard_stats_assert_empty.sql`** (Review Focus 1). The harness's existing fixtures add users, so run it against a *second* throwaway database: create db `empty`, apply `stub_schema.sql` and all migrations only, then assert `totals.users = 0`, `retentionD30 is null`, `lastActivity.at is null`, `otherCurrencies = []`, every `daily` array all zeros.
- [ ] **Step 5: Wire into `scripts/test-migrations.sh`**: after the existing asserts, `run dashboard_stats_fixtures.sql` then psql `-t -f dashboard_stats_assert.sql`; then the `empty` database pass from Step 4. Keep the existing idempotence re-run of the newest migration (which will be this one).
- [ ] **Step 6: Run `bash scripts/test-migrations.sh`** → FAIL (function missing).
- [ ] **Step 7: Write the migration** per the Interfaces block.
- [ ] **Step 8: Run `bash scripts/test-migrations.sh`** → `ALL MIGRATION TESTS PASSED`.
- [ ] **Step 9: Commit** `supabase/ scripts/test-migrations.sh` — "Dashboard stats function and read-only role".

### Task 2: Scaffold `/dashboard` + stats types and pure helpers

**Files:**
- Create: `dashboard/package.json`, `dashboard/tsconfig.json`, `dashboard/next.config.ts`, `dashboard/eslint.config.mjs`, `dashboard/vitest.config.mts`, `dashboard/.gitignore`, `dashboard/.env.example`, `dashboard/next-env.d.ts`
- Create: `dashboard/lib/types.ts`, `dashboard/lib/stats.ts`, `dashboard/lib/stats.test.ts`
- Modify: root `tsconfig.json` (`exclude` add `"dashboard"`), root `eslint.config.mjs` (`globalIgnores` add `"dashboard/**"`)

**Interfaces:**
- Produces (`lib/types.ts`): `UsageStats` (mirrors Task 1 JSON exactly), `Range = 30 | 84 | 365`, `StatsResult = { kind: "db"; stats: UsageStats; dbMs: number } | { kind: "mock"; stats: UsageStats } | { kind: "error"; reason: "connect" | "query" }`, `DailyKey = keyof UsageStats["daily"]`.
- Produces (`lib/stats.ts`):
  - `DAYS = 730`
  - `bucketBounds(range: Range): Array<[start: number, end: number]>` — Task 1's formula, N = 30/12/12.
  - `bucketSums(series: number[], range: Range): number[]`
  - `periodSum(series: number[], range: Range, offset = 0): number` — `offset = 1` is the previous period.
  - `pctChange(cur: number, prev: number): number | null` — `null` when `prev === 0`.
  - `ratio(n: number, d: number): number | null` — `null` when `d === 0`.
  - `activeFor(stats: UsageStats, range: Range): number[]` → `d30` / `w12` / `m12`.
  - `bucketStartDate(today: string, index: number): Date` — day index → date (local noon, avoids DST shifts).
  - `fmt(n: number): string` (`en-GB`, rounded), `eur(n: number): string` (`€1,234`), `pct(r: number | null): string` (`"64%"` / `"—"`).
  - `timeAgo(at: string, now: string): string` — `"just now"` < 1 min, `"3 min ago"`, `"2 h ago"`, `"5 days ago"`.

- [ ] **Step 1: Create `package.json`** — name `lifestyleos-dashboard`, private; scripts `dev` (`next dev -p 3001`), `build`, `start`, `lint` (`eslint`), `test` (`vitest run`); deps `next@16.4.6`, `react@19.3.0`, `react-dom@19.3.0`, `postgres` (latest 3.x), `server-only`; devDeps matching the root (`typescript`, `@types/node@^22`, `@types/react@^19`, `@types/react-dom@^19`, `eslint@^9`, `eslint-config-next@16.4.6`, `vitest@5.1.1`). `npm install` inside `dashboard/`. Copy root `tsconfig.json` / `eslint.config.mjs` conventions with `@/*` → `./*`. `vitest.config.mts`: include `**/*.test.ts`, alias `server-only` to an empty module, env `TZ=Europe/Helsinki`. `.gitignore`: `.next`, `node_modules`, `.env*.local`. `.env.example`: `DASHBOARD_DATABASE_URL=postgres://dashboard_reader.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`. If Next warns about multiple lockfiles, set the turbopack root to the dashboard dir per the docs.
- [ ] **Step 2: Exclude `dashboard/` from the root** tsconfig and eslint; `npx tsc --noEmit` and `npm run lint` at root still pass.
- [ ] **Step 3: Write `stats.test.ts`:**
  - `bucketBounds(30)` has 30 entries, first `[700, 701]`, last `[729, 730]`; `bucketBounds(84)` 12 entries each 7 wide, last ends at 730; `bucketBounds(365)` 12 entries, first starts at 365, last ends at 730, widths sum to 365.
  - `bucketSums(Array(730).fill(1), 84)` → twelve `7`s.
  - `periodSum(ones, 30) === 30`, `periodSum(ones, 365, 1) === 365`.
  - `pctChange(120, 100) === 20`, `pctChange(5, 0) === null`, `ratio(1, 0) === null`, `pct(null) === "—"`, `pct(0.638) === "64%"`.
  - `eur(17056.4) === "€17,056"`, `fmt(1234) === "1,234"`.
  - `timeAgo` cases: 30 s → `"just now"`, 3 min → `"3 min ago"`, 2 h → `"2 h ago"`, 5 days → `"5 days ago"`.
- [ ] **Step 4: `npm test` in `dashboard/`** → FAIL.
- [ ] **Step 5: Implement `lib/types.ts` and `lib/stats.ts`.**
- [ ] **Step 6: `npm test`** → PASS; `npx tsc --noEmit` → clean.
- [ ] **Step 7: Commit** — "Dashboard app scaffold and stats helpers".

### Task 3: `getStats()` — db, mock and error paths

**Files:**
- Create: `dashboard/lib/mock.ts`, `dashboard/lib/getStats.ts`, `dashboard/lib/getStats.test.ts`

**Interfaces:**
- Consumes: `UsageStats`, `StatsResult`, `DAYS` (Task 2).
- Produces: `mockStats(now: Date): UsageStats` (deterministic seed, port of the mockup's generator; every `daily` array length 730, `activeBuckets` 30/12/12); `getStats(env = process.env): Promise<StatsResult>` in a `server-only` module.

- [ ] **Step 1: Write `getStats.test.ts`:**
  - no `DASHBOARD_DATABASE_URL` → `{ kind: "mock" }` and `stats.daily.expAdded.length === 730`.
  - `DASHBOARD_DATABASE_URL = "postgres://u:secretpw@127.0.0.1:1/postgres"` → `{ kind: "error", reason: "connect" }`, and `JSON.stringify(result)` does not contain `"secretpw"` (Review Focus 2).
  - `mockStats(new Date("2026-11-23T10:00:00Z"))` called twice gives deep-equal results.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** `getStats` uses `postgres(url, { prepare: false, max: 1, connect_timeout: 5, idle_timeout: 5 })`, runs `select dashboard.usage_stats() as s`, measures with `performance.now()` around the query only, closes the client in `finally`. Connection errors (ECONNREFUSED, ETIMEDOUT, auth failure `28P01`) → `"connect"`; anything else → `"query"`. Log the error server-side with `console.error` (message only, never the URL).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — "Dashboard data loading with mock and error fallbacks".

### Task 4: The page — port the mockup

**Files:**
- Create: `dashboard/app/layout.tsx`, `dashboard/app/page.tsx`, `dashboard/app/globals.css`, `dashboard/app/robots.ts`, `dashboard/components/Dashboard.tsx` (+ any sub-components the implementer splits out under `dashboard/components/`)
- Modify: `dashboard/next.config.ts` (`headers()` → `X-Robots-Tag: noindex, nofollow` on `/:path*`)

**Interfaces:**
- Consumes: `getStats()` (Task 3); everything in `lib/stats.ts` (Task 2).
- Produces: `<Dashboard result={StatsResult} />` client component.

Behaviour (the mockup is the reference for markup, CSS and interactions — port its CSS into `globals.css` verbatim, keep its class names):
- `layout.tsx`: `metadata = { title: "Usage · Lifestyle OS", robots: { index: false, follow: false } }`, `<html lang="en">`.
- `page.tsx`: server component rendered per request (use the Next 16 mechanism from the docs — no caching), `const result = await getStats()`, renders `<Dashboard result={result} />`.
- `robots.ts`: disallow `/` for all agents.
- Mock mode: full-width orange banner as the first element of the page, text **"Mock data — not connected to the database"**, plus the mockup's `MOCK DATA` pill. Real data: neither.
- Error mode: header + one card "Couldn't load stats" with `Can't reach the database` (connect) or `The stats query failed` (query). No KPI or sections.
- Header: title "Usage & Performance", subtitle "Lifestyle OS · Aggregated metrics only, zero PII", theme switch (Light / Auto / Dark → `data-theme` on `<html>`, in-memory), range switch 30 days / 12 weeks / 12 months (default 12 weeks).
- KPI row as the mockup, with real numbers: Total users (`+N new` = `periodSum(signups)`, sparkline of last 10 `activeFor` buckets); Active users `active7 / active30` with `ratio(active7, active30)` "sticky" badge; Expenses logged = `periodSum(expAdded)` with `pctChange` vs previous period (badge hidden when `null`), `eur(periodSum(expEur))` EUR volume, sparkline of last 10 `bucketSums(expEur)`; Last activity = `timeAgo(lastActivity.at, generatedAt)` (or "No activity yet"), kind label (`expense` → "Expense", `shopping` → "Shopping item", `inventory` → "Inventory item", `category` → "Category", `payment_method` → "Payment method"), pulse dot, and `DB {dbMs}ms` in db mode (omit in mock). **No uptime badge.**
- Sections exactly as the mockup (Users & Retention, Expenses, Shopping List, Inventory & Setup), tiles switching the chart, using: `bucketSums` of the matching daily series; Users "Active users" tile/chart uses `activeFor`; retention from `totals.retentionD30` via `pct`; "Per active user" = `periodSum(expAdded) / active30 / (range / 30)` (`—` when `active30 = 0`); currency pills from `otherCurrencies` (hide the strip when empty); shopping split bar from period ticked / deleted and `shoppingOpen`; inventory pill `"{inventoryInStock} items tracked"`, expiring badge `inventoryExpiring7`; custom rows `usersWithCustom… of users`.
- Chart tooltip for "Ticked off" adds the line "Dated by last edit" (spec: approximation documented).
- Bar chart dates: from `bucketStartDate(stats.today, start)` / end.

- [ ] **Step 1: Read the Next 16 docs** for per-request rendering, `metadata.robots`, `app/robots.ts`, `headers`.
- [ ] **Step 2: Implement the files above.**
- [ ] **Step 3: `npx tsc --noEmit`, `npm run lint`, `npm test`** in `dashboard/` → clean.
- [ ] **Step 4: Run `npm run dev` in `dashboard/` (port 3001, no env file → mock)** and check with Playwright MCP:
  - 1200×900 light and dark: banner visible, four KPI cards, four sections; clicking each tile changes the chart title; each range button changes numbers and the x-axis labels.
  - 390×844: `document.documentElement.scrollWidth <= 390` (Review Focus 5), header controls wrap, banner readable.
  - `curl -sI localhost:3001` shows `x-robots-tag: noindex, nofollow`; `curl -s localhost:3001/robots.txt` disallows `/`; HTML has `<meta name="robots" content="noindex, nofollow">`.
  - With `DASHBOARD_DATABASE_URL=postgres://u:p@127.0.0.1:1/postgres npm run dev` the error card shows and the page source does not contain `postgres://`.
  - Screenshots to `.playwright-mcp/` (gitignored).
- [ ] **Step 5: `npm run build` inside `dashboard/`** → succeeds (separate `.next/`, safe beside the main dev server).
- [ ] **Step 6: Commit** — "Dashboard page ported from the mockup".

### Task 5: README — dashboard and database schema

**Files:**
- Modify: `README.md` (Contents list, new sections, Testing section)
- Create: `dashboard/README.md` (short: run, env, deploy — links to root README)

- [ ] **Step 1: Add a "Database schema" section** to the root README: one table per app table — `accounts`, `account_users`, `expenses`, `categories`, `payment_methods`, `shopping_lists`, `inventory_items` — with columns, types and a one-line purpose, plus soft-delete (`deleted_at`) notes. Then sub-sections listing **everything else in the database the app owns**, each item with a one-line purpose and the migration that created it:
  - **Schemas**: `public`, `admin`, `dashboard` (who can use each).
  - **Functions**: every function in `public`, `admin`, `dashboard` (name, arguments, `security definer` or not, who may execute).
  - **Triggers**: every trigger on `public` tables and on `auth.users` (table, timing/event, function).
  - **Views**: `admin.users` and any others.
  - **Roles**: `dashboard_reader` (and that `anon` / `authenticated` are Supabase's API roles).
  Source of truth: the live database via Supabase MCP `execute_sql`, read-only queries on `information_schema.columns`, `information_schema.triggers` (schemas `public` and `auth`, filtered to app-created triggers), `information_schema.routines` / `pg_proc` (schemas `public`, `admin`, `dashboard`), `information_schema.views`, `pg_roles` (non-system roles). Run after the owner applies Task 1's migration (Task 6 Step 1) — or list `dashboard.*` from the migration file if that hasn't happened yet. The repo's migrations don't define `shopping_lists`, `inventory_items` or the original `expenses`. No row data.
- [ ] **Step 2: Add a "Usage dashboard" section**: what it shows, the activity definition, privacy model (aggregates only, `dashboard_reader` can only run one function, no sign-in, `noindex`), local run (`cd dashboard && npm install && npm run dev` → mock banner until `dashboard/.env.local` has the URL), one-time setup (apply the migration in the SQL editor; `alter role dashboard_reader with login password '<generated>';`; connection string `postgres://dashboard_reader.<project-ref>:<password>@<pooler-host>:6543/postgres` from Supabase → Connect → Transaction pooler), deploy (new Vercel project, Root Directory `dashboard`, env var `DASHBOARD_DATABASE_URL`, Production).
- [ ] **Step 3: Testing section**: add `cd dashboard && npm test`, and note the migration script now also checks the dashboard function and role.
- [ ] **Step 4: Commit** — "README: usage dashboard and database schema".

### Task 6: Go live (with the owner)

- [ ] **Step 1: Owner applies** `20261123120000_dashboard_stats.sql` in the Supabase SQL editor and runs the setup SQL with a generated URL-safe password (`openssl rand -hex 24`, run by the owner): `alter role dashboard_reader with login password '<generated>' connection limit 3;` and `alter role dashboard_reader set statement_timeout = '10s';`. The connection uses TLS (`ssl: "require"` in code), so no `?sslmode` is needed.
- [ ] **Step 2: Verify read-only** via Supabase MCP `execute_sql`: `select dashboard.usage_stats()->'totals'` returns plausible numbers (users ≥ 2, expensesAllTime ≈ 1.2k).
- [ ] **Step 3: Owner puts the connection string in `dashboard/.env.local`**; `npm run dev` in `dashboard/` shows real numbers, no banner, `DB …ms` present.
- [ ] **Step 4: Owner creates the Vercel project** (Root Directory `dashboard`, env var) and opens the URL.
