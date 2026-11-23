# 6-digit Email Code Sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> ## ⚠️ Reminder for the user — two manual Supabase dashboard steps
> These can't be done from code. Do them before testing with a real email (see Task 4):
> 1. **Authentication → Providers → Email → Email OTP Length = 6.**
> 2. **Authentication → Emails → Templates:** re-paste **Magic Link** and **Confirm signup** from the updated
>    `supabase/templates/` files, with the new subjects.

**Goal:** Let users sign in by typing the 6-digit code from the sign-in email, so sign-in works inside the iOS home-screen app (whose storage is separate from Safari).

**Architecture:** No backend change. `signInWithOtp` already generates `{{ .Token }}`; the email templates start printing it, and the "Check your email" screen in `LoginView` gets a code field that calls a new `verifyEmailCode` in `AuthProvider` (`supabase.auth.verifyOtp({ email, token, type: "email" })`). Digit sanitising lives in a small pure module so it can be unit-tested in the existing Node Vitest setup.

**Tech Stack:** Next.js (App Router, client components), React, Supabase JS v2, Tailwind, Vitest (node env, `src/**/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-11-22-email-code-sign-in-design.md`

## Global Constraints

- Code length is exactly **6** digits (`EMAIL_CODE_LENGTH = 6`).
- Wrong/expired code message, verbatim: `That code is wrong or has expired. Check the latest email or resend.`
- Sent-screen copy, verbatim: `We sent a code to <b>{email}</b>. Enter it below, or open the link on this device.`
- Resend button label: `Resend Code`. Email subjects: Magic Link → `Your Lifestyle OS sign-in code`; Confirm signup → `Welcome to Lifestyle OS — your sign-in code`.
- Password sign-in, sign-up, Set Password, rate-limit fallback and `/auth/confirm` are unchanged. The link stays in both emails.
- Never run `next build` in the repo while the dev server on :3000 runs; build in a scratch copy if a build is needed.
- `AGENTS.md`: check `node_modules/next/dist/docs/` before using any Next API you're unsure of (this task needs none beyond client components).

## Review Focus

1. **Pasting "123 456" or "123-456"** from the email → field holds `123456` and signs in (Task 1 test).
2. **Pasting a longer string (e.g. an 8-digit code if the dashboard setting was missed)** → field keeps the first 6 digits; the verify fails with the friendly message rather than crashing (Task 1 test truncation; message in Task 2).
3. **Auto-submit firing twice** (6th digit typed while a verify is in flight, or iOS autofill firing input twice) → exactly one `verifyOtp` call; Task 2 guards on `isLoading` and a submitted-code ref.
4. **Email with surrounding spaces** → the code is verified against the same trimmed email the code was sent to (Task 2 uses `email.trim()` in both calls).
5. **Resend, then typing the old code** → old code is rejected by Supabase with the friendly message; field clears and keeps focus (Task 2 manual check).

---

### Task 1: Code sanitising helper

**Files:**
- Create: `src/lib/emailCode.ts`
- Test: `src/lib/emailCode.test.ts`

**Interfaces:**
- Produces: `export const EMAIL_CODE_LENGTH = 6;` · `export function sanitizeEmailCode(input: string): string` (digits only, truncated to `EMAIL_CODE_LENGTH`) · `export function isCompleteEmailCode(code: string): boolean` (exactly 6 digits).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { EMAIL_CODE_LENGTH, isCompleteEmailCode, sanitizeEmailCode } from "./emailCode";

describe("sanitizeEmailCode", () => {
  it("keeps plain digits", () => expect(sanitizeEmailCode("123456")).toBe("123456"));
  it("strips spaces and dashes from pasted codes", () => {
    expect(sanitizeEmailCode("123 456")).toBe("123456");
    expect(sanitizeEmailCode(" 123-456 ")).toBe("123456");
  });
  it("drops letters", () => expect(sanitizeEmailCode("12a3b4")).toBe("1234"));
  it("truncates to the code length", () => expect(sanitizeEmailCode("12345678")).toBe("123456"));
  it("returns empty for no digits", () => expect(sanitizeEmailCode("abc")).toBe(""));
});

describe("isCompleteEmailCode", () => {
  it("is 6", () => expect(EMAIL_CODE_LENGTH).toBe(6));
  it("accepts exactly 6 digits", () => expect(isCompleteEmailCode("123456")).toBe(true));
  it("rejects short or non-digit codes", () => {
    expect(isCompleteEmailCode("12345")).toBe(false);
    expect(isCompleteEmailCode("12345a")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/lib/emailCode.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement the three exports in `src/lib/emailCode.ts`** (regex `\D` strip + `slice`; `/^\d{6}$/` built from the constant).
- [ ] **Step 4: Run to verify it passes** — same command → all PASS; `npm test` → whole suite PASS.
- [ ] **Step 5: Commit** — `git add src/lib/emailCode.ts src/lib/emailCode.test.ts && git commit -m "Email code sanitising helper"`

### Task 2: Verify the code in the app

**Files:**
- Modify: `src/components/AuthProvider.tsx` (interface `AuthState` near line 28; new callback after `sendMagicLink` ~line 144; context value ~line 248)
- Modify: `src/components/LoginView.tsx` (top-of-file comment; `mode === "sent"` block)

**Interfaces:**
- Consumes: `sanitizeEmailCode`, `isCompleteEmailCode`, `EMAIL_CODE_LENGTH` from Task 1.
- Produces: `verifyEmailCode: (email: string, code: string) => Promise<boolean>` on `AuthState`.

- [ ] **Step 1: Add `verifyEmailCode` to `AuthProvider`.** Sets `isLoading`, clears error, calls `supabase.auth.verifyOtp({ email, token: code, type: "email" })`. On any Supabase auth error → `setError("That code is wrong or has expired. Check the latest email or resend.")`, return `false`. Non-auth/network failures → `setError(errorMessage(e))`, `false`. Success → `true`; the existing `onAuthStateChange` `SIGNED_IN` path handles session and account setup (don't duplicate it). Add a JSDoc line: the code works inside the home-screen app because nothing leaves the app. Add it to the memoised context value and its deps.
- [ ] **Step 2: Update the sent screen in `LoginView`.**
  - Copy: Global Constraints sent-screen text (email in `font-semibold text-label`).
  - Input: `fieldClass` + `text-center tracking-[0.5em] text-[22px]`, `inputMode="numeric"`, `autoComplete="one-time-code"`, `pattern="[0-9]*"`, `autoFocus`, `aria-label="Sign-in code"`, placeholder `000000`, value from `sanitizeEmailCode(e.target.value)`. **No `maxLength` attribute**: browsers truncate a pasted "123 456" to "123 45" before `onChange`; `sanitizeEmailCode` enforces the 6-digit cap instead.
  - Auto-submit: when the sanitised value `isCompleteEmailCode` and not `isLoading`, call `verifyEmailCode(email.trim(), code)` once (guard with a `useRef` of the last submitted code so autofill double-input can't double-submit). On `false`: clear the code and refocus the input (ref).
  - Buttons: primary **Sign In** (submits the code; disabled unless complete or while loading), secondary **Resend Code** (`linkButton`, calls `sendMagicLink` as before and clears the code), **Use a different email** unchanged. The form's `onSubmit` in `sent` mode verifies the code instead of resending.
  - Update the file's top comment to mention the code path.
- [ ] **Step 3: Verify** — `npx tsc --noEmit` and `npm run lint` clean; `npm test` PASS.
- [ ] **Step 4: Manual check on the running dev server** (http://localhost:3000, don't build in repo): enter an email → sent screen shows the field, numeric keypad hint, focus; typing letters does nothing; pasting `123 456` shows `123456` and fires exactly one `verifyOtp` request (Network tab) → friendly error, field cleared and focused. Mobile width 390px looks right. (A real successful code needs the Task 4 dashboard steps.)
- [ ] **Step 5: Commit** — `git add src/components/AuthProvider.tsx src/components/LoginView.tsx && git commit -m "Sign in with the 6-digit code from the email"`

### Task 3: Email templates and docs

**Files:**
- Modify: `supabase/templates/magic_link.html`, `supabase/templates/confirmation.html`, `supabase/templates/README.md`
- Modify: `README.md` (Sign-in section ~lines 77–124; offline table ~line 242)

- [ ] **Step 1: Templates.** In both files, above the existing button: copy `Enter this code in Lifestyle OS:` and `{{ .Token }}` in a large monospace, letter-spaced block (inline styles only, e.g. `font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:34px; letter-spacing:8px; font-weight:700`). Keep the button, preceded by a small line `Or sign in with this link on this device:`. Intro copy: `This code and link expire in 1 hour.` Preview text: `Your Lifestyle OS sign-in code`. Footers: drop "without this link / clicking the button above" → `nobody can sign in without this code or link.` Keep `href` exactly as is.
- [ ] **Step 2: Templates README.** Subjects per Global Constraints; say both templates show `{{ .Token }}` (verified in the app by `verifyEmailCode`) plus the link; note the code needs **Email OTP Length = 6**.
- [ ] **Step 3: README.** Sign-in table: default method becomes **Email code + link** — enter email, get a 6-digit code and a link; type the code in the app (works in the home-screen app, whose storage is separate from Safari, and is immune to email scanners) or open the link on the same device. `Code`: `sendMagicLink`, `verifyEmailCode`. Add to "Supabase settings this relies on": Email OTP Length = 6. Offline table: "sign-in by email code or link". Mention that `/auth/confirm` is the link path only.
- [ ] **Step 4: Verify** — open each template in a browser (`open supabase/templates/magic_link.html`) and check it renders; `git diff README.md` reads correctly.
- [ ] **Step 5: Commit** — `git add supabase/templates README.md && git commit -m "Email templates show the sign-in code; README"`

### Task 4: ⚠️ Manual Supabase dashboard steps + end-to-end check (user)

Not for a subagent. The controller reminds the user at the end of execution and waits.

- [ ] **Step 1 (user):** Supabase → Authentication → Providers → Email → **Email OTP Length = 6** → Save.
- [ ] **Step 2 (user):** Authentication → Emails → Templates → paste **Magic Link** from `supabase/templates/magic_link.html` (subject `Your Lifestyle OS sign-in code`) and **Confirm signup** from `confirmation.html` (subject `Welcome to Lifestyle OS — your sign-in code`) → Save each.
- [ ] **Step 3 (user + controller):** End-to-end: request a code on localhost (or a preview), confirm the email shows a 6-digit code, type it → signed in, lands on Expenses. Then on iPhone home-screen app after deploy: sign in with the code without leaving the app.
