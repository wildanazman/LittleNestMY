# LittleNest MY Supabase Phase 3 Baby Profiles

Phase 3 moves baby profiles and baby membership to Supabase. Care logs and family prototype data remain in localStorage.

## What Uses Supabase Now

- Load baby profiles from `babies` where the signed-in user is a `baby_members` member.
- Create a baby in `babies`.
- Parent membership is created through the database trigger from Phase 1, with an additional client-side membership upsert attempt.
- Edit baby profile fields in `babies`.
- Switch selected baby by saving the Supabase baby id locally as a UI convenience.

## LocalStorage Fallback

The app still keeps localStorage baby profiles as a fallback. If a signed-in user has no Supabase babies but has local `littlenest:babyProfiles`, the app performs a one-time baby-profile-only migration to Supabase.

The old local baby profile list is backed up before the Supabase cache replaces it:

```text
littlenest:legacyBabyProfilesBeforeSupabase
```

The app also stores a local id map:

```text
littlenest:babyIdMap
```

This lets old local logs associated with a pre-Supabase baby id still appear when the selected baby is now a Supabase UUID.

## Not Migrated Yet

- Feeding logs
- Sleep logs
- Diaper logs
- Health notes
- Growth records
- Milestones
- Calendar events
- Reminders
- Family/caregiver local prototype data
- Photos into Supabase Storage
- Real email invitations

## RLS Notes

The expected RLS behavior is:

- Signed-in users can insert rows into `babies`.
- The `add_creator_as_parent_member` trigger inserts the creator into `baby_members` as `parent`.
- Users can read babies only when they are members.
- Parents can update baby profiles.

If create/read/update fails with an RLS error, check that the Phase 1 trigger and policies were pasted into Supabase SQL Editor.

## Next Phase

Phase 4 should migrate baby/profile photos to Supabase Storage. Keep logs local until storage and baby membership are stable.
