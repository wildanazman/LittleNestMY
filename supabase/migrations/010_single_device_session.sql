-- LittleNest MY — single active device per account.
-- Each login writes a fresh random session id onto the user's profile. Any
-- other device whose locally-stored id no longer matches is signed out, so a
-- husband + wife cannot share one account on two phones to dodge a paid plan.

alter table public.profiles
  add column if not exists active_session_id text;

-- The owner already has select/update on their own profile row
-- (see policies in 001_initial_schema.sql), so no new policy is required.

-- Enable realtime on profiles so an already-open app is kicked the instant
-- another device claims the slot (without this, the stale device is still
-- evicted on its next screen load via verifyDeviceSession — just not instantly).
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;  -- already in the publication
  when undefined_object then null;  -- publication missing (realtime off) — skip
end $$;
