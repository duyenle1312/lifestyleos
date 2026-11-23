# Supabase auth email templates

Paste into **Supabase Dashboard → Authentication → Emails → Templates**. The dashboard is the source of truth; these files are just the copy we keep in git.

| Dashboard template | File | Subject | Sent when |
|---|---|---|---|
| Magic Link | `magic_link.html` | `Your Lifestyle OS sign-in code` | An existing user requests a sign-in code or link |
| Confirm signup | `confirmation.html` | `Welcome to Lifestyle OS — your sign-in code` | A new email requests a code or link (this also creates the account) |

Both templates show the 6-digit code (`{{ .Token }}`, which the app checks with `verifyEmailCode`) above a button with the link. The code needs **Email OTP Length = 6** (Authentication → Sign In / Providers → Email). The button links to `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`. `RedirectTo` is `<site>/auth/confirm` (set by `emailRedirectTo` in `src/components/AuthProvider.tsx`). That page signs the user in only when they press **Continue**.

Why not `{{ .ConfirmationURL }}`: email security scanners (Outlook Safe Links, Microsoft Defender, Mimecast) open every link in an email before the user does. `ConfirmationURL` verifies on that first visit, so the scanner uses up the one-time link and the user gets "link expired". Loading `/auth/confirm` spends nothing.

`/auth/confirm` must be allowed in **Authentication → URL Configuration → Redirect URLs** (for example `https://www.lifestyleos.homes/**` and `http://localhost:3000/**`). Otherwise Supabase swaps in the Site URL and the link lands on the wrong page.

The "expires in 1 hour" text matches the default **Email OTP Expiration** (Authentication → Sign In / Providers → Email). Update the copy if you change it.
