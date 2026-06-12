# LittleNest MY Supabase Phase 5A Family Invites

Phase 5A replaces the Family & Caregivers prototype invite with a real Supabase-backed invitation flow.

## Tables Used

- `family_invitations`
- `baby_members`
- `profiles`

## Server Functions

- `POST /api/family-invitations`
  - Verifies the signed-in user.
  - Verifies the user is `parent` for the selected baby.
  - Creates or refreshes a `family_invitations` row.
  - Sends a Supabase Auth invite email.

- `GET /api/family-invitations?babyId=...`
  - Lists care-circle members and invite status.
  - Parents can see invitations.

- `DELETE /api/family-invitations`
  - Parents can revoke pending/failed invitations or remove members.

- `POST /api/accept-family-invite`
  - Verifies the signed-in invited user.
  - Validates the invite token and email.
  - Creates the `baby_members` row.
  - Marks the invitation as accepted.

## Environment Variables

Frontend-safe:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Server-side only:

```bash
SUPABASE_SERVICE_ROLE_KEY=
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend files. It is used only inside Vercel API functions.

## Supabase SQL

Run this migration in Supabase before testing failed invite status:

```text
supabase/migrations/002_family_invitation_failed_status.sql
```

It allows `family_invitations.status = 'failed'`.

## Email Sending

The app uses `supabase.auth.admin.inviteUserByEmail`. Real email delivery depends on Supabase Auth email settings. Supabase's default email can work for development, but production should configure SMTP or a provider such as Resend for better deliverability and branding.

## Local Testing

The current `npm run dev` static server does not run Vercel API routes. Use Vercel for end-to-end invite testing:

```bash
npx vercel dev
```

Then open the local Vercel URL and test from a confirmed parent account.

## Not Changed

- growth records
- milestones
- calendar/reminders
- photos/storage
- AI assistant
- core log sync
- baby profile sync
