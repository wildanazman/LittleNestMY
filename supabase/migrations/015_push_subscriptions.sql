-- LittleNest MY — Web Push subscriptions.
-- Stores each device's push endpoint so the reminders cron can deliver
-- notifications when the app is closed.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- A user manages only their own subscriptions. The reminders cron uses the
-- service role, which bypasses RLS, to read all subscriptions.
drop policy if exists "Users manage own push subscriptions (select)" on public.push_subscriptions;
create policy "Users manage own push subscriptions (select)" on public.push_subscriptions for select using (user_id = auth.uid());
drop policy if exists "Users manage own push subscriptions (insert)" on public.push_subscriptions;
create policy "Users manage own push subscriptions (insert)" on public.push_subscriptions for insert with check (user_id = auth.uid());
drop policy if exists "Users manage own push subscriptions (update)" on public.push_subscriptions;
create policy "Users manage own push subscriptions (update)" on public.push_subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users manage own push subscriptions (delete)" on public.push_subscriptions;
create policy "Users manage own push subscriptions (delete)" on public.push_subscriptions for delete using (user_id = auth.uid());
