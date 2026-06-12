# LittleNest MY Supabase Phase 1

Phase 1 adds Supabase project configuration and the initial database/RLS schema only. The current app still uses localStorage for login, baby profiles, logs, photos, and settings.

## Create The Supabase Project

1. Go to Supabase and create a new project.
2. Choose the region closest to your users, for example Singapore for Malaysia/Southeast Asia.
3. Wait for the project to finish provisioning.
4. Open Project Settings > API.
5. Copy the Project URL and anon public key.

## Paste The SQL

1. In Supabase, open SQL Editor.
2. Create a new query.
3. Paste the full contents of `supabase/migrations/001_initial_schema.sql`.
4. Run the query.
5. Confirm the tables appear under Table Editor.

The schema enables Row Level Security and creates policies for parent, caregiver, and viewer access.

## Environment Variables

Create a local `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Use these variables:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

These two variables are frontend-safe because Supabase expects the anon key to be used in browser apps together with RLS policies.

Keep this one server-side only later:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code, Vite variables, browser bundles, GitHub public repos, screenshots, or client logs. It bypasses RLS and should only be used inside trusted server functions.

## Current Phase Boundary

Not changed in Phase 1:

- localStorage login/signup/logout
- localStorage baby profiles
- localStorage logs, calendar events, reminders, and milestones
- local photo data URLs
- family invite email sending
- frontend data migration
- UI design

## Next Phase Recommendation

Phase 2 should connect Supabase Auth while keeping localStorage data untouched. Add login/signup/logout against Supabase, keep a fallback path during testing, and only redirect into the existing baby-profile flow after a Supabase session exists.

After Auth is stable, Phase 3 can sync baby profiles and membership data. Logs should move after baby membership and RLS have been verified.
