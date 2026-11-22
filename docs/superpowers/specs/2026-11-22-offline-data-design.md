# Offline data — design

Date: 2026-11-22 · Status: draft · Branch: `feature/pwa`

## Why

Lifestyle OS is used on a phone in places with weak or no signal (a grocery-store basement, a train). The
installable PWA shell already opens offline (`public/sw.js`), but every list is empty and every save fails
without a connection, because all reads and writes go straight to Supabase (`src/lib/services.ts`). The
goal: with no signal you can still see your lists, log an expense and tick off a shopping item, and it all
reaches Supabase on its own once you are back online.

## Goals

- **View offline:** everything previously loaded — expenses (any month), shopping list, inventory, categories,
  payment methods — renders from data stored on the device.
- **Change offline (scope A):** add, edit, delete expenses; add, edit, delete and tick off shopping items.
  Changes show immediately and are sent to Supabase automatically, in the order made, once online.
- **Visible state:** a small badge when changes are waiting to sync (and when one failed).
- **Expired login (user's rule):** offline, keep working normally. Once online, if the session cannot be
  renewed, sign out.

## Non-goals

- Offline changes to inventory, categories, payment methods, settings — view-only offline; their edit
  controls are disabled with a short "needs a connection" hint.
- Receipt scanning offline (it calls `/api/scan-receipt`).
- Real-time push from the server (no Supabase Realtime); freshness comes from syncing on open/reconnect.
- Merging concurrent edits field by field.
- First sign-in on a new device without a connection.

## Anti-goals (failure even if it "works")

- An expense or shopping change made offline is ever silently lost.
- A retry creates a duplicate expense or shopping item.
- One account's cached data or queued changes are shown to, or sent as, a different account.
- Online use gets slower or flakier than today.

## Constraints

- Next.js 16 App Router; all data access is already client-side (supabase-js + RLS). Keep it that way.
- Single real user today, but sign-up is open: everything is scoped by the signed-in user id.
- Server facts: `expenses`, `shopping_lists`, `inventory_items` have `updated_at` maintained by triggers and
  soft-delete via `deleted_at`; `categories` / `payment_methods` are small and have no `updated_at` trigger.
  Ids are `uuid` with `default gen_random_uuid()`, so a client-supplied id is accepted.
- Never run `next build` / `next start` in the repo folder while the user's `next dev` runs (shared `.next/`).

## Approaches

1. **Own offline store on Dexie (picked by the user).** Dexie (small IndexedDB wrapper) holds a copy of
   each table plus an outbox of pending changes; pages read from the local copy; a sync loop pulls server
   changes and pushes the outbox. Most code, full control over the badge, sign-out and account rules.
2. TanStack Query with a persisted cache and paused mutations. Less code up front, but month-by-month
   expense queries, optimistic cross-month updates and the account rules fight the library; every page
   would be rewritten around it anyway.
3. A sync service (PowerSync, RxDB). PowerSync is an extra paid service next to Supabase; RxDB's good
   storages are paid and it is heavy for two writable tables and last-write-wins.

## Design

### Local store (Dexie, one database per signed-in user)

- Database name includes the user id (e.g. `lifestyleos-<userId>`), so accounts never share rows or queues.
- Tables mirroring the server rows: `expenses`, `shoppingItems`, `inventoryItems`, `categories`,
  `paymentMethods`. Plus `outbox` (pending changes) and `meta` (per-table sync cursor, last full sync).
- Soft-deleted rows are removed from the local copy (the UI never shows them).

### Reads

- Pages read from the local store through live queries (`dexie-react-hooks` `useLiveQuery`), so any
  write — local or from sync — re-renders the page. Expenses: query by `expense_date` range for the
  selected month (and the previous month for the comparison), same shapes as today.
- Categories / payment methods providers read from the local store too, so names resolve offline.

### Sync — pull

- Runs on app start (when signed in), when the browser comes back online, when the tab becomes visible
  again, and after the outbox drains.
- First run for a user on a device: download all non-deleted rows of the five tables.
- Afterwards, per table with `updated_at`: fetch rows with `updated_at > cursor` **including** soft-deleted
  ones (to learn about deletes from other devices); upsert or remove locally; advance the cursor to the max
  `updated_at` received. Categories and payment methods: refetch fully (small).
- **Local wins until sent:** a pulled row is not applied over a row that still has a pending outbox change;
  the outbox is pushed first, then that row is re-pulled.

### Writes — outbox and push

- Every scope-A change does three things atomically in one Dexie transaction: update the local row,
  append an outbox entry `{ id, table, rowId, op: upsert|delete, payload, createdAt, attempts, error }`.
- New rows get their id on the device (`crypto.randomUUID()`), plus `account_id` / `created_by_user_id`.
- Push drains the outbox oldest-first, one entry at a time:
  - create/edit → `upsert` on `id` (so a retry after a lost response is harmless — no duplicate);
  - delete → set `deleted_at` (soft delete, as today);
  - successful → remove the entry and store the server's returned row locally.
- Consecutive edits to the same row may be collapsed before sending (last payload wins); order across rows
  is preserved.
- Network failure / offline → stop and retry on the next trigger. Non-network errors → see Failures.
- Online behaviour stays snappy: the local write makes the UI update immediately; push happens right after.

### Failures

- **Missing reference** (Postgres `23503`, e.g. the expense's category or payment method was deleted on
  another device): clear that reference (`category_id` / `payment_method_id` → null) and retry once.
- **Any other rejection** (RLS, check constraint, 4xx): mark the entry failed, keep it, stop blocking the
  queue behind it, and show it in the badge with **Retry** and **Discard** actions. Never drop silently.

### Badge

- In the app shell (sidebar on desktop, near the tab bar / toolbar on phone): hidden when nothing is
  pending; "Offline · N changes waiting" or "Syncing…" or "1 change couldn't sync" (tap → retry/discard).

### Accounts and sign-out

- **Expired login while offline:** keep the last signed-in user and their local data working (the app must
  not drop to the login screen just because a token refresh failed for lack of network). Once online, if
  the refresh fails for a non-network reason, sign out (user's rule).
- **Queued changes survive sign-out:** the per-user database (outbox included) is kept. Signing back in as
  the same user pushes it. Signing in as a different user: that user gets their own database; the previous
  user's database is deleted.
- Explicit **Sign Out** with pending changes: confirm first ("N changes haven't synced yet and will be sent
  next time you sign in"). *(my call)*

### Other writers

- Receipt scanning stays online-only; on success its created expenses are also written to the local store.
- Inventory / categories / payment-method edits stay online-only (direct Supabase calls as today), then
  update the local copy; offline their controls are disabled.

### Security hardening (from the id-only review)

- New migration: unique `(account_id, id)` on `categories` and `payment_methods`, and composite FKs
  `expenses (account_id, category_id)` / `(account_id, payment_method_id)` with
  `on delete set null (category_id)` / `(payment_method_id)` (PG 15+), so an expense — including one synced
  from the outbox — can only reference its own account's category / payment method. Same local-Postgres
  test harness as the previous migration (`scripts/test-migrations.sh`).

### README

Per CLAUDE.md, update `README.md` in this branch: the installable PWA (manifest, service worker, how to
test offline), the local store + outbox + sync architecture, what works offline and what doesn't, the
sign-out / account rules, and the new migration.

## Left to the builder

File layout and module names; Dexie schema/indexes; how live queries are wrapped in hooks; how the auth
provider distinguishes network vs real refresh failures in supabase-js; badge styling (follow the
existing iOS-style UI); test approach (no JS test framework today — propose a minimal one only if the plan
needs it; otherwise typecheck, lint, the migration harness, and offline browser checks via Playwright on an
isolated production build in a scratchpad copy on :3100).
