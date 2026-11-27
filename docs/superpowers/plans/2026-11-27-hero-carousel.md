# Hero Phone Carousel + "Pantry" Tab Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The landing hero's single static phone becomes one phone that slides through six app screens on a loop, and the app's visible "Inventory" label becomes "Pantry".

**Architecture:** Six light-theme screenshots with fake data come from `scripts/landing-screenshots.playwright.js` into `public/landing/`. A small client component (`HeroCarousel`) renders them as a horizontal track inside `PhoneFrame`, driven by a pure reducer (`carousel.ts`) that is unit-tested in Node. `Hero.tsx` stays a server component and drops the floating receipt card.

**Tech Stack:** Next.js (App Router, read `node_modules/next/dist/docs/` before touching Next APIs, e.g. `next/image`'s `preload`), React, Tailwind, Vitest (Node environment, `src/**/*.test.ts` only, no DOM), Playwright MCP for screenshots.

**Spec:** `docs/superpowers/specs/2026-11-27-hero-carousel-design.md`

## Global Constraints

- Slides, in order, with labels exactly: "Scan", "Translated", "Added", "Expenses", "Shopping", "Pantry".
- Each slide shows ~3.5 s (`SLIDE_MS = 3500`); the next slides in from the right; after slide 6 it wraps to slide 1, still moving right-to-left.
- The phone frame stays still; only the screen contents move. No 3D flip.
- Pauses while hovered, while focus is inside, and while the tab is hidden. With `prefers-reduced-motion: reduce` it never auto-advances (dots still work).
- Slide 1 is preloaded as today; the others must not compete with it.
- Floating receipt card in the hero is removed.
- `/inventory` URL, table and code identifiers are unchanged; only visible text says "Pantry".
- Phone shots are 390×760 at deviceScaleFactor 2 (780×1520 PNGs), light theme, demo data only.
- Never run `next build` in the repo while `npm run dev` is serving :3000.

## Review Focus

1. Wrap from slide 6 to 1: should slide forward onto a clone of slide 1 then snap invisibly, never rewind across all slides. (Task 3 reducer test `wraps forward via the clone`.)
2. Clicking a dot while a slide transition is mid-flight, or on the clone: index must land on the clicked slide, not drift. (Task 3 test `goto from the clone lands on the slide`.)
3. Hover and tab-hidden at the same time, then only one ends: stays paused until both end. (Task 3 test `stays paused until every reason clears`.)
4. Reduced motion: no timer starts; the page shows slide 1 and dots still jump. (Task 3 browser check, step 7.)
5. Slides 2–6 already loaded by the time they slide in (no blank screen in the phone). (Task 3 browser check, step 7.)

---

### Task 0: Branch

- [ ] **Step 1:** `git switch -c feature/hero-carousel` (from `master`; carries the uncommitted offline-section/shopping-shot changes).
- [ ] **Step 2:** Commit those pending changes plus the spec and this plan:

```bash
git add -A README.md scripts/landing-screenshots.playwright.js src/components/landing/Blocks.tsx public/landing docs/superpowers
git commit -m "Landing: shopping-by-location phone in the offline block; hero carousel spec + plan"
```

---

### Task 1: "Inventory" → "Pantry" in visible text

**Files:**
- Modify: `src/components/AppShell.tsx:19` (tab label)
- Modify: `src/app/(app)/inventory/[id]/page.tsx:98` (back link text)
- Modify: `src/app/opengraph-image.tsx:28` (share image feature label)

- [ ] **Step 1:** Change each visible "Inventory" string to "Pantry". Leave `href="/inventory"`, component names and comments alone.
- [ ] **Step 2:** Verify no visible "Inventory" is left: `grep -rn '"Inventory"\|>\s*Inventory\s*<' src` → no output; `grep -n Inventory src/app/\(app\)/inventory/\[id\]/page.tsx` shows only identifiers/comments.
- [ ] **Step 3:** `npx eslint src/components/AppShell.tsx "src/app/(app)/inventory/[id]/page.tsx" src/app/opengraph-image.tsx && npm test` → clean, all tests pass.
- [ ] **Step 4:** Commit: `git commit -am "App: call the Inventory tab Pantry, matching the landing page"`

---

### Task 2: Three new screenshots + demo pantry data

**Files:**
- Modify: `scripts/landing-screenshots.playwright.js`
- Create: `public/landing/scan-result.png`, `public/landing/scan-added.png`, `public/landing/pantry-expiry.png`

**Interfaces:**
- Produces: the three PNGs above (780×1520), alongside existing `scan-hero.png`, `expenses-month.png`, `shopping-location.png`. Task 3 references all six by these paths.

- [ ] **Step 1: Demo pantry data.** Replace `const inventory = [];` with ~7 `inventory_items` rows (fields per `InventoryItem` in `src/lib/types.ts`: `id, account_id, created_by_user_id, name, quantity, expiration_date, unit, description, metadata, deleted_at, created_at, updated_at`). Dates relative to the script's `now` (2026-11-27) so they read as: 1 expired (Milk, −1 day), 2–3 expiring soon (Yogurt +2, Bread +3, Eggs +5), 2–3 fine (Rice, Pasta, Olive oil; months out), 1 with no date (Salt). Check `src/lib/inventory.ts` for what counts as "expiring soon" and pick dates that hit each colour.
- [ ] **Step 2: Scan result + added shots.** In the mobile 390×760 block, after `scan-hero.png`: set a file on the hidden library input (`page.locator('input[type=file]:not([capture])').setInputFiles('public/landing/scan-hero.png')` — a path, since the runner has no `Buffer`), wait for the "Add 5 · €…" button, screenshot `scan-result.png`. Click that button, wait for the text "Expenses have been added successfully!", screenshot `scan-added.png`. The `receipt` mock already holds the Bulgarian Lidl lines.
- [ ] **Step 3: Pantry shot.** Go to `/inventory`, open the menu labelled "Sort", choose "Expiration", screenshot `pantry-expiry.png`. If expired items don't sort first, use the direction toggle the page offers.
- [ ] **Step 4:** Update the script's header comment to list all six output files.
- [ ] **Step 5: Run** via Playwright MCP `browser_run_code_unsafe` with `filename: scripts/landing-screenshots.playwright.js` (dev server on :3000). Expected return: `["expenses","scan","scan-result","scan-added","shopping","pantry"]` (names are the implementer's; must include all six).
- [ ] **Step 6: Look at each new PNG** (Read the image). Expected: result shows Cyrillic originals above English names and the "Add 5" button; added shows the success popup over the result; pantry shows red/orange/green status with the tab bar reading "Pantry" (Task 1 done). Then `cp .playwright-mcp/shots/{scan-result,scan-added,pantry-expiry}.png public/landing/` and `sips -g pixelWidth -g pixelHeight` each → 780×1520.
- [ ] **Step 7:** Also re-copy `scan-hero.png`, `expenses-month.png` and `shopping-location.png`: every phone shot shows the tab bar, which now says "Pantry".
- [ ] **Step 8:** `npx eslint scripts/landing-screenshots.playwright.js`; commit script + PNGs: `"Landing: scan result, added and pantry-by-expiry shots"`.

---

### Task 3: Carousel reducer, `HeroCarousel`, hero integration

**Files:**
- Create: `src/components/landing/carousel.ts`, `src/components/landing/carousel.test.ts`
- Create: `src/components/landing/HeroCarousel.tsx` (`"use client"`)
- Modify: `src/components/landing/PhoneFrame.tsx` (accept screen `children`)
- Modify: `src/components/landing/Hero.tsx` (use `HeroCarousel`, delete `LINES` and the floating `<ul>`)

**Interfaces:**
- Produces (`carousel.ts`):

```ts
export const SLIDE_MS = 3500;
export type PauseReason = "hover" | "focus" | "hidden";
export interface CarouselState {
  /** 0..count; `count` means the clone of slide 0 at the end of the track. */
  index: number;
  /** false for the one render that snaps from the clone back to 0 without a transition. */
  animate: boolean;
  paused: PauseReason[];
}
export type CarouselAction =
  | { type: "tick" }               // timer: advance one if not paused
  | { type: "goto"; index: number } // dot click, 0..count-1
  | { type: "transitionEnd" }      // track finished sliding
  | { type: "pause"; reason: PauseReason }
  | { type: "resume"; reason: PauseReason };
export const initialCarousel: CarouselState; // { index: 0, animate: true, paused: [] }
export function carouselReducer(count: number): (s: CarouselState, a: CarouselAction) => CarouselState;
export function activeSlide(s: CarouselState, count: number): number; // index % count (clone → 0)
```

- Produces (`PhoneFrame`): existing image props still work unchanged (expenses and shopping phones); alternatively `children: ReactNode` replaces the `<Image>` as the screen. Type it as a union so one of the two is required.

- [ ] **Step 1: Failing tests** in `carousel.test.ts` (count = 6):

```ts
const r = carouselReducer(6);
test("tick advances one", () => expect(r(initialCarousel, { type: "tick" }).index).toBe(1));
test("tick does nothing while paused", () =>
  expect(r({ ...initialCarousel, paused: ["hover"] }, { type: "tick" }).index).toBe(0));
test("wraps forward via the clone", () => {
  const onClone = r({ ...initialCarousel, index: 5 }, { type: "tick" });
  expect(onClone).toMatchObject({ index: 6, animate: true });
  expect(activeSlide(onClone, 6)).toBe(0);
  expect(r(onClone, { type: "transitionEnd" })).toMatchObject({ index: 0, animate: false });
});
test("transitionEnd elsewhere changes nothing but re-enables animation", () =>
  expect(r({ ...initialCarousel, index: 2, animate: false }, { type: "transitionEnd" })).toMatchObject({ index: 2, animate: true }));
test("next tick after the snap animates again", () =>
  expect(r({ ...initialCarousel, index: 0, animate: false }, { type: "tick" })).toMatchObject({ index: 1, animate: true }));
test("goto jumps", () => expect(r(initialCarousel, { type: "goto", index: 4 }).index).toBe(4));
test("goto from the clone lands on the slide", () =>
  expect(r({ ...initialCarousel, index: 6 }, { type: "goto", index: 3 })).toMatchObject({ index: 3, animate: true }));
test("goto ignores out-of-range", () => expect(r(initialCarousel, { type: "goto", index: 9 }).index).toBe(0));
test("stays paused until every reason clears", () => {
  let s = r(initialCarousel, { type: "pause", reason: "hover" });
  s = r(s, { type: "pause", reason: "hidden" });
  s = r(s, { type: "resume", reason: "hover" });
  expect(r(s, { type: "tick" }).index).toBe(0);
  s = r(s, { type: "resume", reason: "hidden" });
  expect(r(s, { type: "tick" }).index).toBe(1);
});
test("pausing twice for the same reason needs one resume", () => {
  let s = r(initialCarousel, { type: "pause", reason: "focus" });
  s = r(s, { type: "pause", reason: "focus" });
  s = r(s, { type: "resume", reason: "focus" });
  expect(s.paused).toEqual([]);
});
```

- [ ] **Step 2:** `npx vitest run src/components/landing/carousel.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement `carousel.ts` per the Interfaces block. A tick while on the clone (index === count) does nothing (waits for `transitionEnd`).
- [ ] **Step 4:** Run the test file → all PASS.
- [ ] **Step 5: `PhoneFrame` children.** Render `children` in place of the `<Image>` when given. Expenses and shopping phones in `Blocks.tsx` must look identical afterwards.
- [ ] **Step 6: `HeroCarousel`** (`"use client"`), rendered by `Hero.tsx` in the old phone's place with the same width (`w-[200px] lg:w-[220px]`) and hero shadow. Behaviour:
  - `SLIDES` const: `{ src, label, alt }` × 6 in spec order — `/landing/scan-hero.png` "Scan", `/landing/scan-result.png` "Translated", `/landing/scan-added.png` "Added", `/landing/expenses-month.png` "Expenses", `/landing/shopping-location.png` "Shopping", `/landing/pantry-expiry.png` "Pantry"; each alt describes the screen.
  - `useReducer(carouselReducer(SLIDES.length), initialCarousel)`.
  - Track: flex row of the 6 slides plus a clone of slide 0 (clone is `aria-hidden`, empty alt), `transform: translateX(-index*100%)`, `transition: transform 500ms ease-in-out` only when `animate`; `onTransitionEnd` → `transitionEnd`. All images `next/image` 780×1520, `sizes="220px"`. Slide 0: `preload`. Others: `loading="eager"` + `fetchPriority="low"` so they arrive before they're shown without competing with slide 0 (call made in place of `loading="lazy"`, which wouldn't fire for horizontally clipped slides and would flash blank).
  - Timer: `setInterval(() => dispatch({type:"tick"}), SLIDE_MS)` in an effect, skipped entirely when `matchMedia("(prefers-reduced-motion: reduce)")` matches (listen for changes).
  - Pause: `onMouseEnter/Leave` → hover; `onFocus/onBlur` on the wrapper (blur only when focus leaves it: check `relatedTarget`) → focus; `visibilitychange` → hidden.
  - Below the phone: the active label (`activeSlide`) in a `aria-live="polite"` element, then 6 dot `<button>`s (`aria-label="Show <label>"`, `aria-current` on the active one) → `goto`. Style to match the landing palette (`#14161c` active, `#14161c`/20% inactive), dots ≥ 24px hit area.
  - Wrapper: `role="region"`, `aria-roledescription="carousel"`, `aria-label="Lifestyle OS app screens"`.
- [ ] **Step 7: Browser check** (Playwright MCP against :3000, 1280 and 390 wide): slides advance every ~3.5 s right-to-left; 6 → 1 slides forward (no rewind); hovering stops it; clicking dot 5 shows "Shopping"; no blank screen when a slide enters; `browser_emulate_media` with `reducedMotion: "reduce"` → stays on "Scan" for 8 s, dots still work; expenses and shopping phones lower on the page unchanged. Screenshot the hero.
- [ ] **Step 8:** `npx eslint src/components/landing && npm test` → clean / all pass.
- [ ] **Step 9:** Commit: `"Landing: hero phone slides through six app screens"`.

---

### Task 4: README

**Files:** Modify: `README.md` (landing section, the **Images** line ~78)

- [ ] **Step 1:** List the six landing shots (`scan-hero.png`, `scan-result.png`, `scan-added.png`, `expenses-month.png`, `shopping-location.png`, `pantry-expiry.png`) and add one sentence: the hero phone rotates through them (`HeroCarousel.tsx`, logic in `carousel.ts`), pauses on hover/hidden tab, and stays still under reduced motion.
- [ ] **Step 2:** If the README names the "Inventory" tab in prose, say "Pantry" (URL stays `/inventory`).
- [ ] **Step 3:** Commit: `"README: hero carousel and Pantry tab name"`.
