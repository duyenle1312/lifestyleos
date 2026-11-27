# Landing stats strip

Date: 2026-11-27 · Size: small change · Approved in conversation

## Intent

Build trust on the landing page with a few usage figures, right after the "Reads receipts in" language pills.

## Design

- Four figures between the language pills and the "Works offline…" facts line, each a big number over a
  short label: **1,100+** expenses logged · **€10,000+** tracked · **160+** pantry items · **160+**
  shopping-list items. 2×2 on phones, one row of four from `sm` up.
- Fixed numbers in `src/components/landing/ProofStrip.tsx`, rounded down so they stay true as usage
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
