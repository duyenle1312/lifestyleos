# Categories and payment methods by id only — design

Date: 2026-11-22 · Status: approved · Branch: `feature/id-only-categories`

## Why

The iOS app is retired; this web app is the only client of the Supabase database. The iOS app is the
reason `expenses` carries plain-text `category` and `payment_method` columns, kept in sync by a trigger
and by rename/delete database functions. Dropping them simplifies the schema and is groundwork for the
upcoming offline-data feature (expenses saved on the phone and synced later should only carry ids).

## Goals

- `expenses` references categories and payment methods by id only (`category_id`, new `payment_method_id`).
- Remove the text columns, the sync triggers and the rename/delete database functions.
- Remove every statement that the iOS app is still in use (README, `.env.example`, code comments).

## Non-goals / anti-goals

- No offline work here (separate project, next).
- Don't edit already-applied migration files — they are history. Only a new migration.
- Anti-goal: any expense losing its category or payment method label in the migration.

## Approaches

1. **Ids only, client resolves names (picked).** Expenses keep only ids; the app looks names up from the
   categories/payment methods it already loads (`CategoriesProvider`, `PaymentMethodsProvider`).
2. Keep text columns as a denormalised cache filled by triggers. Rejected: that is the complexity we are
   removing, and offline writes would still need the trigger.
3. Keep slim RPCs for "delete and move". Rejected: two client calls are enough; a half-finished move is harmless.

## Design

### Database — one new migration

Safe to run more than once, like the existing ones.

1. Add `expenses.payment_method_id uuid references payment_methods(id) on delete set null` + index.
2. Backfill (no label lost): for every distinct non-empty `expenses.category` / `expenses.payment_method`
   name with no matching row (case-insensitive, trimmed, per account), create the category / payment method
   (append at the end of the sort order; categories get the default style). Then link
   `category_id` / `payment_method_id` by name where still null.
3. Drop triggers `expenses_sync_category`, `categories_sync_expense_names` and their functions.
4. Drop functions `rename_category`, `delete_category`, `rename_payment_method`, `delete_payment_method`.
5. Drop columns `expenses.category` and `expenses.payment_method`.
6. Keep `seed_default_*` signup triggers, RLS policies and `category_id`'s `on delete set null`.

### App

- Types/services: `Expense` and `ExpenseInput` drop `category` / `payment_method`, gain `payment_method_id`.
  `createExpensesFromReceipt` writes ids.
- Rename = plain `update ... set name` on the category / payment method row.
- Delete without move = plain `delete` (FK clears expenses). Delete with move = update expenses
  `set X_id = target where X_id = old`, then delete. `countPaymentMethodExpenses` counts by id.
- Every place that displayed or sorted/grouped by the text (expenses page, `ExpenseForm`, `ExpenseDetail`,
  `MonthSummary`, scan page) resolves the name from the providers by id. Missing id → "Uncategorized" /
  no payment method, as today when the text is null.

### iOS mentions

Remove "iOS app still uses…" statements and `Port of …swift` comments from README, `.env.example`,
`next.config.ts`, `src/**`. Keep comments that explain behaviour, reworded without the iOS reference.

### Rollout

The deployed app writes the text columns, so the migration and the deploy go together (single user, a
couple of minutes). Order: merge → run migration in Supabase → production deploy finishes. Previous
migrations flagged as possibly unapplied (category icons, payment methods) must be applied first — verify
via the Supabase MCP once connected.

## Left to the builder

Exact SQL, file-by-file edits, how name lookup helpers are shaped, test approach (typecheck, lint,
browser check against real data in an isolated build — never `next build` beside the user's `next dev`).
