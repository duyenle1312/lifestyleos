# Landing stats strip

Date: 2026-11-27 · Size: small change · Approved in conversation

## Intent

Build trust on the landing page with a few usage figures, right after the "Reads receipts in" language pills.

## Design

- Revised by the user: the figures get their own full-width dark band (`#14161c`) with gold figures (`#e8c37a`)
  spread evenly across the content width, a hairline below it, headed "Our *achievements*", between the language strip (now pills, then the "Works offline…"
  facts line) and the dark "Made for people who just moved" band (`StatsBand.tsx`). Each figure is a big
  number over a short label: **1,100+** expenses logged · **€10,000+** tracked · **160+** pantry items · **160+**
  shopping-list items. 2×2 on phones, one row of four from `sm` up.
- Fixed numbers in `src/components/landing/StatsBand.tsx`, rounded down so they stay true as usage
  grows, with an "as of" date and the read-only SQL used, so updating means re-running it and editing
  four numbers. Nothing reads the database at runtime.
- Wording says what the app tracked, never who; no user count (too small to show in beta).

## Approaches

- **Fixed numbers, updated by hand (picked).** Tiny, no new database access or secrets.
- Live numbers from the database, refreshed hourly. Rejected for now: needs a public-safe database
  function, a server connection string in Vercel and caching. Worth it once the numbers are large.

## Figures as of 2026-11-27

Expenses (not deleted) 1,172 · EUR total €10,777 (plus one other currency) · pantry items 163 ·
shopping-list items 164 (all time; the data starts 26 Dec 2025).
