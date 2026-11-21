# Supabase auth email templates

Paste into **Supabase Dashboard → Authentication → Emails → Templates**. The dashboard is the source of truth; these files are just the copy we keep in git.

| Dashboard template | File | Subject | Sent when |
|---|---|---|---|
| Magic Link | `magic_link.html` | `Your Lifestyle OS sign-in link` | An existing user requests a sign-in link |
| Confirm signup | `confirmation.html` | `Welcome to Lifestyle OS — confirm your email` | A new email requests a link (this also creates the account) |

Both use `{{ .ConfirmationURL }}`, which signs the user in and redirects to `/expenses` (set by `emailRedirectTo` in `src/components/AuthProvider.tsx`).

The "expires in 1 hour" text matches the default **Email OTP Expiration** (Authentication → Providers → Email). Update the copy if you change it.
