# Lifestyle OS — Web App

![Desktop Homepage](./docs/screenshots/desktop.png)

A personal household app for tracking monthly expenses by category and payment method, keeping a shopping list, and managing a home inventory with expiry dates. Photograph a supermarket receipt and AI translates to English and automatically add the items to your expense list in one go.

Next.js + Tailwind app backed by Supabase.
Built mobile-first (iOS look); on tablets/desktop the tab bar becomes a sidebar and sheets become centered dialogs.
On wide screens, Expenses becomes an iPadOS-style split view (see [Desktop](#desktop)).

## Contents

- [Screenshots](#screenshots)
- [Run](#run)
- [Desktop](#desktop)
  - [Keyboard shortcuts (Expenses)](#keyboard-shortcuts-expenses)
- [Sign-in](#sign-in)
  - [Admin view: users](#admin-view-users)
  - [Email delivery (Resend)](#email-delivery-resend)
- [Users and accounts](#users-and-accounts)
- [Installable app (PWA)](#installable-app-pwa)
- [Offline data](#offline-data)
  - [What works offline](#what-works-offline)
  - [Sign-in and accounts while offline](#sign-in-and-accounts-while-offline)
- [Testing](#testing)
- [Screens](#screens)
- [Notes](#notes)

## Screenshots

<p>
  <img src="docs/screenshots/expenses.png" alt="Expenses" width="180">
  <img src="docs/screenshots/shopping.png" alt="Shopping list" width="180">
  <img src="docs/screenshots/inventory.png" alt="Inventory" width="180">
  <img src="docs/screenshots/scan.png" alt="Scan receipt" width="180">
</p>

## Run

```bash
cp .env.example .env.local   # then fill in values (see below)
npm install
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase project URL + publishable key |
| `GEMINI_API_KEY` | Server-only, for receipt scanning ([get one](https://aistudio.google.com/apikey)) |
| `GEMINI_MODEL` | Defaults to `gemini-3.5-flash-lite` |

## Desktop

From 1024px wide (laptop, or iPad in landscape), **Expenses** shows the list on the left and an overview or inspector pane on the right, with a single toolbar on top:

- **Nothing selected:** total with change vs last month, daily average, transaction count and a category breakdown. For the current month the comparison uses the same days of last month (e.g. Nov 1–22 vs Oct 1–22). Click a category to filter the list.
- **Expense selected:** its details, with Edit and Delete.
- **Right-click a row** (mouse or trackpad): Edit, show only that category, copy amount, delete.

Narrower windows keep the phone layout, and tapping a row opens the detail sheet.

### Keyboard shortcuts (Expenses)

| Key | Action |
|---|---|
| `/` or `⌘K` / `Ctrl+K` | Focus search |
| `↓` (in search) | Jump to the first result |
| `Esc` (in search) | Leave the search field |
| `N` | Add expense |
| `↑` `↓` or `K` `J` | Select previous / next expense |
| `Enter` or `E` | Edit the selected expense |
| `Backspace` / `Delete` | Delete the selected expense (asks first) |
| `Esc` | Clear the selection |

Selection shortcuts need the split view (1024px or wider). `/`, `⌘K` and `N` work at any width. Shortcuts are ignored while typing in a field or while a dialog is open. Adding uses `N` rather than `⌘N` because browsers reserve `⌘N` for a new window.

## Sign-in

Email sign-in through Supabase Auth, sent via Resend on our own domain (custom SMTP in Supabase).

| Method | How it works | Code |
|---|---|---|
| **Magic link** (default) | Enter an email and get a link. An unknown email gets an account on its first link, with no password. | `sendMagicLink` in `components/AuthProvider.tsx` |
| **Password** (backup) | "Sign in with password instead" shows email + password and a **Sign Up** form. | `signInWithPassword`, `signUp` |
| **Set Password** | Settings → Account. Magic-link users can add a password; anyone can change theirs. | `components/SetPasswordSheet.tsx` |
| **Name** | Settings → Account. Optional display name, saved to Supabase Auth user metadata (`user_metadata.full_name`). Empty removes it. | `components/NameSheet.tsx` |

**When emails can't be sent.** If Supabase returns the email rate-limit error, the login screen switches to the password form and says why. Password sign-up only avoids email when **Confirm email** is off in Supabase (Authentication → Sign In / Providers → Email). With it on, sign-up also sends an email and fails the same way.

**Email links go through `/auth/confirm`.** Templates link to `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email` instead of `{{ .ConfirmationURL }}`. The page calls `verifyOtp` only when the user presses **Continue**. Email security scanners (Outlook Safe Links, Microsoft Defender) open links before the user does, and a direct verify link would be spent by that visit. `AppShell` renders this page without the login gate. See `supabase/templates/README.md`.

**On sign-up.** A database trigger on `auth.users` (`on_auth_user_created_account` → `public.create_default_account()`) creates the user's "Personal" account (id = user id) and their `owner` row in `account_users`, with `signed_up_at` set to the user's creation time. Two more triggers seed default categories and payment methods; triggers for the same event run in name order, so the account comes first. As a fallback, the `SIGNED_IN` listener runs `ensureDefaultAccount`, which repairs a missing account or link. RLS lets a user insert only their own link (`account_id = user_id = auth.uid()`).

### Admin view: users

`admin.users` lists every user with their email, account and activity. Run it in the Supabase SQL editor:

```sql
select * from admin.users;
```

| Column | Meaning |
|---|---|
| `user_id`, `email` | From `auth.users` |
| `name` | Display name from Settings → Name (`user_metadata.full_name`), `null` if not set |
| `account_name` | `accounts.name` (usually "Personal") |
| `signed_up_at`, `last_sign_in_at` | When they joined and last signed in |
| `email_confirmed` | Whether the email address is confirmed |
| `has_owner_link` | `false` means their `account_users` row is missing, so RLS blocks all their data |
| `expenses`, `last_expense_at` | Non-deleted expense count, newest expense |

It lives in the `admin` schema, which the Data API does not expose, and `anon`/`authenticated` have no grants, so emails never reach the browser. Don't move it to `public`: views run with their owner's rights, so any signed-in user could read every email. Source: `supabase/migrations/20261122180000_admin_users_view.sql`, `name` added in `20261122190000_admin_users_view_name.sql`.

Sign-ups per month:

```sql
select date_trunc('month', signed_up_at) as month, count(*) from admin.users group by 1 order by 1;
```

**Supabase settings this relies on:**
- Authentication → Sign In / Providers: **Allow new users to sign up** on (needed for sign-up by magic link).
- Authentication → URL Configuration → Redirect URLs: `https://www.lifestyleos.homes/**` and `http://localhost:3000/**`. Otherwise Supabase swaps in the Site URL and links miss `/auth/confirm`.
- Authentication → Emails → Templates: **Magic Link** and **Confirm signup** pasted from `supabase/templates/`.
- **Secure password change** off. Otherwise Set Password needs an emailed confirmation too.

### Email delivery (Resend)

Supabase's built-in mailer is for testing only and allows very few emails per hour, so auth emails go through Resend.

**1. Set up Resend** ([resend.com](https://resend.com))
1. Create an account.
2. **Domains → Add Domain** and enter the domain (e.g. `lifestyleos.homes`).
3. Add the DNS records Resend shows to the DNS provider (Cloudflare, Namecheap, etc.).
4. Wait for the domain to verify. Resend won't send from your own address until it does.
5. **API Keys → Create API Key** with sending permission, and copy the key (`re_...`).

**2. Point Supabase at Resend.** Authentication → Emails → **SMTP Settings** (older dashboards: Auth settings → SMTP). Turn on **Enable Custom SMTP** and fill in:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the Resend API key (`re_...`) |
| Sender email | `no-reply@<your domain>` |
| Sender name | `Lifestyle OS` |

**3. Raise the email rate limit.** Authentication → **Rate Limits** → **Rate limit for sending emails**: set to **50** emails per hour and save. This field only becomes editable once custom SMTP is on. It caps every auth email (magic links, sign-up confirmations, password resets) across the whole project, not per user. When it is hit, the login screen falls back to the password form (see above).

## Users and accounts

Two separate ideas. A **user** is a person who signs in. An **account** is the space their data lives in.

| | User | Account |
|---|---|---|
| Table | `auth.users` (managed by Supabase Auth) | `public.accounts` |
| Holds | Email, password, sign-in history, display name (`user_metadata.full_name`) | Account name ("Personal"), `signed_up_at` |
| Owns data? | No | Yes: expenses, categories, payment methods, shopping lists and inventory all have `account_id` |
| Linked by | `public.account_users` (`account_id`, `user_id`, `role` = `owner` / `member`) | |

The schema lets one account have several users, like a shared household. Today every user has exactly one account, created on sign-up, whose id equals their user id. That's why the app writes `account_id = auth.uid()`.

What follows from this:

- **Personal details belong to the user, not the account.** Email and name stay in `auth.users`. A shared account has no single email, and a copy in `accounts` would go stale when someone changes their email. `admin.users` joins the two for viewing.
- **RLS goes through `account_users`.** A user can reach an account's rows only if a link row connects them. A missing link (`has_owner_link = false` in `admin.users`) locks the user out of all their data.
- **`accounts.name` is the account's name**, not the person's. Use Settings → Name for the person.

Two migrations support the offline sync (see [Offline data](#offline-data)):

- `20261122150000_expenses_ids_only.sql`: expenses reference categories and payment methods by id only. It adds `payment_method_id`, backfills both ids from the old text columns, then drops those columns and the iOS-era triggers, functions and `account_data_view`. Safe to run twice.
- `20261122200000_expenses_same_account_refs.sql`: a trigger (`expenses_check_same_account`) rejects an expense whose category or payment method belongs to another account, with SQLSTATE `23503` so the sync treats it like a missing reference. Existing rows are not re-checked; the file has two pre-flight queries to run first.

## Installable app (PWA)

The app can be installed ("Add to Home Screen") and opens offline.

- **Manifest:** `src/app/manifest.ts`. Standalone display, `start_url` `/expenses`, shortcuts for Shopping List and Scan Receipt. Icons are in `public/icons/` (`icon-192.png`, `icon-512.png`, `maskable-512.png`).
- **Service worker:** `public/sw.js`, registered by `components/ServiceWorkerRegister.tsx` in **production only**, so cached chunks never fight dev HMR.
  - *Install:* precaches the HTML of every tab (`/expenses`, `/shopping`, `/inventory`, `/scan`, `/settings`) plus the JS/CSS chunks, favicon and icons each page references, so a tab never opened online still works offline. One failing route doesn't abort the install.
  - *Page navigations (and other same-origin GETs):* network-first, falling back to the cache offline (and to `/expenses` for an unknown page), so deploys show up immediately.
  - *Static assets* (`/_next/static/`, icons): cache-first. Their URLs are hashed.
  - *Never cached:* other origins (Supabase), `/api/*` and `/auth/*`.
  - **Resetting caches:** bump `VERSION` in `sw.js`. On activate it deletes every cache not named for the current version. Do this if the list of tabs or precached assets changes.

**Testing it.** The service worker only runs in a production build, and needs HTTPS or `localhost`.

1. Build and run in a separate copy of the repo on its own port: `npm run build && npx next start -p 3100`, then open `http://localhost:3100`. Don't do this on port 3000, or the service worker would also take over `npm run dev` there.
2. Open the app, sign in, visit the tabs once, then check Chrome DevTools → Application → Service Workers.
3. Tick **Offline** (Application → Service Workers, or Network → Throttling) and reload. Tabs should open from the cache and show your data.
4. On a phone: serve it over HTTPS (a deployed preview), then Safari → Share → Add to Home Screen (iOS) or Chrome → Install app (Android).

## Offline data

Expenses and the shopping list are read from and written to a database on the device. A sync engine moves changes to and from Supabase, so the app works the same with or without a connection. Code: `src/lib/offline/`.

**Local database.** One Dexie (IndexedDB) database per user, named `lifestyleos-<userId>` (`db.ts`). Tables: `expenses` (with `_ts`, the parsed date, indexed for month queries), `shoppingItems`, `inventoryItems`, `categories`, `paymentMethods`, `outbox` and `meta` (sync cursors). Components read it with live queries and write through `mutations.ts`, never straight to Supabase.

**Client-generated ids.** New rows get `crypto.randomUUID()` on the device, so a row can be created, edited and queued offline, and re-sending it is an idempotent upsert.

**Outbox.** Each write updates the local row and queues one `outbox` entry in a single transaction (`upsert`, `delete` or `upsertMany`).

- *Collapse rule:* only entries never sent (`pending`, `attempts = 0`) are touched. A new upsert for the same row merges into the queued one (later fields win); a delete replaces that row's queued upserts. Entries already in flight are never rewritten, so a later edit queues separately.
- *Receipts:* a scan is one `upsertMany` entry, which becomes one bulk upsert. The server stores all the lines or none.
- Deleting a category or payment method rewrites queued expense entries that point at it (`rewriteRef.ts`).

**Push** (`push.ts`). Oldest first, one entry at a time.
- Marks the entry in flight (`attempts + 1`) before sending.
- *Retryable* errors (network down, 401/408/429/5xx, expired JWT; `isRetryable` in `remote.ts`) stop the run and leave the entry queued. Anything else (RLS, constraint, bug) marks it `failed` with the message, and later entries for the same rows wait behind it.
- `23503` (a category or payment method that no longer exists): clears `category_id` and `payment_method_id` on those rows and retries once.
- *Edit wins over remote delete:* an upsert fetches the server row first. If it was soft-deleted elsewhere, the edit restores it and records `{deleted_at, restored_at}` in `metadata.restored_after_delete` (a list that is merged, not overwritten), and the user sees a notice.
- After a push the server's row replaces the local one, unless a newer queued entry holds a newer local edit.

**Pull** (`pull.ts`, `supabaseRemote.ts`).
- Per table (`expenses`, `shopping_lists`, `inventory_items`) a cursor on `updated_at` is stored in `meta` as `cursor:<table>`. Pages of 1000, keyset-paginated on `(updated_at, id)` (`paging.ts`), so rows changed mid-pull aren't skipped.
- Soft-deleted rows remove the local copy.
- Rows with a queued local change are skipped: local changes win until they are sent.
- Rows from another account (a stale response after a user switch) are ignored.
- Categories and payment methods are small and are replaced wholesale. An empty answer doesn't wipe a non-empty local table.

**When it syncs** (`engine.ts`, one run at a time; a request during a run schedules one more): on app start, when the browser goes online, when the tab becomes visible, and after local writes (via `syncNow`). A run pushes, then pulls. Before each entry it checks the signed-in user is still the engine's user and halts otherwise.

**Sync badge** (`components/SyncBadge.tsx`; hidden when there is nothing to say):

| State | Shows |
|---|---|
| Offline | "Offline · N changes waiting" |
| Online, queued | "N changes waiting", or "Syncing…" |
| A change failed | Red "N changes couldn't sync". Tap it for the list, each with **Retry** (back to pending) and **Discard** |
| Notices | One-off messages, such as "1 item restored", each dismissible |

**Discard** drops the queued change and refetches the server's row so the local copy matches it. It needs a connection and says so if it can't reach the server.

### What works offline

| Works offline | Needs a connection |
|---|---|
| Browse expenses (any month already pulled), shopping lists and inventory | Anything not pulled yet, e.g. the first launch after signing in |
| Add, edit and delete expenses | Add, edit and delete inventory items |
| Add, edit, tick and delete shopping items | Scan a receipt (Gemini). Saving the scanned lines is offline-safe |
| Use existing categories and payment methods | Create, rename or delete categories and payment methods |
| Open all tabs of the installed app | Set Password, Name, sign-in by email link |

### Sign-in and accounts while offline

- The signed-in user is remembered in `localStorage` (`lifestyleos:lastUser`). If the login has expired and can't be refreshed offline, the app keeps working as that user (`isOfflineSession`).
- On reconnect it refreshes the login. A **network failure** keeps the offline session and retries once after about a minute. A **rejected** refresh (not retryable) signs out locally and forgets the remembered user, so later offline launches don't open the data without a valid login. Their local database and queued changes are kept and are sent the next time they sign in.
- **Sign Out** (Settings) asks first if changes are unsynced ("They'll be sent next time you sign in"). It always clears the device session, locally too if the server call fails or the session was offline-only; otherwise the stored refresh token would sign the user back in later.
- When a different account signs in, other accounts' local databases are deleted only if their outbox is empty (`cleanupOtherUserDbs` in `session.ts`).

## Testing

```bash
npm test                      # Vitest + fake-indexeddb (IndexedDB in Node); TZ pinned in vitest.setup.ts (Europe/Helsinki)
bash scripts/test-migrations.sh   # applies the migrations to a throwaway local Postgres and runs the SQL assertions
```

`npm test` runs every `*.test.ts` under `src/`: outbox, push, pull, engine, paging, error mapping, session helpers and more. The migration script checks both the ids-only migration (`supabase/tests/expenses_ids_only_assert.sql`) and the same-account trigger, including a row-level-security test (`supabase/tests/expenses_same_account_assert.sql`). It needs a local Postgres (`PGBIN` defaults to `/opt/homebrew/bin`); it starts and removes its own temporary cluster.

## Screens

| Screen | Code |
|---|---|
| Sign-in / sign-up (merged, see [Sign-in](#sign-in)) | `components/LoginView.tsx` |
| Expenses: list, add, edit, detail, month picker | `app/expenses`, `components/expenses/*` |
| Shopping lists | `app/shopping`, `components/shopping/*` |
| Inventory: list, add, detail | `app/inventory`, `app/inventory/[id]` |
| Receipt scanner | `app/scan` + `app/api/scan-receipt` |
| Settings | `app/settings` |

## Notes

- Data access is client-side with supabase-js so Row Level Security does the work. `account_id` and `created_by_user_id` are the signed-in user's id.
- Dates are saved at local noon (`noonISO`).
- Receipt scanning sends the photo (downscaled to 1600px) to `/api/scan-receipt`. The route checks the Supabase session, then calls Gemini with a fixed prompt. Gemini reads the image directly, so there is no separate OCR step.
- Swipe left on a row to delete it. With a mouse, hover over the row for a delete button.
