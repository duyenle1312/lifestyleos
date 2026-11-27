# Hero phone carousel + "Pantry" tab name

Date: 2026-11-27 · Size: small change

## Intent

The landing hero shows one static phone (the scan screen). Replace it with one phone that plays through
the app's story on a loop, so a visitor sees the whole flow in a few seconds without scrolling:
scan → translated result → added → expenses → shopping → pantry.

Separately, the app's "Inventory" tab is called "Pantry" everywhere on the landing page; rename the
visible label in the app so the two match.

## Goals

- One phone in the hero, six screens, sliding automatically from one to the next and looping.
- All screens are real app screenshots with fake demo data, made by `scripts/landing-screenshots.playwright.js`.
- The visible word "Inventory" in the app becomes "Pantry".

## Non-goals / anti-goals

- No video, no recreated HTML screens (approaches B and C below).
- Not a 3D flip; it must not feel tiring after several loops.
- The first screen must not load slower than today; the hero is the first thing people see.
- The `/inventory` URL, database table and code names stay as they are (renaming them breaks bookmarks
  and home-screen installs for no visible gain).

## Approaches

- **A. Rotating screenshots (picked).** Six PNGs from the screenshot script; the hero phone slides
  between them on a timer. Light, sharp, easy to re-shoot.
- B. Recorded video of the real flow. Most alive, but heavier, fiddly to re-record, and iOS Low Power
  Mode can block autoplay.
- C. Rebuilt HTML screens with animated taps. Most flexible, but a second copy of the app UI that drifts.

User picked A with a slide transition, then changed it to three rotating phones (see Motion).

## Design

**Slides, in order** (390×760 phone shots, light theme, the existing demo data):

1. Scan: the scan screen before scanning (today's `scan-hero.png`).
2. Translated: the scan result after a mocked scan of the Bulgarian Lidl receipt: original-language
   names above the English ones.
3. Added: the same screen with the "Expenses have been added successfully!" popup.
4. Expenses: the expenses month (today's `expenses-month.png`).
5. Shopping: the shopping list grouped by location (today's `shopping-location.png`).
6. Pantry: the pantry sorted by expiration, with a mix of expired / expiring soon / fine items (new demo
   inventory data).

**Motion (revised by the user after seeing the slider).** Three phones show at a time: the current slide
in front, the previous and next ones smaller and angled in on either side, the rest out of sight behind.
Every ~3.5 s they rotate one step, so the right-hand phone comes to the front, endlessly. Clicking a side
phone brings it to the front. (A slider inside one phone, and a single phone flipping edge-on, were tried
and rejected.) Then styled after the user's reference (`public/aether_three_phones_hero_animation.html`): side phones also tilted outward and pushed back, springy easing, gentle float, a slight tilt towards the mouse, and an entrance where the phones rise into place. The "Added" success screen was dropped, leaving five slides.
Under the phone: a short label for the current slide ("Scan", "Translated", "Added", "Expenses",
"Shopping", "Pantry") and six dots; clicking a dot jumps there.

**Pausing.** Pauses while hovered/focused and while the tab is hidden. With "reduce motion" turned on it
doesn't advance on its own and shows slide 1; the dots still work.

**Loading.** Slide 1 is preloaded as today; the others load lazily after the page is up.

**Floating receipt card.** My call: remove it. Slide 2 now shows the translated lines in the app itself,
and the card would cover part of every other slide.

**Accessibility.** The carousel is labelled, each slide's image has its own alt text, and the label text
is announced politely when it changes (not on every auto-advance if that proves noisy — builder's call).

**Pantry rename.** Visible "Inventory" → "Pantry" in: the tab bar (`src/components/AppShell.tsx`), the back
link on the item detail page (`src/app/(app)/inventory/[id]/page.tsx`), and the share image's feature list
(`src/app/opengraph-image.tsx`). The README's dark-theme screenshots are left as they are.

**Docs.** README's landing-images line lists the new files and says the hero rotates.

## Left to the builder

Exact timing and easing, component split (a small client component inside the otherwise server-rendered
hero), file names for the new shots, and the demo pantry items.
