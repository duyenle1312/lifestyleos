# 6-digit email code sign-in — design

Date: 2026-11-22 · Size: small change

## Intent

Make email sign-in work inside the installed home-screen app (PWA). On iOS a home-screen app has its own
storage, separate from Safari. Tapping the magic link in Mail opens Safari and signs *Safari* in, while the
home-screen app stays on the login screen. A 6-digit code typed into the app itself signs in the app that
asked for it.

## Goals

- The sign-in email carries a 6-digit code; typing it on the "Check your email" screen signs in.
- Works for both existing users (Magic Link template) and new emails (Confirm signup template, which also
  creates the account).
- iOS can autofill the code from Mail (`autocomplete="one-time-code"`).

## Non-goals

- Changing password sign-in, sign-up, Set Password, or the rate-limit fallback to the password form.
- Removing the magic link or `/auth/confirm`.
- Showing different UI in the installed app vs. the browser — the code field is shown everywhere.

## Anti-goals

- A code entered in the app must never sign in a different browser/context than the one showing the field.
- No new Supabase endpoints, server routes, or secrets.

## Constraints

- Supabase `signInWithOtp` already generates a one-time code (`{{ .Token }}`) alongside the link on the same
  call; `verifyOtp({ email, token, type: "email" })` checks it. Code and link expire together (Email OTP
  Expiration, default 1 hour) and using one spends the other.
- Supabase dashboard **Authentication → Providers → Email → Email OTP Length** must be **6**. Newer projects
  can default to 8; the field only accepts 6 digits, so a mismatch would make every code fail.
- Templates live in the Supabase dashboard; `supabase/templates/*.html` are the git copies and must be
  re-pasted after the change (manual step for the user).
- Email scanners can open links but cannot type codes, so the code path is scanner-proof by design.

## Approaches

1. **Code + link in the email, code field always shown** *(picked)*. Smallest change; the link keeps working
   for desktop browsers, and the code works everywhere including the home-screen app.
2. **Code only, drop the link.** Simpler emails and one path to support, but removes a flow that works today
   on desktop and makes `/auth/confirm` dead code.
3. **Code field only in standalone (installed) mode.** Tailors UI per context, but adds a branch for little
   gain — the code works equally well in a browser tab.

## Design

**Emails** (`supabase/templates/magic_link.html`, `confirmation.html`):
- Lead with the code: `{{ .Token }}` in a large, letter-spaced monospace block (it is one token, so it can't
  be split into "123 456"), with copy like "Enter this code in Lifestyle OS".
- The existing button stays underneath as "Or sign in with this link" for desktop.
- Expiry copy stays "expires in 1 hour", covering both. Preview text mentions the code.
- Footer copy no longer says only the link/button can sign in.
- Subjects in `supabase/templates/README.md` updated (e.g. "Your Lifestyle OS sign-in code").

**App** (`src/components/AuthProvider.tsx`, `src/components/LoginView.tsx`):
- New `verifyEmailCode(email, code): Promise<boolean>` in `AuthProvider`, calling
  `supabase.auth.verifyOtp({ email, token: code, type: "email" })`. On error, sets a friendly message:
  "That code is wrong or has expired. Check the latest email or resend." Success flows through the existing
  `SIGNED_IN` listener (account setup unchanged).
- "Check your email" (`mode === "sent"`) screen: copy changes to "We sent a code to **email**. Enter it below,
  or open the link on this device." A single input: `inputMode="numeric"`, `autocomplete="one-time-code"`,
  `pattern="[0-9]*"`, `maxLength={6}`, autofocus, digits only (non-digits stripped, so pasting "123 456"
  works). It submits automatically when 6 digits are entered, plus a **Sign In** button for manual submit.
  On failure the field clears and keeps focus.
- "Resend Code" replaces "Resend Link" (same `sendMagicLink` call); "Use a different email" unchanged.

**README**: Sign-in section — the default method becomes "Email code + link", describe the code path and why
(home-screen app storage is separate from Safari), list Email OTP Length = 6 under "Supabase settings this
relies on", and update the offline table row ("sign-in by email code or link").

## ⚠️ Manual Supabase dashboard steps (user, before testing on a real email)

1. **Authentication → Providers → Email → Email OTP Length: set to 6.** Otherwise codes are 8 digits and the
   6-digit field rejects every one.
2. **Authentication → Emails → Templates: re-paste Magic Link and Confirm signup** from the updated
   `supabase/templates/magic_link.html` and `confirmation.html`, with the new subjects. Until then, emails
   carry no code.

## Left to the builder

- Exact email typography for the code block and exact wording within the tone above.
- Whether auto-submit is debounced or fires on the 6th digit change (must not double-submit while loading).
- Tests: unit-test the digit sanitising helper; `verifyEmailCode` error mapping if it is easy to isolate.
