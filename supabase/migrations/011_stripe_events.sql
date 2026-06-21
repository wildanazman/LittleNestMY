-- LittleNest MY — Stripe webhook idempotency log.
-- Stripe can deliver the same event more than once. Recording each handled
-- event id lets the webhook skip duplicates instead of re-applying changes.

create table if not exists public.stripe_events (
  id text primary key,            -- Stripe event id (evt_…)
  type text,
  processed_at timestamptz not null default now()
);

-- Only the service role (used by the webhook) touches this table. RLS on with
-- no policies = no anon/auth access; the service key bypasses RLS.
alter table public.stripe_events enable row level security;
