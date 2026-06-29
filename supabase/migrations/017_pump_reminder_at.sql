-- One-off "next session" reminder support for pump schedules.
-- reminder_at = an absolute timestamp the cron should push once (then it
-- deactivates the row). NULL means a normal recurring daily pump time.
alter table public.mama_pump_schedules
  add column if not exists reminder_at timestamptz;
