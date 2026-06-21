-- LittleNest MY — diaper brand + rash tracking.
-- Lets parents record which diaper brand was used and whether that change came
-- with a rash / skin irritation, so they can spot a brand that doesn't suit
-- their baby.

alter table if exists public.diaper_logs
  add column if not exists brand text,
  add column if not exists had_rash boolean not null default false;
