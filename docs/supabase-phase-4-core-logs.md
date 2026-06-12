# LittleNest MY Supabase Phase 4 Core Logs

Phase 4 syncs the core baby logs to Supabase while keeping localStorage as cache and fallback.

## Synced Tables

- `feeding_logs`
- `sleep_logs`
- `diaper_logs`
- `health_notes`

## Still Local Only

- `growth_records`
- `milestones`
- `calendar_events`
- `reminders`
- `familyMembers`
- photos/storage
- family invitation email
- assistant data

## Migration

When a signed-in user opens a selected Supabase baby, the app attempts a safe one-time migration for that baby only:

- local feeding logs
- local sleep logs
- local diaper logs
- local health notes

The migration uses `littlenest:babyIdMap` from Phase 3 so logs saved under old local baby ids can be associated with the selected Supabase baby UUID.

The migration marker is:

```text
littlenest:coreLogsSupabaseMigratedAt
```

The value is a JSON object keyed by Supabase baby id, so switching to another baby can still migrate that baby safely.

## Fallback Behavior

If Supabase is unavailable, auth is missing, or RLS blocks an action, the app keeps localStorage logs visible and saves locally where safe. Local logs are not deleted after migration.

## RLS Expectations

- Parent can add, edit, and delete logs.
- Caregiver can add logs and manage their own log entries.
- Viewer can read only.
- Users cannot access logs for babies where they are not members.

If an RLS error appears, check the Phase 1 policies for the four core log tables.
