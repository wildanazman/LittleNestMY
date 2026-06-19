-- LittleNest MY Premium Plan (one-time purchase).

alter table if exists public.profiles
  add column if not exists plan text not null default 'free',
  add column if not exists stripe_customer_id text;

-- 'free' or 'premium'
do $$ begin
  create type public.subscription_plan as enum ('free', 'premium');
exception
  when duplicate_object then null;
end $$;
