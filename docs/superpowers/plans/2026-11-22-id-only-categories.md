# Categories and Payment Methods by Id Only — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expenses reference categories and payment methods only by id; text columns, sync triggers and rename/delete DB functions are gone; no iOS-app references remain.

**Architecture:** One idempotent SQL migration (backfill → drop triggers/functions → drop columns), tested against a throwaway local Postgres with a stub of the Supabase schema. The app resolves names client-side from the already-loaded `CategoriesProvider` / `PaymentMethodsProvider`; rename/delete become plain table writes.

**Tech Stack:** Next.js 16 (App Router, all data client-side via supabase-js), TypeScript, Supabase Postgres, local Homebrew Postgres (`initdb`/`pg_ctl`/`psql`) for migration tests.

**Spec:** `docs/superpowers/specs/2026-11-22-id-only-categories-design.md`

## Global Constraints

- Never edit existing files in `supabase/migrations/` — add one new file only.
- The new migration must be safe to run more than once (like the existing ones).
- No expense may lose its category or payment method label in the migration.
- Never run `next build` / `next start` in the repo folder (the user's `next dev` on :3000 shares `.next/`). Use `npx tsc --noEmit` and `npx eslint src` in the repo; production builds only in a scratchpad copy.
- No test framework exists for the app; app verification = typecheck + lint + grep checks + browser check. Don't add a JS test framework.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Migration re-run after columns are dropped** — second run must succeed with no errors and no new rows (backfill must be skipped when `expenses.category`/`payment_method` no longer exist). Test: Task 1 `run twice`.
2. **Names differing only in case/whitespace** (`" food & drink"` vs `Food & Drink`, `revolut` vs `Revolut`) link to the existing row; no duplicate is created. Test: Task 1 fixtures.
3. **Unmatched name longer than 50 chars** — must not abort the migration (check constraint); it is stored truncated to 50 chars. Test: Task 1 fixture.
4. **Expense pointing at a deleted category/payment method** (FK set null) — list, detail, summary and form show "Uncategorized" / no payment method without crashing. Covered by Task 3 browser check.
5. **"Delete and move" where the move succeeds but the delete fails** — expenses end up on the target, the old entry stays and can be deleted again. Covered by Task 2 ordering (move first, then delete).

---

### Task 1: Migration + local Postgres test

**Files:**
- Create: `supabase/migrations/20261122150000_expenses_ids_only.sql`
- Create: `supabase/tests/stub_schema.sql` — minimal stand-in for what Supabase provides and the pre-migration app schema
- Create: `supabase/tests/expenses_ids_only.test.sql` — fixtures + assertions
- Create: `scripts/test-migrations.sh` — spins up a temp cluster, runs stub → all migrations in filename order → test file

**Interfaces:**
- Produces (DB, used by Tasks 2–3): `expenses.payment_method_id uuid null references payment_methods(id) on delete set null`; `expenses.category` and `expenses.payment_method` no longer exist; functions `rename_category`, `delete_category`, `rename_payment_method`, `delete_payment_method`, `expenses_sync_category`, `categories_sync_expense_names` no longer exist.

- [ ] **Step 1: Write `supabase/tests/stub_schema.sql`**

Must provide: schema `auth`, `auth.users(id uuid primary key)`, `auth.uid()` returning `nullif(current_setting('request.jwt.claim.sub', true), '')::uuid`, role `authenticated` (create if missing), and `public.expenses` as it existed before the repo's migrations: `id uuid pk default gen_random_uuid()`, `account_id uuid`, `created_by_user_id uuid`, `amount numeric`, `currency text`, `expense_date timestamptz`, `category text`, `description text`, `location text`, `unit numeric`, `unit_price numeric`, `expire_date timestamptz`, `payment_method text`, `item text`, `metadata jsonb default '{}'`, `deleted_at timestamptz`, `created_at`/`updated_at timestamptz default now()`. Add whatever else the existing migrations reference (e.g. an `accounts` table) until they all apply cleanly.

- [ ] **Step 2: Write `scripts/test-migrations.sh`**

`set -euo pipefail`; `initdb` into `$(mktemp -d)`, `pg_ctl start` on port 54329 with `-o "-k $dir"` (socket in the temp dir), `createdb test`; run with `psql -v ON_ERROR_STOP=1`: `stub_schema.sql`, the fixture section, every `supabase/migrations/*.sql` in order, then the new migration **a second time**, then the assertions; `trap` stops the cluster and deletes the dir. Prints `ALL MIGRATION TESTS PASSED` at the end.

Split `expenses_ids_only.test.sql` into two files if simpler: `..._fixtures.sql` (runs before migrations) and `..._assert.sql` (after).

- [ ] **Step 3: Write fixtures and assertions**

Fixtures (two users A and B; insert into `auth.users`, then categories/payment methods are created by the earlier migrations' seed triggers or inserted directly once those tables exist — insert expenses before migrations so the old text columns are populated; insert extra category/payment rows in the assert file's setup if the tables don't exist yet at fixture time):

| expense | category text | payment_method text | expectation after migration |
|---|---|---|---|
| a1 (A) | `Food & Drink` | `Revolut` (exists for A) | linked to A's existing rows |
| a2 (A) | ` food & drink ` | `revolut` | same ids as a1 (no duplicates) |
| a3 (A) | `Knitting` (none) | `Cash Jar` (none) | new category `Knitting` and new payment method `Cash Jar` for A |
| a4 (A) | `null` | `null` | both ids null |
| a5 (A) | 60-char name | 60-char name | rows created with `left(name, 50)`, linked |
| b1 (B) | `Knitting` | `Cash Jar` | B gets its own rows (not A's) |

Assertions (each a `do $$ ... raise exception ... $$` block):
- the six expectations above
- `select count(*) from categories where account_id = A and lower(name) = 'food & drink'` = 1; same for `revolut` in `payment_methods`
- `information_schema.columns` has no `expenses.category` / `expenses.payment_method`; has `expenses.payment_method_id`
- `pg_proc` has none of the six dropped functions; `pg_trigger` has no `expenses_sync_category` / `categories_sync_expense_names`
- deleting a payment method sets `payment_method_id` null on its expenses

- [ ] **Step 4: Run to verify it fails**

Run: `bash scripts/test-migrations.sh`
Expected: FAIL — migration file missing or first assertion raises.

- [ ] **Step 5: Write the migration**

Order: (1) `add column if not exists payment_method_id` + `create index if not exists expenses_payment_method_id_idx`; (2) inside `do $$ begin if exists (select 1 from information_schema.columns where table_schema='public' and table_name='expenses' and column_name='category') then ... end if; end $$` — create missing categories from non-deleted expenses' trimmed names (`left(btrim(name), 50)`, sort_order 1000, default style), then link `category_id` by `lower(btrim())` where null; same guard and steps for `payment_method` → `payment_methods`/`payment_method_id`; use dynamic `execute` for statements referencing the old columns so the block compiles after they're gone; (3) `drop trigger if exists` both triggers, `drop function if exists` all six functions (with their argument signatures); (4) `alter table expenses drop column if exists category, drop column if exists payment_method`. Header comment: what and why (iOS app retired; ids only).

- [ ] **Step 6: Run to verify it passes**

Run: `bash scripts/test-migrations.sh`
Expected: `ALL MIGRATION TESTS PASSED`, exit 0 (includes the second run of the new migration).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261122150000_expenses_ids_only.sql supabase/tests scripts/test-migrations.sh
git commit -m "Migration: expenses reference categories and payment methods by id only"
```

---

### Task 2: Settings — rename, delete, count without DB functions

**Files:**
- Modify: `src/lib/services.ts` (categories + payment methods sections)
- Modify: `src/components/CategoriesProvider.tsx`, `src/components/PaymentMethodsProvider.tsx`
- Modify: `src/components/payment-methods/DeletePaymentMethodSheet.tsx`

**Interfaces:**
- Consumes: Task 1 schema.
- Produces:
  - `renameCategory(id: string, name: string): Promise<Category>` — plain `update({ name, updated_at })`
  - `deleteCategory(id: string, moveTo: string | null): Promise<number>` — if `moveTo`: `update expenses set category_id = moveTo where category_id = id` (count via `.select("id")`), then `delete from categories where id`; returns moved count (0 without move)
  - `renamePaymentMethod(id: string, name: string): Promise<PaymentMethod>` — plain update
  - `deletePaymentMethod(id: string, moveTo: string | null): Promise<number>` — same shape as categories, on `payment_method_id`
  - `countPaymentMethodExpenses(id: string): Promise<number>` — counts non-deleted expenses with `payment_method_id = id` (signature changes: no accountId/name)
  - `PaymentMethodsState.byId: Map<string, PaymentMethod>` and `idByName(name: string | null): string | null` (case-insensitive, trimmed); `CategoriesState.idByName` with the same signature

- [ ] **Step 1: Implement the service changes and provider additions above**

Remove the `rpc(...)` calls. Move first, delete second (Review Focus 5). Update doc comments to describe the new behaviour (no trigger mentions).

- [ ] **Step 2: Update `DeletePaymentMethodSheet` to `countPaymentMethodExpenses(method.id)`**

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx eslint src && ! grep -rn "\.rpc(" src`
Expected: no output from tsc/eslint errors, grep finds nothing (exit 0 overall).

- [ ] **Step 4: Commit**

```bash
git add src/lib/services.ts src/components/CategoriesProvider.tsx src/components/PaymentMethodsProvider.tsx src/components/payment-methods/DeletePaymentMethodSheet.tsx
git commit -m "Rename and delete categories/payment methods with plain table writes"
```

---

### Task 3: Expenses and scan use ids only

**Files:**
- Modify: `src/lib/types.ts` (`Expense`), `src/lib/services.ts` (`ExpenseInput`, `createExpensesFromReceipt`)
- Modify: `src/components/expenses/ExpenseForm.tsx`, `ExpenseDetail.tsx`, `MonthSummary.tsx`
- Modify: `src/app/expenses/page.tsx`, `src/app/scan/page.tsx`

**Interfaces:**
- Consumes: Task 2 `byId` / `idByName` on both providers.
- Produces:
  - `Expense` / `ExpenseInput`: remove `category`, `payment_method`; add `payment_method_id: string | null`
  - `createExpensesFromReceipt(accountId: string, receipt: ScannedReceipt, items: ReceiptItem[], resolve: { categoryId: (name: string | null) => string | null; paymentMethodId: (name: string | null) => string | null }): Promise<Expense[]>`
  - `ReceiptItem.category` and `ScannedReceipt.paymentMethod` stay **names** (scan review UI and last-used localStorage are name-based); ids are resolved only at save.

- [ ] **Step 1: Types and services as above**

- [ ] **Step 2: `ExpenseForm`** — payment method select uses ids (`value = m.id`, label = name, "" = none, keep "New Payment Method…" which selects the new method's id); category select drops `LEGACY_CATEGORY` and the name-matching fallback (initial value = `expense.category_id` if in `byId`, else ""; new expense default stays "Food & Drink" by name via `idByName`, else first).

- [ ] **Step 3: Display sites** — `ExpenseDetail` rows and title, expenses page row meta (`location • payment name`), delete-confirm message, and `MonthSummary` grouping: names from `byId` (categories) / payment `byId`; missing → "Uncategorized" / omitted. `MonthSummary` groups by `category_id ?? "none"`.

- [ ] **Step 4: Expenses page "sort by payment method"** — key by `payment_method_id ?? ""`, header = payment name, sorted A–Z by name, none last (same behaviour as today).

- [ ] **Step 5: Scan save** — pass `{ categoryId: idByName, paymentMethodId: paymentIdByName }` from the providers.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx eslint src && ! grep -rnE "\.payment_method\b|\bexpense\??\.category\b|e\.category\b|LEGACY_CATEGORY" src`
Expected: clean tsc/eslint, grep finds nothing.

Browser check (only possible after Task 5's migration is applied — otherwise note it as pending): in a scratchpad copy on :3100, signed in: list, detail, summary, payment-method sort, add/edit/duplicate expense, scan-save; an expense whose category was deleted shows "Uncategorized" (Review Focus 4).

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/services.ts src/components/expenses src/app/expenses/page.tsx src/app/scan/page.tsx
git commit -m "Expenses store category and payment method ids only"
```

---

### Task 4: Remove iOS-app references

**Files:**
- Modify: `README.md`, `.env.example`, `next.config.ts`, and every file under `src/` matching `grep -rniE "ios|swift" src` (~35 files; mostly `// Port of …swift` header comments)

- [ ] **Step 1: Edit** — delete `Port of …swift` / "like the iOS app" references; where a comment explains behaviour, keep the explanation and drop the iOS reference (e.g. "The iOS TabView opens on the Expenses tab." → "Open on the Expenses tab."). README: describe this as the only client; remove "same database as the iOS app" framing and `SupabaseConfig.swift` pointers. Keep visual-design mentions that refer to Apple's iOS *style* (e.g. "iOS-style grouped list", colors named `ios-blue`) — those are design vocabulary, not the iOS app.

- [ ] **Step 2: Verify**

Run: `grep -rniE "swift|ios app|iOS (app|version)|the iOS" README.md .env.example next.config.ts src; npx tsc --noEmit && npx eslint src`
Expected: grep prints nothing (or only design-vocabulary hits, each reviewed); tsc/eslint clean.

- [ ] **Step 3: Commit**

```bash
git add -A README.md .env.example next.config.ts src
git commit -m "Remove references to the retired iOS app"
```

---

### Task 5: Rollout (with the user — not a subagent task)

- [ ] **Step 1:** With the Supabase MCP connected, list applied migrations / inspect `expenses` columns; apply any earlier repo migrations that are missing, in order (ask the user first).
- [ ] **Step 2:** Merge `feature/id-only-categories` → `master` (user approval), apply `20261122150000_expenses_ids_only.sql` in Supabase, confirm the production deploy finished.
- [ ] **Step 3:** Browser check from Task 3 Step 6 against production data; report results.
