# Supabase auth email templates

Paste into **Supabase Dashboard → Authentication → Emails → Templates**. The dashboard is the source of truth; these files are just the copy we keep in git.

| Dashboard template | File | Subject | Sent when |
|---|---|---|---|
| Magic Link | `magic_link.html` | `Your Lifestyle OS sign-in link` | An existing user requests a sign-in link |
| Confirm signup | `confirmation.html` | `Welcome to Lifestyle OS — confirm your email` | A new email requests a link (this also creates the account) |

Both link to `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`. `RedirectTo` is `<site>/auth/confirm` (set by `emailRedirectTo` in `src/components/AuthProvider.tsx`). That page signs the user in only when they press **Continue**.

Why not `{{ .ConfirmationURL }}`: email security scanners (Outlook Safe Links, Microsoft Defender, Mimecast) open every link in an email before the user does. `ConfirmationURL` verifies on that first visit, so the scanner uses up the one-time link and the user gets "link expired". Loading `/auth/confirm` spends nothing.

`/auth/confirm` must be allowed in **Authentication → URL Configuration → Redirect URLs** (for example `https://www.lifestyleos.homes/**` and `http://localhost:3000/**`). Otherwise Supabase swaps in the Site URL and the link lands on the wrong page.

The "expires in 1 hour" text matches the default **Email OTP Expiration** (Authentication → Providers → Email). Update the copy if you change it.
