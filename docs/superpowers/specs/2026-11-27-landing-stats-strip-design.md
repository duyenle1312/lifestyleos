# Landing stats strip

Date: 2026-11-27 · Size: small change · Approved in conversation

## Intent

Build trust on the landing page with a few usage figures, right after the "Reads receipts in" language pills.

## Design

- Revised by the user: the figures get their own section on the cream page background (like the hero) with bold gold-gradient figures (`#f2bf4a` → `#e2a52c` → `#cf9019`, top to bottom; the heading accent uses it too)
  spread evenly across the content width, a hairline below it, headed "Our *Achievements*", between the language strip (now pills, then the "Works offline…"
  facts line) and the dark "Made for people who just moved" band (`StatsBand.tsx`). Each figure is a big
  number over a short label: **1,172** Expenses Logged · **€10,777** Tracked · **163** Pantry Items · **164**
  Shopping List Items (exact figures with a "+" after each, as the user asked). Heading the same size as "Made for people who just moved"; 2×2 up to `lg`, one row of four from `lg`.
- Fixed numbers in `src/components/landing/StatsBand.tsx`, with an "as of" date and the read-only SQL used, so updating means re-running it and editing
  four numbers. Nothing reads the database at runtime.
- Wording says what the app tracked, never who; no user count (too small to show in beta).

## Approaches

- **Fixed numbers, updated by hand (picked).** Tiny, no new database access or secrets.
- Live numbers from the database, refreshed hourly. Rejected for now: needs a public-safe database
  function, a server connection string in Vercel and caching. Worth it once the numbers are large.

## Figures as of 2026-11-27

Expenses (not deleted) 1,172 · EUR total €10,777 (plus one other currency) · pantry items 163 ·
shopping-list items 164 (all time; the data starts 26 Dec 2025).
