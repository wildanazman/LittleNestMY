-- LittleNest MY — formula brand on feeding logs.
-- Lets parents record which formula brand was used for a feed.

alter table if exists public.feeding_logs
  add column if not exists brand text;
