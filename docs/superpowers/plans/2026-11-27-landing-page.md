# Public Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a public, Origin-style marketing page at `/` for expats, nomads and students, and make the app's claims true: receipts keep their real currency and original item names, more currencies exist, and totals never mix currencies.

**Architecture:** Split `src/app` into an `(app)` route group (with `AuthProvider` + `AppShell`, URLs unchanged) and a `(marketing)` group (server-rendered, no auth) under the single existing root layout. Pure currency and receipt logic goes in `src/lib` with vitest tests. The UI consumes it.

**Tech Stack:** Next.js 16.4.6 (App Router; read `node_modules/next/dist/docs/` before writing Next code), React 19.3, Tailwind 4, Vitest 5 (`src/**/*.test.ts`, node env), lucide-react, `next/font/google`, `next/image`.

**Spec:** `docs/superpowers/specs/2026-11-27-landing-page-design.md`. **Mockup (source of copy and layout):** `docs/superpowers/mockups/2026-11-27-landing-full-page.html`.

## Global Constraints

- Branch `feature/landing-page`. One commit per task. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Never run `next build` in the repo** while a dev server may be running on :3000. Build in a scratch copy:
  `rsync -a --delete --exclude node_modules --exclude .next ./ "$SCRATCH/lo-build/" && ln -sfn "$PWD/node_modules" "$SCRATCH/lo-build/node_modules" && (cd "$SCRATCH/lo-build" && npx next build)`
  (`$SCRATCH` = the session scratchpad directory).
- App URLs must not change: `/expenses`, `/shopping`, `/inventory`, `/inventory/[id]`, `/scan`, `/settings/**`, `/auth/confirm`, `/api/scan-receipt`.
- `manifest.ts`: keep `id: "/"` and `start_url: "/expenses"`.
- No database changes and no new npm dependencies.
- No invented social proof (testimonials, stars, press, user counts, logos). No claims of notifications, sharing or app-store availability.
- Contact address: `team@lifestyleos.homes`. Pricing: "Free during beta".
- Landing palette: cream `#fbf8f2`, ink `#14161c`, dark card `#1f222b`, gold `#e8c37a` (serif phrase in dark bands only). Serif accent: Instrument Serif italic. The page is light-only.
- Currency fallback is `"EUR"` whenever a currency code is missing or invalid.

## Review Focus

1. **Model returns a lowercase or symbol currency** (`thb`, `€`, `Lev`). Expected: `thb` → `THB`, anything not matching `/^[A-Z]{3}$/` after uppercasing → `EUR`. Test in Task 1.
2. **A month containing only non-EUR expenses** (all THB). Expected: the summary shows ฿ totals with no "+ other currencies" note, and never says EUR. Test in Task 3 (`mainCurrency`).
3. **An item line with a `|` missing or extra** (3 or 6 fields). Expected: the line is skipped and the other items survive. Test in Task 1.
4. **Editing an old expense whose currency isn't in `CURRENCIES`** (e.g. `ARS`). Expected: the select shows `ARS` and saving keeps `ARS`. Covered by `currencyOptions` test in Task 2.
5. **A signed-in user taps the sidebar logo, or opens `/` in the installed app offline.** Expected: the logo goes to `/expenses`. Offline `/` falls back to the cached `/expenses` (existing `sw.js` behaviour). Manual check in Task 4.

---

### Task 1: Receipt keeps its currency and original item names

**Files:**
- Modify: `src/lib/receipt.ts` (prompt ~19-47, `parseReceiptResponse` ~54-88, `receiptToExpenseInputs` ~108)
- Modify: `src/app/scan/page.tsx:176` (tip copy), `:424-426` (item row)
- Test: `src/lib/receipt.test.ts`

**Interfaces:**
- Produces: `parseReceiptResponse(text: string): ScannedReceipt`, where `currency` is a validated ISO code and `items[].name` is the original as printed and `items[].translatedName` is English. `receiptToExpenseInputs` sets `currency: receipt.currency`. Exported `normalizeCurrency(raw: string | null | undefined): string`.

- [ ] **Step 1: Write failing tests** in `receipt.test.ts` (new `describe("parseReceiptResponse")` + one in the existing block):

```ts
const reply = (cur: string, lines: string[]) =>
  ["STORE: Tops", "DATE: 2026-11-01", `CURRENCY: ${cur}`, "TOTAL: 129", "ITEMS_START", ...lines, "ITEMS_END"].join("\n");

it("keeps a valid currency, uppercases, falls back to EUR", () => {
  expect(parseReceiptResponse(reply("THB", [])).currency).toBe("THB");
  expect(parseReceiptResponse(reply("thb", [])).currency).toBe("THB");
  expect(parseReceiptResponse(reply("€", [])).currency).toBe("EUR");
  expect(parseReceiptResponse(reply("", [])).currency).toBe("EUR");
});
it("reads original and English names from 5-field lines", () => {
  const [i] = parseReceiptResponse(reply("THB", ["ข้าวหอมมะลิ|Jasmine rice|89|1|Food"])).items;
  expect(i).toMatchObject({ name: "ข้าวหอมมะลิ", translatedName: "Jasmine rice", amount: 89, quantity: 1, category: "Food" });
});
it("accepts old 4-field lines with original = English", () => {
  const [i] = parseReceiptResponse(reply("EUR", ["Milk|2.3|1|Food"])).items;
  expect(i).toMatchObject({ name: "Milk", translatedName: "Milk", amount: 2.3 });
});
it("skips malformed lines but keeps the rest", () => {
  const items = parseReceiptResponse(reply("EUR", ["bad|line|1", "a|b|c|d|e|f", "Mleko|Milk|1|1|Food"])).items;
  expect(items.map((i) => i.translatedName)).toEqual(["Milk"]);
});
// in describe("receiptToExpenseInputs"):
it("uses the receipt's currency", () => {
  const [r] = receiptToExpenseInputs({ ...base, currency: "THB" }, [item({})], resolve);
  expect(r.currency).toBe("THB");
});
```

- [ ] **Step 2:** `npx vitest run src/lib/receipt.test.ts`. Expected: the new tests FAIL (currency is always EUR, and 5-field lines are dropped).

- [ ] **Step 3: Implement.**
  - Add `export function normalizeCurrency(raw: string | null | undefined): string`: trim, uppercase, return it if it matches `/^[A-Z]{3}$/`, else `"EUR"`.
  - In `parseReceiptResponse`, read `CURRENCY:` through it. Accept `parts.length === 5` (original, English, price, qty, category) and `=== 4` (English used for both). Skip other lengths.
  - In `receiptToExpenseInputs`, set `currency: receipt.currency`.
  - In the prompt:
    - Change the item-line template and example to `[Item name exactly as printed]|[Item name in English]|[price]|[quantity]|[category]`. The example's lines get originals, e.g. `Тоалетна хартия|Toilet Paper|12.0|1|Home`.
    - Add: `CURRENCY is the ISO 4217 code of TOTAL. If the receipt prints two currencies, use the one the total was paid in.`
    - Change the opening line to "…translate item names to English, keeping each original name too."

- [ ] **Step 4:** `npx vitest run src/lib/receipt.test.ts`. Expected: all tests pass.

- [ ] **Step 5: Scan screen.**
  - Change the tip string at `scan/page.tsx:176` to `"Works with receipts in any language"`.
  - In the item row (~424), render the original **above** the English name: `{item.name !== receiptItemDisplayName(item) && <p className="text-xs text-label-2">{item.name}</p>}`, then the existing `text-[17px] font-semibold` English line. Remove the old below-line.
  - The edit sheet already writes only `translatedName`, so leave it as is.

- [ ] **Step 6:** `npm test && npx tsc --noEmit`. Expected: both pass. Then commit: `Scan: keep receipt currency and original item names`.

---

### Task 2: More currencies; the form never drops an unknown one

**Files:**
- Modify: `src/lib/constants.ts:2`
- Create: `src/lib/currency.ts`
- Modify: `src/components/expenses/ExpenseForm.tsx:156`
- Test: `src/lib/currency.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `currencyOptions(current: string): string[]` from `src/lib/currency.ts` (used by `ExpenseForm`).

- [ ] **Step 1: Failing test** `src/lib/currency.test.ts`:

```ts
import { CURRENCIES } from "./constants";
import { currencyOptions } from "./currency";
it("has the nomad currencies", () => {
  for (const c of ["THB","MXN","VND","IDR","TRY","CAD","AUD","CHF","PLN","CZK","HUF","KRW","BRL","SGD","MYR","PHP","AED","ZAR","SEK","NOK","DKK","RON"]) expect(CURRENCIES).toContain(c);
  expect(new Set(CURRENCIES).size).toBe(CURRENCIES.length);
});
it("includes an unknown current value first, once", () => {
  expect(currencyOptions("ARS")[0]).toBe("ARS");
  expect(currencyOptions("EUR").filter((c) => c === "EUR")).toHaveLength(1);
  expect(currencyOptions("EUR")).toEqual(CURRENCIES);
});
```

- [ ] **Step 2:** `npx vitest run src/lib/currency.test.ts`. Expected: FAIL.
- [ ] **Step 3:**
  - `CURRENCIES` keeps its first seven in order, then adds the 22 above.
  - `currencyOptions(current)` returns `CURRENCIES` when it includes `current`, else `[current, ...CURRENCIES]`.
  - `ExpenseForm` uses `opts(currencyOptions(currency))`.
- [ ] **Step 4:** `npm test` passes. Commit: `Expenses: 22 more currencies; keep unknown currency in form`.

---

### Task 3: Totals grouped by currency

**Files:**
- Create: `src/lib/money.ts`, `src/lib/money.test.ts`
- Modify: `src/app/expenses/page.tsx` (`total` ~180; payment-method group header ~173; totals shown ~528 and ~584)
- Modify: `src/components/expenses/MonthSummary.tsx`

**Interfaces:**
- Produces (from `src/lib/money.ts`):
  - `type CurrencyTotal = { currency: string; amount: number; count: number }`
  - `totalsByCurrency(rows: { amount: number; currency: string }[]): CurrencyTotal[]`: sorted by amount descending, ties by currency code. An empty or missing currency counts as `"EUR"`.
  - `mainCurrency(rows: { amount: number; currency: string }[]): string`: the currency with the most entries. Ties → `"EUR"` if it is among them, else alphabetical. `"EUR"` for empty input.
  - `formatMoney(amount: number, currency: string): string`: `Intl.NumberFormat("en-US", { style: "currency", currency })`. On a `RangeError`, falls back to `` `${amount.toFixed(2)} ${currency}` ``.
  - `formatTotals(totals: CurrencyTotal[]): string`: `formatMoney` of each, joined with `" · "`, `formatMoney(0, "EUR")` for empty input.

- [ ] **Step 1: Failing tests** `src/lib/money.test.ts`:

```ts
const r = (amount: number, currency: string) => ({ amount, currency });
it("groups and sorts", () => {
  expect(totalsByCurrency([r(1.29,"EUR"), r(89,"THB"), r(2,"EUR")])).toEqual([
    { currency: "THB", amount: 89, count: 1 }, { currency: "EUR", amount: 3.29, count: 2 }]);
});
it("main currency is by entry count, EUR wins ties, all-THB is THB", () => {
  expect(mainCurrency([r(1,"EUR"), r(500,"THB"), r(2,"EUR")])).toBe("EUR");
  expect(mainCurrency([r(1,"EUR"), r(500,"THB")])).toBe("EUR");
  expect(mainCurrency([r(5,"THB"), r(6,"THB")])).toBe("THB");
  expect(mainCurrency([])).toBe("EUR");
});
it("formats", () => {
  expect(formatTotals([{ currency: "EUR", amount: 312.4, count: 1 }, { currency: "THB", amount: 1250, count: 1 }])).toBe("€312.40 · THB 1,250.00");
  expect(formatMoney(3, "XYZ1")).toBe("3.00 XYZ1");
});
```

> Note: check the exact `Intl` output for THB in Node (`THB 1,250.00` vs `฿1,250.00`) and assert what `Intl` actually produces. Don't hand-roll symbols.

- [ ] **Step 2:** `npx vitest run src/lib/money.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `money.ts`. Float sums: round each total with `Math.round(x * 100) / 100`.
- [ ] **Step 4: Expenses page.**
  - Replace `total` with `formatTotals(totalsByCurrency(filtered))`, and render it without the trailing `" EUR"` at both sites (~528, ~584).
  - Payment-method group header (~173): `formatTotals(totalsByCurrency(items))`.
- [ ] **Step 5: MonthSummary.**
  - Compute `main = mainCurrency(expenses)` and `inMain = expenses.filter(e => (e.currency || "EUR") === main)`.
  - **Total stat:** value is `formatMoney(sum(inMain), main)` (drop the `unit` prop). The footer shows the delta as today, computed on `inMain` vs the previous month's rows in `main`. When other currencies exist, add a line `+ {formatTotals(others)}`, where `others` = `totalsByCurrency` minus `main`.
  - **Daily Average:** `formatMoney(sum(inMain) / days, main)`.
  - **Transactions:** the count of all expenses. The footer is `avg {formatMoney(sum(inMain)/inMain.length, main)}` (no "EUR each").
  - **Category rows, bars and percentages:** use `inMain` only, with amounts via `formatMoney`.
  - A single-currency month looks as it does today, apart from the currency symbol.
- [ ] **Step 6:** `npm test && npx tsc --noEmit && npm run lint` pass. Manual: in `npm run dev`, add one THB expense to a month with EUR ones. Each total reads like `€… · THB …`, the summary shows a "+ THB …" line, and no mixed sum appears anywhere. Commit: `Expenses: never add up different currencies`.

---

### Task 4: Route groups: the app moves into `(app)`, `/` is freed

**Files:**
- Move (`git mv`, no content changes): `src/app/{expenses,shopping,inventory,scan,settings,auth}` → `src/app/(app)/…`
- Create: `src/app/(app)/layout.tsx`
- Modify: `src/app/layout.tsx` (remove `AuthProvider`/`AppShell`), `next.config.ts` (remove the `redirects()` block), `src/app/manifest.ts` (comment only), `src/components/AppShell.tsx:60` (`href="/expenses"`)
- Stays at top level: `api/`, `manifest.ts`, `opengraph-image.tsx`, icons, `fonts/`, `globals.css`.

**Interfaces:**
- Produces: `src/app/(app)/layout.tsx`, which renders `<AuthProvider><AppShell>{children}</AppShell></AuthProvider>`. Root layout keeps `<html>`, `<body>`, the theme script, metadata, viewport and `ServiceWorkerRegister`.

- [ ] **Step 1:** Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md` and `…/01-getting-started/03-layouts-and-pages.md`. Keep a **single** root layout (no multiple-root-layout reloads).
- [ ] **Step 2:** Do the moves and layout split. Fix any relative imports broken by the move (most use `@/`). Grep: `grep -rn "\.\./" "src/app/(app)"`.
- [ ] **Step 3:** Remove the redirect from `next.config.ts`. Change the `manifest.ts` comment to: `// "/" is the public landing page; the installed app opens straight into Expenses.` Add a temporary `src/app/(marketing)/page.tsx` returning `<main>Landing</main>` so `/` resolves. Task 5 replaces it.
- [ ] **Step 4:** `npm test && npx tsc --noEmit && npm run lint` pass. Do the scratch-copy build (Global Constraints). Expected: success, with `/`, `/expenses`, `/auth/confirm`, `/inventory/[id]` in the route list.
- [ ] **Step 5: Manual** (`npm run dev`):
  - Signed out, `/expenses` shows the login screen and `/` shows "Landing".
  - Signed in, every tab works and the sidebar logo goes to `/expenses`.
  - `/auth/confirm?token_hash=x&type=email` renders without the app chrome.
  - In DevTools → Application, the service worker still precaches the 5 tab routes.
  - In DevTools offline mode, navigating to `/` serves the cached `/expenses`.
- [ ] **Step 6:** Commit: `App: move screens into (app) route group; free / for the landing page`.

---

### Task 5: The landing page

**Files:**
- Create: `src/app/(marketing)/layout.tsx`, `src/app/(marketing)/page.tsx` (replace placeholder), `src/components/landing/*` (one file per section is fine: `Nav.tsx`, `Hero.tsx`, `ProofStrip.tsx`, `HowItWorks.tsx`, `Features.tsx`, `Blocks.tsx`, `WhoFor.tsx`, `Faq.tsx`, `FinalCta.tsx`, `Footer.tsx`), `src/components/landing/SessionCta.tsx` (client island)
- Create: `public/landing/{scan,expenses,shopping,inventory,desktop}.png` (copied from `docs/screenshots/`)
- Create: `src/app/robots.ts`, `src/app/sitemap.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (the copy assumes Tasks 1-3 have shipped).
- Produces: `SessionCta({ variant }: { variant: "nav" | "hero" | "final" })`, a `"use client"` component. Default render (server, and before mount) is the signed-out CTA. After mount, if `localStorage["lifestyleos:lastUser"]` exists (try/catch), it renders **"Open app →"** linking `/expenses`. Don't import `src/lib/offline/session.ts` (it pulls in Dexie) or the supabase client.

- [ ] **Step 1:** Read `node_modules/next/dist/docs/01-app/01-getting-started/{13-fonts,12-images,14-metadata-and-og-images}.md`.
- [ ] **Step 2: Marketing layout.**
  - Load `Instrument_Serif` (`weight: "400"`, `style: "italic"`, `subsets: ["latin"]`, `variable: "--font-serif"`) via `next/font/google`.
  - The wrapper div sets the cream background, ink text, `color-scheme: light` and the font variable.
  - The root `THEME_SCRIPT` may set `data-theme` on `<html>`. Make sure the landing colours are hard-coded, not app tokens, so dark mode can't leak in.
- [ ] **Step 3: Page metadata.**
  - `title: "Lifestyle OS — budget in any language"`
  - `description: "Snap a receipt in any language. Lifestyle OS translates every line into English and adds it to your budget. Free during beta."`
  - Matching `openGraph` title and description. The image stays inherited from `opengraph-image.tsx`.
- [ ] **Step 4: Build the sections** in mockup order with the mockup's exact copy. The grey `.tag` labels don't ship.
  - In-page anchors: `#how`, `#features`, `#faq`.
  - CTAs: "Get started free →" and "Log in" link to `/expenses`, via `SessionCta`.
  - FAQ uses `<details>/<summary>` with the spec's answer texts verbatim (spec §Sections 8). The photo answer must include the free-tier Google sentence.
  - Hero card: three illustrative lines (original small/grey above English, price right).
  - Pantry block: the four rows as list rows. No notification styling and no "1m ago" timestamps.
  - Images use `next/image` with explicit `width`/`height` from the PNGs (`scan.png` 780×1370, `desktop.png` 2560×1600; check the others with `sips -g pixelWidth -g pixelHeight`). The hero image gets `priority`.
  - Footer: Privacy (`/privacy`), Terms (`/terms`), `team@lifestyleos.homes` (mailto), `© 2026`.
- [ ] **Step 5: Responsive.**
  - Below `md`, two-column sections stack (copy first), grids go to 1 column (features: 2 columns from `sm`), and nav links hide (keep logo + CTA).
  - The hero floating card sits under the phone and overlaps its lower edge, never off-screen.
  - Check at 375px, 768px and 1280px: no horizontal scroll.
- [ ] **Step 6:** Add `robots.ts` (allow all, sitemap URL from `metadataBase`) and `sitemap.ts` (`/`, `/privacy`, `/terms`). Use the same site URL logic as `src/app/layout.tsx`, extracted to `src/lib/siteUrl.ts` and imported by both.
- [ ] **Step 7:** `npx tsc --noEmit && npm run lint && npm test` pass. Do the scratch-copy build: `/` is listed as static (○).
- [ ] **Step 8: Manual** (dev):
  - Signed out, `/` matches the mockup, and the CTA leads to the email-code login. A brand-new email gets an account and lands in Expenses.
  - Signed in, `/` shows "Open app →".
  - Lighthouse (mobile) on `/` gives SEO ≥ 90, accessibility ≥ 90 and no console errors.
- [ ] **Step 9:** Commit: `Landing page at /`.

---

### Task 6: Privacy policy and terms

**Files:**
- Create: `src/app/(marketing)/privacy/page.tsx`, `src/app/(marketing)/terms/page.tsx`, `src/components/landing/LegalPage.tsx` (shared prose wrapper with the nav/footer and a "Last updated 27 November 2026" line)

**Interfaces:**
- Consumes: `Nav`, `Footer` from Task 5.

- [ ] **Step 1: Privacy content** (plain English, headed sections). The spec §Legal pages lists the points:
  - **What we store:** your email and the data you enter.
  - **Processors:** Supabase (database and sign-in), Resend (sign-in emails), Google Gemini (reading receipt photos). We don't store photos. The **free tier** means Google may use submitted images to improve its products.
  - **No ads, no selling of data.**
  - **Data is kept** until you delete your account.
  - **Deletion:** email `team@lifestyleos.homes` and we delete your account and data within 30 days.
  - **Contact:** the same address.
- [ ] **Step 2: Terms content.**
  - The beta is provided as-is and free during beta. Pricing may change, and existing users hear first.
  - Acceptable use.
  - Scan results are machine translations, so check amounts before relying on them.
  - Account termination.
  - Contact.
- [ ] **Step 3:** Set metadata titles ("Privacy policy — Lifestyle OS", "Terms — Lifestyle OS"). `npx tsc --noEmit && npm run lint` pass. Check both pages render at 375px. Commit: `Landing: privacy policy and terms`.

---

### Task 7: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** Update:
  - **Intro:** there's a public landing page at `/`.
  - **New "Landing page" section:**
    - the `(app)` vs `(marketing)` route groups and which layout wraps what
    - `/` is no longer a redirect
    - signed-in visitors see "Open app"
    - images in `public/landing/` are copied from `docs/screenshots/`, so re-copy them when screenshots change
    - the copy source is the mockup and spec
    - the legal pages and contact address
  - **Installable app (PWA):** the installed app still starts at `/expenses`.
  - **Scan / Notes:** any language, the original name is shown on review but not saved, the currency comes from the receipt with an EUR fallback, and there are 29 currencies.
  - **Expenses:** totals are grouped per currency, and summary charts use the month's main currency.
  - **Contents:** add the new section. Database schema is unchanged; say nothing there.
- [ ] **Step 2:** Commit: `README: landing page, route groups, multi-currency`.

---

## Final verification (after Task 7)

- `npm test && npx tsc --noEmit && npm run lint`, plus the scratch-copy build. All pass.
- Walk the spec's manual testing list (spec §Testing) once end to end.
