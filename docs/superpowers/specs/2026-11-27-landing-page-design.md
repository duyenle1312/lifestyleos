# Public landing page — design

Date: 2026-11-27 · Branch: `feature/landing-page`

## Intent

Lifestyle OS has no public front page. `/` redirects to `/expenses`, and a signed-out visitor sees a bare
login box. We want strangers to sign up, so the domain root should explain the app and lead to the sign-up
button.

**Audience:** people who just moved abroad and can't read local receipts: digital nomads, international
students and expats. **Hook:** receipt scanning that translates every line into English and adds it to
the budget. **Look:** the structure and editorial style of useorigin.com (direction "A" from the
brainstorm mockups), with our content.

**Success:** a stranger landing on `lifestyleos.homes` understands the app within the first screen and can
start sign-up in one click. Every claim on the page is true of the app as shipped.

## Goals

- A server-rendered marketing page at `/`: fast, indexable, with good link previews.
- A call to action that leads straight into the existing email-code sign-in (new emails get an account
  automatically; no backend change).
- Honest proof in place of Origin's press logos and reviews.
- Small app changes so the page's claims hold: any-language wording, more currencies, and scanned
  receipts keeping their real currency.
- Privacy policy and terms pages, linked from the footer.

## Non-goals

- New app features (household sharing, push notifications, App Store builds).
- Analytics, A/B testing, a newsletter or a CMS.
- Translations of the landing page itself (English only).
- Changing the app's own visual design.
- Currency conversion or a "home currency" setting (mixed currencies are shown side by side instead).
- In-app account deletion (deletion is by email during beta).

## Anti-goals (would count as failure even if it "works")

- **Invented social proof:** fake testimonials, star ratings, press badges, user counts or company
  logos.
- **Claims the app doesn't meet:** e.g. "notifications" for pantry expiry, sharing, or app-store
  downloads.
- **Breaking existing users:** home-screen installs, offline mode, email links (`/auth/confirm`), or
  any app URL.
- **Hurting the installed app's launch:** it must still open straight into the app, never on the
  marketing page.

## Constraints and facts found

- `src/app/layout.tsx` wraps every page in `AuthProvider` + `AppShell`. `AppShell` (`src/components/AppShell.tsx`)
  is a client component that renders `LoginView` when signed out, with an exception for `/auth/confirm`.
- `next.config.ts` redirects `/` → `/expenses`.
- `manifest.ts` already has `start_url: "/expenses"`, so installed apps skip `/`. Its `id: "/"` must **not**
  change, or existing installs become a different app.
- `public/sw.js` precaches `SHELL_ROUTES` (the five tabs), serves navigations network-first, and falls back
  to cached `/expenses` offline. `/` isn't precached. Offline, a navigation to `/` would fall back to
  `/expenses`, which is fine.
- **Auth is client-side** (supabase-js in the browser), so the server can't tell whether a visitor is
  signed in.
- `src/lib/receipt.ts` ignores the model's `CURRENCY:` line and hard-codes `"EUR"` in `parseReceiptResponse`
  and `receiptToExpenseInputs`. The prompt already asks for English translations from any language.
- `src/app/scan/page.tsx:176` tip says "Works with Bulgarian store receipts".
- `src/lib/constants.ts` `CURRENCIES` = EUR, USD, GBP, JPY, BGN, CNY, INR.
- The scan model returns only the English item name, not the original-language text.
- Fonts: the app self-hosts Inter (`src/app/fonts`). The page needs a serif italic for accent words.
- This Next.js version differs from training data. Read `node_modules/next/dist/docs/` (route groups,
  layouts, metadata) before writing code.

## Approaches considered

1. **Landing at `/`, app moved into a route group** *(chosen)*. Split `src/app` into `(marketing)` and `(app)`
   route groups with separate layouts. The domain root sells the app, and app URLs don't change.
   Cost: moving every app route folder and reworking the root layout.
2. **Landing at `/welcome`, `/` unchanged.** Little code moves, but anyone who types the domain still gets a
   login box, which works against the goal.
3. **Separate site/app (like `dashboard/`).** Fully isolated, but a second deploy to maintain. Moving the app
   to a subdomain would break home-screen installs and Supabase redirect URLs.

The user picked 1.

## Design

### Routing and layouts

- `src/app/layout.tsx` keeps only what every page needs: `<html>`/`<body>`, `globals.css`, the theme script,
  metadata/viewport, and `ServiceWorkerRegister`.
- `src/app/(app)/layout.tsx` wraps children in `AuthProvider` + `AppShell`. All current routes move under
  it with the same URLs: `expenses`, `shopping`, `inventory/**`, `scan`, `settings/**`, `auth/confirm`.
  `api/` stays at the top level. `manifest.ts`, the icons and `opengraph-image.tsx` stay at the root.
- `src/app/(marketing)/layout.tsx` has no auth and no app chrome. It holds `page.tsx` (`/`), `privacy/page.tsx`
  and `terms/page.tsx`.
- Remove the `/` redirect from `next.config.ts`, and update the comment in `manifest.ts` that refers to it.
- The `/auth/confirm` exception in `AppShell` stays, since that route is still under `(app)`.
- `AppLogo` links to `/` in the sidebar. With `/` now the landing page, the sidebar logo should link to
  `/expenses` *(builder's call: keep it, or point it at `/expenses`. Recommended: `/expenses`, so the
  logo doesn't throw signed-in users out of the app)*.

### Calls to action and signed-in visitors

- "Get started free" and "Log in" both link to `/expenses`, where `AppShell` shows `LoginView`. Its default
  email-code flow creates the account for new emails. No `?signup` mode is needed.
- The landing page is static. A small client island in the nav checks for a session (via
  `supabase.auth.getSession()` or the `lifestyleos:lastUser` key the offline layer already writes) and swaps
  "Log in / Get started" for **"Open app →"**. No auto-redirect: signed-in users who come to `/` on purpose
  can read it.

### Look (direction A, Origin-style editorial)

- Cream background `#fbf8f2`, ink `#14161c`, dark bands `#14161c` with card surfaces `#1f222b`, and a gold
  accent `#e8c37a` used only on the serif phrase in dark bands.
- Sans: the self-hosted Inter. Serif italic for one accent phrase per heading: **Instrument Serif** italic
  via `next/font/google`, falling back to Georgia.
- Black pill buttons with an arrow. Light pill on dark bands.
- **Light only:** a marketing page with a fixed palette, which ignores the app's dark theme. Set
  `color-scheme: light` on the marketing layout. *(My call: it keeps the editorial look intact. Dark
  mode can come later.)*
- Responsive: phone first. Two-column sections stack. The hero phone mockup goes below the copy on narrow
  screens, and the floating translation card stays attached to it.
- Images: real screenshots from `docs/screenshots/` copied to `public/landing/` (`scan.png`,
  `desktop.png` and the others), rendered with `next/image`.

### Sections, in order

The approved mockup, which is the source for copy, layout, spacing and type scale, is
`docs/superpowers/mockups/2026-11-27-landing-full-page.html`. The grey section tags in it are annotations and
don't ship.

1. **Nav:** logo · How it works · Features · FAQ (in-page anchors) · Log in · **Get started →**.
2. **Hero:** "Read every receipt. / Even the ones you *can't.*" Lead: "Just moved abroad? Snap a supermarket
   receipt in any language. Lifestyle OS translates every line into English and adds it to your budget,
   sorted and totalled." CTA "Get started free →". Fine print: "Free during beta · Email sign-in, no
   password". Phone with `scan.png` and a floating card of three illustrative lines (Кисело мляко →
   Yogurt €1.29, ข้าวหอมมะลิ → Jasmine rice ฿89, Hafermilch → Oat milk €1.95).
3. **Proof strip:** "Reads receipts in" plus language chips (Български, Deutsch, ไทย, Tiếng Việt, 日本語,
   Español, Polski, Türkçe, Português, 한국어, + any language). Facts: works offline · installs to your
   home screen · no password needed · 20+ currencies.
4. **How it works** (dark band, `id="how"`): "Settling in is hard. *Budgeting shouldn't be.*" Three cards:
   01 Snap, 02 Translated, 03 Budgeted.
5. **Feature grid** (`id="features"`): "Your whole new life, *in one place.*" Six cards: Expenses, Any
   currency, Shopping list, Pantry, Cards & cash, Phone or laptop.
6. **Alternating blocks:** (a) "Check it before *it counts.*" with the scan screenshot and a checklist;
   (b) "Stop throwing food *away.*" with pantry status rows (expired / expires in N days / good until),
   shown as list rows, never as notifications; (c) "Works on the *metro,* too." with offline + install
   and the desktop screenshot.
7. **Who it's for** (dark band): "Made for people *who just moved.*" Three cards: digital nomads,
   international students, expats & new arrivals. This replaces testimonials until real quotes exist.
8. **FAQ** (`id="faq"`), using native `<details>` (no JS):
   - Is it free? Free during beta. If that changes, existing users hear first.
   - Which languages and countries? Any printed receipt language, translated into English, plus the
     supported currencies.
   - Do I need an app store? No. Open it in the browser and add it to your home screen.
   - What happens to my receipt photos? We don't store them. The photo goes to Google's Gemini AI to read
     the items, and only the items you save are kept. During beta we use Gemini's free tier, which means
     Google may use what's sent to improve its products, so avoid scanning anything with personal details
     on it. *(Verified: `src/app/api/scan-receipt/route.ts` sends the image inline and stores nothing.
     The key is on the free tier, confirmed by the user. If it moves to a paid plan, update this answer
     and the privacy policy.)*
   - Can I use it offline? Yes. Lists and expenses work offline and sync later. Scanning needs a connection.
9. **Final CTA** (dark): "Your first receipt *is waiting.*" + "Free during beta. Sign in with just your
   email. No app store, no password, no card." + light pill CTA.
10. **Footer:** tagline, © 2026, Product links (anchors), Account (Get started / Log in), Legal (Privacy
    policy / Terms).

### Metadata

- The landing page sets its own `title` ("Lifestyle OS: budget in any language" or similar) and a
  `description` aimed at expats. The existing `opengraph-image.tsx` stays as the share image *(a new OG image
  is out of scope)*.
- Optionally add `robots.ts` / `sitemap.ts` listing `/`, `/privacy`, `/terms` *(builder's call)*.

### App changes the page depends on

1. **Scan copy:** change the tip at `src/app/scan/page.tsx:176` to "Works with receipts in any language".
2. **Currencies:** extend `CURRENCIES` to include at least THB, MXN, VND, IDR, TRY, CAD, AUD, CHF, PLN,
   CZK, HUF, KRW, BRL, SGD, MYR, PHP, AED, ZAR, SEK, NOK, DKK, RON, in addition to the current seven. The
   expense form's currency select must also show a stored value that isn't in the list, so it never
   silently resets.
3. **Keep the scanned currency** *(confirmed by the user)*: `parseReceiptResponse` reads
   `CURRENCY:`. It keeps the value if it is a 3-letter ISO code and falls back to EUR otherwise.
   `receiptToExpenseInputs` uses `receipt.currency`. Add a prompt line: "CURRENCY is the currency of
   TOTAL. If the receipt prints two currencies, use the one the total was paid in." Update
   `receipt.test.ts`.
4. **Per-currency totals** *(user picked this over conversion)*. Wherever amounts are summed and labelled
   with a currency, group by currency instead of adding across currencies. Today that's the expenses
   list total and the per-group header sums (`src/app/expenses/page.tsx` ~173, ~180, ~528, ~584) and
   `src/components/expenses/MonthSummary.tsx`, which hard-codes `unit="EUR"`. Show e.g. "€312.40 · ฿1,250"
   (largest first, `Intl.NumberFormat` currency formatting). Category bars, percentages and the per-day
   average use the month's **main currency** (the one with the largest share of entries, ties → EUR), with
   a small note such as "+ ฿1,250 in other currencies". A single-currency month looks as it does today,
   apart from showing the right currency symbol. Pure grouping helpers go in `src/lib/` with unit tests.

### Legal pages

`/privacy` and `/terms` are plain, readable pages in the marketing layout. The privacy policy covers: what
we store (email, the data you enter), the auth email provider (Resend), the database host (Supabase), the
receipt reading provider (Google Gemini), no ads and no selling of data, how to delete your account, and a
contact address. Specifics confirmed by the user:
- **Contact:** `team@lifestyleos.homes` on both pages and in the footer.
- **Account deletion:** by email to that address, with the account and its data deleted within 30 days. No
  in-app deletion yet.
- **Gemini:** free tier, so state that Google may use submitted images to improve its products (same
  wording as the FAQ).

*The user must review the wording. It is a template, not legal advice.*

### README

Update `README.md`: route groups (`(app)` vs `(marketing)`), `/` as the public landing page and no longer a
redirect, the legal pages, any-currency scanning, and how the landing page's images are sourced. No database
changes.

### Testing

- Unit: `receipt.test.ts` covers currency parsing (valid code, missing, garbage → EUR). The per-currency
  grouping and main-currency helpers have their own tests (single currency, mixed, tie).
- Existing tests keep passing after the route move (`npm test`).
- Manual: a month with EUR + THB expenses shows both totals and never one mixed sum; signed-out `/` shows the landing page; the CTA reaches the email-code login; a new email gets an
  account; signed-in `/` shows "Open app"; `/auth/confirm` email links still work; the installed PWA still
  opens on `/expenses`; offline navigation still works; mobile layout at 375px.
- Build in a scratch copy, not in the repo while the dev server runs (the repo's `.next` is shared with
  `next dev`).

## Left to the builder

Component breakdown and file names under `(marketing)`, exact spacing and type scale (following the
mockup), icons (`lucide-react` is already a dependency), the session-check mechanism for "Open app", and
whether to add `robots.ts`/`sitemap.ts`.
