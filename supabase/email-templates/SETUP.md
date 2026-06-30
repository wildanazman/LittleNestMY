# Branded auth emails (Resend + Supabase)

Goal: replace the generic `noreply@mail.app.supabase.io` "powered by Supabase" email with
LittleNest-branded emails sent from your own domain.

Two parts: **(A)** route Supabase emails through Resend SMTP, **(B)** paste these branded
templates. No app code changes — `localAuth.mjs` keeps calling Supabase Auth as-is.

---

## Prerequisites
- A domain you own with DNS access (e.g. `littlenestmy.com`). Free/gmail domains will NOT work.
- Supabase project admin access.
- Production app domain known (for the logo URL + redirect URLs).

---

## A. Resend SMTP

1. Sign up at https://resend.com
2. **Domains → Add Domain** → enter `littlenestmy.com` (or a subdomain like `mail.littlenestmy.com`).
3. Resend shows DNS records. Add them at your DNS provider:
   - **SPF** (TXT)
   - **DKIM** (TXT or CNAME)
   - **Return-Path / MX**
4. Wait until the domain shows **Verified** (green). DNS can take minutes–hours.
5. **API Keys → Create API Key** (Sending access). Copy it (`re_...`) — shown once.
6. SMTP credentials to use:
   | Field | Value |
   |-------|-------|
   | Host  | `smtp.resend.com` |
   | Port  | `465` (SSL) or `587` (TLS) |
   | User  | `resend` |
   | Pass  | your API key (`re_...`) |

---

## B. Supabase custom SMTP

Dashboard → **Authentication → Emails → SMTP Settings** → enable **Custom SMTP**:

- Sender email: `noreply@littlenestmy.com`  (must be on the verified domain)
- Sender name: `LittleNest`
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: `re_...` (Resend API key)

Save → **send a test email** to confirm delivery.

> Default Supabase email is rate-limited (~3–4/hr). Custom SMTP removes that and the
> Supabase branding.

---

## C. Paste branded templates

Dashboard → **Authentication → Email Templates**. For each type, paste the matching file
from this folder into the **Message body (HTML)** and set the subject:

| Supabase template       | File                  | Suggested subject                     |
|-------------------------|-----------------------|---------------------------------------|
| Confirm signup          | `confirm-signup.html` | Confirm your LittleNest email 💜       |
| Reset Password          | `reset-password.html` | Reset your LittleNest password        |
| Magic Link              | `magic-link.html`     | Your LittleNest sign-in link          |
| Change Email Address    | `change-email.html`   | Confirm your new LittleNest email     |

**Before saving each:** replace `https://littlenestmy.com` (logo URL) with your real production
domain. The `{{ .ConfirmationURL }}` tokens MUST stay — Supabase fills them in.

---

## D. Redirect URLs (avoid broken links)

Dashboard → **Authentication → URL Configuration**:
- **Site URL**: your production app origin (e.g. `https://littlenestmy.com`)
- **Redirect URLs**: add the app origin and the verify path, e.g.
  - `https://littlenestmy.com/**`
  - `https://littlenestmy.com/verify_pending/`
  - (and any Vercel preview domain you test on)

Also confirm **Authentication → Providers → Email → "Confirm email" is ENABLED** — otherwise
verification is skipped entirely and the guard in `navigation.mjs` never triggers.

---

## E. Verify end-to-end
1. Register a new test account in the app.
2. Email arrives from `noreply@littlenestmy.com`, branded, no Supabase footer.
3. Tap "Confirm my email" → lands on `verify_pending` (or app) verified.
4. Check Resend dashboard → **Logs** shows the delivered email.

---

## Notes
- Resend free tier: 3,000 emails/month, 100/day. Fine for early launch.
- These templates are plain inline-CSS HTML (email-client safe) — no Tailwind, no external CSS.
- Logo loads from `/icons/icon-192.png` on your domain; make sure that path is publicly served
  (it already is in `dist/`).
