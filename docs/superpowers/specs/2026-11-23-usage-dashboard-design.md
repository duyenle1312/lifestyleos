# Usage dashboard — design

Date: 2026-11-23 · Status: approved by the owner

## Intent

The owner of Lifestyle OS wants to see whether the app is useful to the people using it: how many users
there are, how many are actually active, when the last activity happened, and how much each feature
(expenses, shopping list, inventory) gets used. It is a private, read-only page the owner opens from a
laptop or phone.

## Goals

- A separate Next.js app in `/dashboard` (its own `package.json`), deployed as its own Vercel project with
  Root Directory `dashboard`.
- Shows only aggregates across all users. No emails, names, ids, item text, category names, locations or
  per-user rows ever leave the database.
- Looks like the approved mockup `docs/superpowers/mockups/expense_app_usage_performance_dashboard.html`
  (made by the owner with Gemini). That file is the visual reference.
- Fresh numbers on every page load.

## Non-goals

- No sign-in. Access control is an unlisted URL plus `noindex`. Accepted by the owner because the page holds
  no personal data.
- No new tracking in the main app (e.g. receipt scans are not counted — nothing records them today).
- No changes to the main app's code or its tables' columns.
- No currency conversion.

## Anti-goals (failure even if it works)

- Any personal data reachable from the dashboard, its network responses, or its database login.
- Using the Supabase service-role key, or anything in the dashboard project that could write to or read
  raw rows of the main database.
- A database function callable with the main app's public anon key.

## Constraints

- Next.js 16.4 (same as the main app — read `node_modules/next/dist/docs/` in `dashboard/` before writing
  code; this version differs from training data). React 19.
- Supabase Postgres with RLS; each user can only read their own rows, so cross-user counts need a
  privileged path (below).
- Repo rule: never run `next build` in the repo while the main app's dev server runs on :3000 — build in a
  scratch copy.

## Approaches considered

1. **Dedicated least-privilege database login (chosen).** A `security definer` SQL function returns only
   aggregates; a Postgres role `dashboard_reader` can do nothing except execute it. The dashboard connects
   as that role from the server. A leaked connection string exposes usage numbers only.
2. **Service-role key + the same function via supabase-js.** Simplest wiring, but the key can read/write
   everything; putting it in a second, unauthenticated project widens the blast radius. Rejected.
3. **Function callable with the anon key.** The anon key is in every user's browser, so anyone could pull
   the numbers. Dropped.

## Design

### Database (migration in the main repo: `supabase/migrations/20261123120000_dashboard_stats.sql`)

- New schema `dashboard`; `revoke all on schema dashboard from public, anon, authenticated`.
- Role `dashboard_reader` created `nologin` in the migration (no password in git). The owner then runs once
  in the Supabase SQL editor: `alter role dashboard_reader with login password '<generated>';`
  Grants: `usage on schema dashboard`, `execute on function dashboard.usage_stats()`. Nothing else —
  no access to `public`, `auth` or `admin` tables.
- `dashboard.usage_stats() returns jsonb`, `security definer`, `set search_path = ''` (fully-qualified
  names), owned by `postgres`, `revoke execute ... from public, anon, authenticated`.
- It returns, in one JSON document (shape fixed in the plan, typed in the dashboard):
  - `generated_at`.
  - **Daily series for the last 730 days** (Helsinki calendar days, `Europe/Helsinki`), one count per day
    for: sign-ups (`auth.users.created_at`), expenses added (`created_at`), expenses deleted
    (`deleted_at`), EUR amount added (sum of `amount` where `currency = 'EUR'`, by `created_at`, rows not
    deleted), shopping items created, ticked off, deleted, inventory items added, removed.
    The dashboard buckets these per day / week / month client-side, exactly like the mockup.
  - **Active users per bucket** for each view (30 daily, 12 weekly, 12 monthly buckets), because
    distinct-user counts cannot be summed from daily numbers.
  - Totals: users, active in last 7 / 30 days, all-time expense counts and EUR sum, other currencies as
    `[{currency, amount}]` (raw sums, not converted), shopping open now (not purchased, not deleted),
    inventory in stock now (not deleted), inventory expiring within 7 days (not deleted, `expiration_date`
    between today and today+7), users with ≥1 custom category, users with ≥1 custom payment method. **"Custom"** = a non-deleted row
    whose name is not in the seeded defaults (categories: the default set inserted by the sign-up trigger and
    the `20261121180000`/`20261121190000` backfills; payment methods: the sign-up trigger's Cash/Card and the
    backfill list in `20261121200000_payment_methods.sql`). Compare case-insensitively after trim. A renamed
    default counts as custom. The plan lists the exact name sets from those migrations.
  - D30 retention: of users who signed up 30+ days ago, the share with any activity 30 or more days after
    signing up.
  - Last activity: newest activity timestamp anywhere, and its kind (e.g. `expense`, `shopping`,
    `inventory`) — no row content.
- **Definition of "activity"** (owner's rule: everything that happens in the app) — used for active
  users, retention and last activity: any `created_at`, `updated_at` or `deleted_at` on a row in
  `expenses`, `shopping_lists`, `inventory_items`, `categories` or `payment_methods`, attributed by
  `account_id` (= the user id). Sign-ins are not activity (sessions last weeks). Rows written by
  migrations on 2026-11-21/22 also count; accepted by the owner (only two users existed then).
- **Everyone is counted**, including the owner's own account. No exclusion list.
- **Ticked off** has no timestamp in the schema; use `updated_at` of rows with `purchased = true`. Known
  approximation: an edit after ticking moves the date. Documented on the page in the tooltip / footnote.
- Deletes are soft everywhere (`deleted_at`), so deleted counts are exact.
- `shopping_lists` and `inventory_items` are not in `supabase/migrations` or `supabase/tests/stub_schema.sql`.
  The plan's first step reads their live definitions (columns, defaults, triggers) read-only via the
  Supabase MCP (`list_tables` / `information_schema`) and adds them to the stub schema.
- Covered by the existing migration test harness (`scripts/test-migrations.sh`, `supabase/tests/`):
  fixtures for a few users, assertions on the counts, and assertions that `anon` / `authenticated` cannot
  execute the function and `dashboard_reader` cannot `select` from any `public`/`auth` table.

### Dashboard app (`/dashboard`)

- Own `package.json`, lockfile, `tsconfig`, eslint config; Next.js 16.4 + React 19, TypeScript.
- Styling: the mockup's CSS ported into `app/globals.css` (same tokens as the main app plus the mockup's
  extras), components in plain React. No Tailwind needed; the mockup's class names can stay.
- `app/page.tsx` — server component, rendered dynamically per request. Calls `getStats()` and passes the
  JSON to a client component `<Dashboard stats=… />` that owns range / metric / theme state and does the
  bucketing, charts, sparklines and tooltips the mockup does.
- `lib/db.ts` — `server-only`; uses the `postgres` npm package with `DASHBOARD_DATABASE_URL` (Supabase
  pooler, transaction mode, port 6543, `prepare: false`, user `dashboard_reader.<project-ref>`). Runs
  `select dashboard.usage_stats()` and times it; the timing feeds the "DB 42ms" note (replaces the mockup's
  fake "API 42ms").
- **No env var → mock mode**: if `DASHBOARD_DATABASE_URL` is unset, `getStats()` returns generated mock
  data of the same shape, and the page shows a full-width orange banner at the very top ("Mock data — not
  connected to the database") plus the **MOCK DATA** pill next to the title. With real data neither is
  shown. This is what the page shows locally until `dashboard/.env.local` has the connection string, and
  on Vercel until the env var is set; it also lets tests run without credentials.
- **Error state**: if the query fails, render the page shell with a single card "Couldn't load stats"
  plus the error kind (no connection string or stack in the HTML).
- `noindex`: `robots` metadata (`noindex, nofollow`), `app/robots.ts` disallowing everything, and an
  `X-Robots-Tag: noindex` header in `next.config.ts`.
- Mapping from the mockup:
  - Header: title, subtitle, Light/Auto/Dark theme switch, 30 days / 12 weeks / 12 months switch.
  - KPI row: Total users (+new in period, active-users sparkline); Active 7d / 30d with stickiness %;
    Expenses logged in period with % change vs previous period, EUR volume and sparkline; Last activity
    ("3 min ago", kind, pulse dot, "DB 42ms"). The "99.98% uptime" badge is removed (nothing measures it).
  - Users & Retention, Expenses, Shopping List, Inventory & Setup cards with clickable stat tiles that
    switch the chart, exactly as the mockup.
- Tests: Vitest for the pure parts (bucketing, period sums, % change, formatting, "x min ago"), plus a
  Playwright check of the page in mock mode at 390px and 1200px.

### Deployment (done by the owner)

New Vercel project → import this repo → Root Directory `dashboard` → env var `DASHBOARD_DATABASE_URL`
(Production only). README gets a "Usage dashboard" section with these steps and the one-time SQL.

## Decided by the owner

- Separate Next.js app in `/dashboard`, separate Vercel project.
- No sign-in; obscure URL is enough.
- Least-privilege database role (approach 1).
- Visual design = the Gemini mockup, including EUR amounts per period.
- Activity = any create / update / delete in the app's tables; migration-era rows are fine.
- The owner's own account is counted.

## Calls made by the designer (correctable)

- Drop "uptime"; replace "API 42ms" with the measured stats-query time.
- Ticked-off date approximated by `updated_at`.
- "Custom" category / payment method = a name outside the seeded defaults.
- Week/month buckets are rolling windows ending today, as in the mockup.
- Mock mode when the env var is missing.
- Plain CSS ported from the mockup instead of Tailwind.

## Left to the builder

- Exact JSON shape and TypeScript types; SQL structure (CTEs, `generate_series`) and indexes if needed
  (data is small: ~1.2k expenses).
- Component split inside `/dashboard`.
- Daily series cover 730 days so the 12-month view can compare against the previous 12 months.
