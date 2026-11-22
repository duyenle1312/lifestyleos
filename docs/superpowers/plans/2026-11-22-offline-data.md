# Offline Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expenses and the shopping list work fully offline (view + add/edit/delete/tick), everything else is viewable offline, and queued changes sync to Supabase automatically.

**Architecture:** A per-user Dexie (IndexedDB) database mirrors five tables plus an `outbox`. Pages read through live queries; scope-A writes go local row + outbox entry in one transaction. A sync engine pushes the outbox (upsert on client ids, receipt as one bulk upsert) and pulls server changes by `updated_at`, behind an injected `Remote` interface so the core is unit-tested with fake-indexeddb.

**Tech Stack:** Next.js 16 (client components), supabase-js, Dexie 4, dexie-react-hooks, Vitest + fake-indexeddb (new, tests only), local Postgres harness for the migration.

**Spec:** `docs/superpowers/specs/2026-11-22-offline-data-design.md`

## Global Constraints

- Exact new dependencies: `dexie@4.4.7`, `dexie-react-hooks@4.4.0`; dev: `vitest@5.1.1`, `fake-indexeddb@6.2.8`. No others.
- Never run `next build` / `next start` / `next dev` in the repo or worktree used by the user's dev server; production/offline browser checks only in a scratchpad copy on :3100 (rsync without `.next`/`node_modules`/`.git`, `cp -Rc node_modules`).
- Everything local is scoped per user: database name `lifestyleos-<userId>`.
- Never silently drop a queued change. Never create duplicates on retry. Never show/send one account's data as another.
- Edit vs. remote delete: **the edit wins** (`deleted_at` → null) and appends to `metadata.restored_after_delete` `[{ deleted_at, restored_at }]` without overwriting other metadata keys.
- Different user signs in: delete another user's local database **only if its outbox is empty**.
- Never edit existing `supabase/migrations/*` files.
- Per CLAUDE.md, README is updated in this branch (Task 9).
- Commit messages end with a blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **App opened offline with an expired access token** — must show the last user's data, not the login screen. Test: Task 6 unit test on `resolveInitialUser`.
2. **Response lost after the server applied an upsert** (retry sends the same entry again) — no duplicate row. Test: Task 3 `retry after lost response`.
3. **Two quick edits to the same item offline, then online** — one request with the latest values, no stale overwrite. Test: Task 2 collapse test.
4. **Expense saved at 23:30 on the last day of a month in a non-UTC timezone** — shows in the correct month offline and online. Test: Task 2 `_ts` test.
5. **Pull while a local change for the same row is pending** — the local change is not overwritten. Test: Task 4 `local wins until sent`.

---

### Task 1: Same-account composite foreign keys

**Files:**
- Create: `supabase/migrations/20261122170000_expenses_same_account_refs.sql`
- Modify: `supabase/tests/` (add `expenses_same_account_assert.sql` or extend existing assert file), `scripts/test-migrations.sh` (run it)

**Interfaces:** Produces DB constraints only.

- [ ] **Step 1: Assertions** — after migrations: unique `(account_id, id)` exists on `categories` and `payment_methods`; inserting an expense for user A with B's `category_id` (and separately B's `payment_method_id`) raises `23503`; deleting A's category sets that expense's `category_id` null **and keeps `account_id`**; same for payment method; migration runs twice cleanly.
- [ ] **Step 2: Run `bash scripts/test-migrations.sh`** → FAIL.
- [ ] **Step 3: Migration** — idempotent (`if not exists` / `do $$` guards on `pg_constraint`): add unique constraints `categories_account_id_id_key`, `payment_methods_account_id_id_key`; drop the single-column FKs on `expenses.category_id` / `expenses.payment_method_id` (look up names in `pg_constraint`); add `expenses_category_same_account_fkey foreign key (account_id, category_id) references categories (account_id, id) on delete set null (category_id)` and `expenses_payment_method_same_account_fkey` likewise with `(payment_method_id)`. No CASCADE.
- [ ] **Step 4: Run harness** → `ALL MIGRATION TESTS PASSED`.
- [ ] **Step 5: Commit** `Migration: expenses may only reference their own account's categories and payment methods`.

---

### Task 2: Local database and offline mutations

**Files:**
- Modify: `package.json` (deps above; script `"test": "vitest run"`)
- Create: `vitest.config.ts` (environment `node`, setupFiles `fake-indexeddb/auto`, alias `@` → `src`)
- Create: `src/lib/offline/db.ts`, `src/lib/offline/mutations.ts`
- Test: `src/lib/offline/mutations.test.ts`

**Interfaces:**
- Produces (`db.ts`):
  - `type LocalExpense = Expense & { _ts: number }` (`_ts = Date.parse(expense_date)`)
  - `type OutboxEntry = { seq?: number; table: "expenses" | "shopping_lists"; op: "upsert" | "delete" | "upsertMany"; rowId: string | null; payload: Record<string, unknown> | Record<string, unknown>[]; createdAt: number; attempts: number; status: "pending" | "failed"; error: string | null }`
  - `class LocalDb extends Dexie` with tables `expenses` (`id, _ts`), `shoppingItems` (`id`), `inventoryItems` (`id`), `categories` (`id`), `paymentMethods` (`id`), `outbox` (`++seq, rowId, status`), `meta` (`key`)
  - `openUserDb(userId: string): LocalDb` (name `lifestyleos-${userId}`); `toLocalExpense(row: Expense): LocalExpense`
- Produces (`mutations.ts`) — each writes the local row and enqueues in **one** Dexie transaction:
  - `saveExpense(db, userId, input: ExpenseInput, id?: string): Promise<LocalExpense>` (new → `crypto.randomUUID()`, sets `account_id`, `created_by_user_id`, `metadata: {}`, `deleted_at: null`, timestamps)
  - `deleteExpense(db, id): Promise<void>` (removes local row; enqueues `delete`)
  - `saveShoppingItem(db, userId, input: Partial<ShoppingInput> & ..., id?: string): Promise<ShoppingItem>`; `deleteShoppingItem(db, id)`
  - `saveReceipt(db, userId, rows: ExpenseInput[]): Promise<LocalExpense[]>` — one `upsertMany` entry, `rowId: null`
  - Collapse rule in the enqueue helper: a new `upsert` for a `rowId` that has a `pending` entry with `attempts === 0` merges into it (later fields win); a `delete` replaces any such pending upserts for that row with a single `delete`.

- [ ] **Step 1: Tests** — `saveExpense` creates row with uuid id + one outbox `upsert`; editing twice before sync leaves **one** entry with the second values (Review Focus 3); edit after delete-pending is unaffected rows-wise; `deleteExpense` on a pending-create row leaves a single `delete`; `saveReceipt` of 3 rows → 3 local rows, exactly one `upsertMany` entry with 3 payloads; `toLocalExpense` for `"2026-11-30T23:30:00+02:00"` gives `_ts` within November local month bounds (Review Focus 4); two users' databases are separate (row saved for A not visible in B's db).
- [ ] **Step 2: `npm test`** → FAIL. **Step 3: Implement.** **Step 4: `npm test`** → PASS; `npx tsc --noEmit && npx eslint src` clean.
- [ ] **Step 5: Commit** `Offline store: per-user Dexie database and queued mutations`.

---

### Task 3: Push the outbox

**Files:** Create `src/lib/offline/remote.ts` (interface + `isRetryable`), `src/lib/offline/push.ts`; Test `src/lib/offline/push.test.ts` (fake `Remote`)

**Interfaces:**
- Consumes: Task 2 `LocalDb`, `OutboxEntry`.
- Produces:
  - `interface Remote { upsert(table, rows: object[]): Promise<object[]>; softDelete(table, id: string): Promise<void>; fetchRow(table, id: string): Promise<object | null>; fetchChangedSince(table, cursor: string | null): Promise<object[]>; fetchAll(table: "categories" | "payment_methods", accountId: string): Promise<object[]> }` — errors thrown as `RemoteError { code?: string; status?: number; message: string }`
  - `isRetryable(e: unknown): boolean` — true for network failures (no `code` and no 4xx `status`, or `TypeError: Failed to fetch`)
  - `pushOutbox(db: LocalDb, remote: Remote): Promise<{ sent: number; failed: number; notices: string[] }>`
- Behaviour: oldest-first by `seq`; skips `failed` entries and any later entry with the same `rowId` as a failed one; `upsert` payload = local row without `updated_at`, with `deleted_at: null`; before an `upsert` of an existing row, `fetchRow` — if it has `deleted_at`, merge its `metadata` and append `{ deleted_at, restored_at: now }` to `restored_after_delete`, push a notice "1 item restored — it had been deleted on another device"; `upsertMany` → one `remote.upsert` call with all rows; `delete` → `softDelete`; success → delete entry, write returned row(s) locally (via `toLocalExpense` for expenses); retryable error → stop, leave entry; `23503` → null `category_id`/`payment_method_id` in payload and retry once, then fail; other errors → `status: "failed"`, `error` = message, `attempts++`, continue.

- [ ] **Step 1: Tests** — order preserved; `retry after lost response` (fake remote applies upsert then throws network error; second push sends the same id; fake server holds one row — Review Focus 2); network error stops and keeps entry; `23503` path nulls refs and succeeds; RLS-style `42501` marks failed and the next unrelated entry still sends; entry behind a failed one for same row is not sent; remote-deleted row is restored with `restored_after_delete` appended and other metadata keys kept; `upsertMany` makes exactly one remote call.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS + tsc/eslint.**
- [ ] **Step 5: Commit** `Offline sync: push queued changes`.

---

### Task 4: Pull and the sync engine

**Files:** Create `src/lib/offline/pull.ts`, `src/lib/offline/engine.ts`; Test `src/lib/offline/pull.test.ts`, `src/lib/offline/engine.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces:
  - `pullAll(db: LocalDb, remote: Remote, userId: string): Promise<void>` — per synced table (`expenses`, `shopping_lists`, `inventory_items`): cursor in `meta` (`cursor:<table>`); `fetchChangedSince(table, cursor)` returns rows with `updated_at >= cursor` **including soft-deleted**; skip rows whose id has a pending/failed outbox entry (Review Focus 5); `deleted_at` set → delete locally, else put (expenses via `toLocalExpense`); cursor = max `updated_at` seen. `categories`/`payment_methods`: `fetchAll`, replace local table.
  - `type SyncStatus = { online: boolean; syncing: boolean; pending: number; failed: OutboxEntry[]; notices: string[] }`
  - `class SyncEngine { constructor(db, remote, userId, isOnline: () => boolean); start(): void /* listens to online + visibilitychange, runs syncNow */; stop(): void; syncNow(): Promise<void> /* push → pull, single-flight */; subscribe(fn: (s: SyncStatus) => void): () => void; getStatus(): SyncStatus; retry(seq: number): Promise<void>; discard(seq: number): Promise<void>; dismissNotice(i: number): void }`

- [ ] **Step 1: Tests** — first pull fills empty db; delta pull removes a row soft-deleted remotely; `local wins until sent`; categories replaced fully; cursor advances; `syncNow` concurrent calls run once; push happens before pull; `retry` resets a failed entry to pending and syncs; `discard` removes it and re-pulls that row; status `pending` counts reflect outbox.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS + tsc/eslint.**
- [ ] **Step 5: Commit** `Offline sync: pull server changes and sync engine`.

---

### Task 5: Supabase remote, OfflineProvider and the badge

**Files:** Create `src/lib/offline/supabaseRemote.ts`, `src/components/OfflineProvider.tsx`, `src/components/SyncBadge.tsx`, `src/lib/useOnline.ts`; Modify `src/components/AppShell.tsx`

**Interfaces:**
- Produces:
  - `supabaseRemote: Remote` (supabase-js; `upsert(rows, { onConflict: "id" }).select()`; `fetchChangedSince` uses `.gte("updated_at", cursor)` without a `deleted_at` filter, ordered by `updated_at`; errors mapped to `RemoteError`)
  - `useOnline(): boolean`
  - `<OfflineProvider>` (inside the signed-in shell, wraps Categories/PaymentMethods providers): opens `openUserDb(user.id)`, starts `SyncEngine`; context hooks `useLocalDb(): LocalDb`, `useSyncStatus(): SyncStatus`, `useSync(): Pick<SyncEngine, "syncNow" | "retry" | "discard" | "dismissNotice">`
  - `<SyncBadge />`: hidden when online, nothing pending/failed, no notices; texts: `Offline · ${n} change(s) waiting`, `Syncing…`, `${n} change(s) couldn't sync` (tap → sheet listing each with Retry / Discard), notices shown with dismiss. Placement: bottom of the desktop sidebar; above the mobile tab bar. Follow existing `ui.tsx` styles.
- [ ] **Step 1:** Implement; `npx tsc --noEmit && npx eslint src && npm test` clean.
- [ ] **Step 2:** Commit `Offline sync wired into the app shell with a sync badge`.

---

### Task 6: Auth offline session and account rules

**Files:** Modify `src/components/AuthProvider.tsx`, `src/app/settings/page.tsx`; Create `src/lib/offline/session.ts`; Test `src/lib/offline/session.test.ts`

**Interfaces:**
- Produces:
  - `rememberUser(user: User): void` / `forgetRememberedUser(): void` (localStorage key `lifestyleos:lastUser`, minimal `{ id, email, user_metadata }`)
  - `resolveInitialUser(session: Session | null, error: unknown, online: boolean): User | null` — session → its user; no session and (`!online` or `isRetryable(error)`) → remembered user; otherwise null
  - `cleanupOtherUserDbs(currentUserId: string): Promise<void>` — for each `lifestyleos-*` database (Dexie `getDatabaseNames`) other than current: delete if its outbox is empty, else keep
  - AuthProvider: uses `resolveInitialUser`; exposes `isOfflineSession: boolean`; when an offline-session user comes online, calls `supabase.auth.refreshSession()` — non-retryable failure → sign out (user's rule); runs `cleanupOtherUserDbs` on `SIGNED_IN`.
  - Settings Sign Out: if `useSyncStatus().pending + failed.length > 0`, confirm with Alert: "N changes haven't synced yet. They'll be sent next time you sign in." (buttons Cancel / Sign Out). Explicit sign-out calls `forgetRememberedUser()`; the user database is kept.
- [ ] **Step 1: Tests** — `resolveInitialUser` returns remembered user when offline with null session (Review Focus 1), returns null when online and the error is non-retryable; `cleanupOtherUserDbs` deletes a clean db and keeps one with a pending entry.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS + tsc/eslint.**
- [ ] **Step 5: Commit** `Offline session: keep working with an expired login; per-account local data rules`.

---

### Task 7: Expenses, shopping and scan use the local store

**Files:** Modify `src/app/expenses/page.tsx`, `src/app/shopping/page.tsx`, `src/app/scan/page.tsx`, `src/lib/services.ts` (remove now-unused expense/shopping write functions and `createExpensesFromReceipt`, or keep only what other code still uses)

**Interfaces:** Consumes `useLocalDb`, Task 2 mutations, `useSync().syncNow`.
- Expenses page: `useLiveQuery` on `db.expenses.where("_ts").between(startOfMonth, startOfNextMonth, true, false)` (and previous month for the split-view comparison); `loading` = live query undefined; add/update/remove call `saveExpense` / `deleteExpense` then `syncNow()` (not awaited). Keep all existing UI behaviour.
- Shopping page: `useLiveQuery(db.shoppingItems.toArray())`, sorted by `created_at` desc; writes via `saveShoppingItem` / `deleteShoppingItem` (tick = `saveShoppingItem` with `purchased` toggled).
- Scan save: build `ExpenseInput[]` (ids resolved via `idByName` as today) → `saveReceipt` → `syncNow()`; success screen shows immediately. Scan button disabled offline with hint "Scanning needs a connection".
- [ ] **Step 1:** Implement; `npx tsc --noEmit && npx eslint src && npm test` clean.
- [ ] **Step 2:** Commit `Expenses, shopping and receipt saving work offline`.

---

### Task 8: Read-only offline for inventory, categories, payment methods

**Files:** Modify `src/components/CategoriesProvider.tsx`, `src/components/PaymentMethodsProvider.tsx`, `src/app/inventory/page.tsx`, `src/app/inventory/[id]/page.tsx`, settings category/payment-method pages

- Providers read from `db.categories` / `db.paymentMethods` via live queries (sorted by `sort_order`, `created_at`); their write functions stay online (existing services) and then put/delete the returned row locally.
- Inventory list/detail read from `db.inventoryItems`; writes stay online then update locally.
- When `!useOnline()`: add/edit/delete/rename controls on these screens are disabled, with the hint "Needs a connection".
- [ ] **Step 1:** Implement; tsc/eslint/test clean.
- [ ] **Step 2:** Commit `Inventory and settings readable offline; edits need a connection`.

---

### Task 9: README and offline verification

**Files:** Modify `README.md`

- [ ] **Step 1: README** — sections: installable PWA (manifest, service worker, how to test offline), offline data architecture (per-user Dexie db, outbox, push/pull triggers, edit-wins rule with `restored_after_delete`, receipt as one bulk upsert), what works offline vs needs a connection, sign-out/account rules, `npm test`, the two new migrations.
- [ ] **Step 2: Browser check (controller, isolated build on :3100 against the real database after Task 1's migration is applied with user approval)** — Playwright: signed in, load expenses + shopping; go offline; add an expense, edit it, tick a shopping item, delete one; reload offline → still there, badge shows waiting count; go online → badge clears, rows exist once in Supabase; two-month navigation offline works.
- [ ] **Step 3: Commit** `README: PWA and offline data`.
