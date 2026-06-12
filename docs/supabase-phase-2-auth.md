# LittleNest MY Supabase Phase 2 Auth

Phase 2 replaces prototype auth with Supabase Auth only. Baby profiles, logs, growth records, milestones, calendar events, family data, settings, and local photos still remain in localStorage until later phases.

## Environment Variables

The browser app uses only frontend-safe Supabase variables:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` is not used in frontend code and must stay server-side only.

For this static app, `npm run dev` and `npm run build` generate `src/config/runtime-env.mjs` from `.env.local` or deployed environment variables. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are written into that browser file.

## Current Auth Flow

- Welcome checks the current Supabase session.
- Login uses `supabase.auth.signInWithPassword`.
- Sign up uses `supabase.auth.signUp`.
- Logout uses `supabase.auth.signOut`.
- App screens redirect logged-out users to Welcome.
- After signup/login, the app upserts a row in `profiles`.
- After auth succeeds, routing still checks local baby profiles and sends the user to either Home or Create Baby Profile.

## Email Confirmation

If Supabase email confirmation is enabled, sign up may create the user without an active session. In that case, the app shows a friendly "check your email" message and waits for the user to confirm before logging in.

## Data Boundary

Phase 2 does not migrate or delete localStorage care data. Existing local keys for babies, feeding, sleep, diapers, growth, milestones, calendar, family, reminders, language, and theme remain untouched.

## Next Phase

Phase 3 should sync baby profiles to Supabase while keeping localStorage as a fallback during testing. Do not migrate logs until baby membership and RLS behavior are verified.
