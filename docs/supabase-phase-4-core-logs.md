# LittleNest MY Supabase Phase 4 Core Logs

Phase 4 syncs the core baby logs to Supabase while keeping localStorage as cache and fallback.

## Synced Tables

- `feeding_logs`
- `sleep_logs`
- `diaper_logs`
- `health_notes`

## Still Local Only

- `milestones`
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

## Calendar Events (Phase 6)

Calendar events sync via `src/utils/calendarEventsRemote.mjs` following the same pattern as milestones (`milestonesRemote.mjs`).

### Synced Table

- `calendar_events`

### Migration marker

```text
littlenest:calendarEventsSupabaseMigratedAt
```

### Category check constraint note

The Supabase `calendar_events` table has a check constraint on `category`:
`('clinic', 'vaccine', 'daycare', 'school', 'family', 'medicine', 'health', 'other')`

Migration `008_calendar_events_health_category.sql` adds `'health'` to the original constraint.
Run this migration before using calendar event sync, or `saveCalendarEventRemote` will reject events with `type: "health"`.

## Growth Records (Phase 7)

Growth records sync via `src/utils/growthRecordsRemote.mjs`.

### Synced Table

- `growth_records`

### Migration marker

```text
littlenest:growthRecordsSupabaseMigratedAt
```

## Reminders (Phase 7)

Reminders sync via `src/utils/remindersRemote.mjs`.

### Synced Table

- `reminders`

### Migration marker

```text
littlenest:remindersSupabaseMigratedAt
```

### Schema note

The `reminders` table has a FK `calendar_event_id` referencing `calendar_events(id)`. The remote module sets this column only when the local `sourceId` is a UUID (i.e., it came from a real calendar event). Standalone reminders (e.g. feeding reminders from the mommy guide) leave it null.

If an RLS error appears, check the Phase 1 policies for the four core log tables.
