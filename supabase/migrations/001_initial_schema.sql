-- LittleNest MY Phase 1 Supabase schema.
-- Paste this into the Supabase SQL editor or run it with the Supabase CLI.

create extension if not exists pgcrypto;

do $$
begin
  create type public.baby_member_role as enum ('parent', 'caregiver', 'viewer');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.babies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date_of_birth date not null,
  gender text,
  photo_url text,
  feeding_preference text,
  notes text,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.baby_members (
  baby_id uuid not null references public.babies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.baby_member_role not null default 'viewer',
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (baby_id, user_id)
);

create table if not exists public.family_invitations (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  email text not null,
  role public.baby_member_role not null default 'viewer',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  token text not null default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  accepted_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (baby_id, email, status)
);

create table if not exists public.feeding_logs (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  feeding_type text not null check (feeding_type in ('breastfeeding', 'bottle', 'formula', 'solid')),
  amount_ml numeric(8,2),
  amount_grams numeric(8,2),
  duration_minutes integer,
  started_at timestamptz not null,
  ended_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes integer,
  sleep_type text default 'nap',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sleep_time_order check (ended_at is null or ended_at >= started_at)
);

create table if not exists public.diaper_logs (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  diaper_type text not null check (diaper_type in ('pee', 'poop', 'mixed')),
  color text,
  texture text,
  note text,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_notes (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  note_type text not null default 'note',
  title text not null,
  body text,
  temperature_c numeric(4,1),
  medicine_name text,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.growth_records (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  weight_kg numeric(6,3),
  length_cm numeric(6,2),
  height_cm numeric(6,2),
  head_circumference_cm numeric(6,2),
  measured_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_growth_measurement_required check (
    weight_kg is not null
    or length_cm is not null
    or height_cm is not null
    or head_circumference_cm is not null
  )
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null,
  milestone_type text,
  happened_on date not null,
  note text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null,
  category text not null check (category in ('clinic', 'vaccine', 'daycare', 'school', 'family', 'medicine', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  reminder_minutes_before integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_time_order check (ends_at is null or ends_at >= starts_at)
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  calendar_event_id uuid references public.calendar_events(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null,
  reminder_type text not null default 'custom',
  scheduled_at timestamptz not null,
  enabled boolean not null default true,
  repeat_rule jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.photo_metadata (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references public.babies(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  storage_bucket text not null,
  storage_path text not null,
  content_type text,
  size_bytes integer,
  purpose text not null check (purpose in ('parent_avatar', 'baby_avatar', 'milestone_photo', 'health_note_photo', 'other')),
  related_table text,
  related_id uuid,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists baby_members_user_id_idx on public.baby_members(user_id);
create index if not exists family_invitations_baby_id_idx on public.family_invitations(baby_id);
create index if not exists feeding_logs_baby_started_idx on public.feeding_logs(baby_id, started_at desc);
create index if not exists sleep_logs_baby_started_idx on public.sleep_logs(baby_id, started_at desc);
create index if not exists diaper_logs_baby_logged_idx on public.diaper_logs(baby_id, logged_at desc);
create index if not exists health_notes_baby_logged_idx on public.health_notes(baby_id, logged_at desc);
create index if not exists growth_records_baby_measured_idx on public.growth_records(baby_id, measured_at desc);
create index if not exists milestones_baby_happened_idx on public.milestones(baby_id, happened_on desc);
create index if not exists calendar_events_baby_starts_idx on public.calendar_events(baby_id, starts_at);
create index if not exists reminders_baby_scheduled_idx on public.reminders(baby_id, scheduled_at);
create index if not exists photo_metadata_baby_id_idx on public.photo_metadata(baby_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_baby_member(target_baby_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.baby_members
    where baby_id = target_baby_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_baby_role(target_baby_id uuid, allowed_roles public.baby_member_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.baby_members
    where baby_id = target_baby_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

create or replace function public.can_add_baby_logs(target_baby_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.has_baby_role(target_baby_id, array['parent', 'caregiver']::public.baby_member_role[]);
$$;

create or replace function public.add_creator_as_parent_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.baby_members (baby_id, user_id, role, invited_by)
  values (new.id, new.created_by, 'parent', new.created_by)
  on conflict (baby_id, user_id) do update set role = 'parent', updated_at = now();

  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'babies',
    'baby_members',
    'family_invitations',
    'feeding_logs',
    'sleep_logs',
    'diaper_logs',
    'health_notes',
    'growth_records',
    'milestones',
    'calendar_events',
    'reminders'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;

drop trigger if exists add_creator_as_parent_member on public.babies;
create trigger add_creator_as_parent_member
after insert on public.babies
for each row execute function public.add_creator_as_parent_member();

alter table public.profiles enable row level security;
alter table public.babies enable row level security;
alter table public.baby_members enable row level security;
alter table public.family_invitations enable row level security;
alter table public.feeding_logs enable row level security;
alter table public.sleep_logs enable row level security;
alter table public.diaper_logs enable row level security;
alter table public.health_notes enable row level security;
alter table public.growth_records enable row level security;
alter table public.milestones enable row level security;
alter table public.calendar_events enable row level security;
alter table public.reminders enable row level security;
alter table public.photo_metadata enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile"
on public.profiles for insert
with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Members can read assigned babies" on public.babies;
create policy "Members can read assigned babies"
on public.babies for select
using (public.is_baby_member(id));

drop policy if exists "Users can create babies" on public.babies;
create policy "Users can create babies"
on public.babies for insert
with check (created_by = auth.uid());

drop policy if exists "Parents can update baby profile" on public.babies;
create policy "Parents can update baby profile"
on public.babies for update
using (public.has_baby_role(id, array['parent']::public.baby_member_role[]))
with check (public.has_baby_role(id, array['parent']::public.baby_member_role[]));

drop policy if exists "Parents can delete baby profile" on public.babies;
create policy "Parents can delete baby profile"
on public.babies for delete
using (public.has_baby_role(id, array['parent']::public.baby_member_role[]));

drop policy if exists "Members can read baby members" on public.baby_members;
create policy "Members can read baby members"
on public.baby_members for select
using (public.is_baby_member(baby_id));

drop policy if exists "Parents can add baby members" on public.baby_members;
create policy "Parents can add baby members"
on public.baby_members for insert
with check (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]));

drop policy if exists "Parents can update baby members" on public.baby_members;
create policy "Parents can update baby members"
on public.baby_members for update
using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]))
with check (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]));

drop policy if exists "Parents can remove baby members" on public.baby_members;
create policy "Parents can remove baby members"
on public.baby_members for delete
using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]));

drop policy if exists "Parents can manage invitations" on public.family_invitations;
create policy "Parents can manage invitations"
on public.family_invitations for all
using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]))
with check (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]));

drop policy if exists "Members can read feeding logs" on public.feeding_logs;
create policy "Members can read feeding logs" on public.feeding_logs for select using (public.is_baby_member(baby_id));
drop policy if exists "Parents and caregivers can add feeding logs" on public.feeding_logs;
create policy "Parents and caregivers can add feeding logs" on public.feeding_logs for insert with check (created_by = auth.uid() and public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and log owners can update feeding logs" on public.feeding_logs;
create policy "Parents and log owners can update feeding logs" on public.feeding_logs for update using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[]))) with check (public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and log owners can delete feeding logs" on public.feeding_logs;
create policy "Parents and log owners can delete feeding logs" on public.feeding_logs for delete using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])));

drop policy if exists "Members can read sleep logs" on public.sleep_logs;
create policy "Members can read sleep logs" on public.sleep_logs for select using (public.is_baby_member(baby_id));
drop policy if exists "Parents and caregivers can add sleep logs" on public.sleep_logs;
create policy "Parents and caregivers can add sleep logs" on public.sleep_logs for insert with check (created_by = auth.uid() and public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and log owners can update sleep logs" on public.sleep_logs;
create policy "Parents and log owners can update sleep logs" on public.sleep_logs for update using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[]))) with check (public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and log owners can delete sleep logs" on public.sleep_logs;
create policy "Parents and log owners can delete sleep logs" on public.sleep_logs for delete using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])));

drop policy if exists "Members can read diaper logs" on public.diaper_logs;
create policy "Members can read diaper logs" on public.diaper_logs for select using (public.is_baby_member(baby_id));
drop policy if exists "Parents and caregivers can add diaper logs" on public.diaper_logs;
create policy "Parents and caregivers can add diaper logs" on public.diaper_logs for insert with check (created_by = auth.uid() and public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and log owners can update diaper logs" on public.diaper_logs;
create policy "Parents and log owners can update diaper logs" on public.diaper_logs for update using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[]))) with check (public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and log owners can delete diaper logs" on public.diaper_logs;
create policy "Parents and log owners can delete diaper logs" on public.diaper_logs for delete using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])));

drop policy if exists "Members can read health notes" on public.health_notes;
create policy "Members can read health notes" on public.health_notes for select using (public.is_baby_member(baby_id));
drop policy if exists "Parents and caregivers can add health notes" on public.health_notes;
create policy "Parents and caregivers can add health notes" on public.health_notes for insert with check (created_by = auth.uid() and public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and note owners can update health notes" on public.health_notes;
create policy "Parents and note owners can update health notes" on public.health_notes for update using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[]))) with check (public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and note owners can delete health notes" on public.health_notes;
create policy "Parents and note owners can delete health notes" on public.health_notes for delete using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])));

drop policy if exists "Members can read growth records" on public.growth_records;
create policy "Members can read growth records" on public.growth_records for select using (public.is_baby_member(baby_id));
drop policy if exists "Parents and caregivers can add growth records" on public.growth_records;
create policy "Parents and caregivers can add growth records" on public.growth_records for insert with check (created_by = auth.uid() and public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and record owners can update growth records" on public.growth_records;
create policy "Parents and record owners can update growth records" on public.growth_records for update using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[]))) with check (public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and record owners can delete growth records" on public.growth_records;
create policy "Parents and record owners can delete growth records" on public.growth_records for delete using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])));

drop policy if exists "Members can read milestones" on public.milestones;
create policy "Members can read milestones" on public.milestones for select using (public.is_baby_member(baby_id));
drop policy if exists "Parents and caregivers can add milestones" on public.milestones;
create policy "Parents and caregivers can add milestones" on public.milestones for insert with check (created_by = auth.uid() and public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and milestone owners can update milestones" on public.milestones;
create policy "Parents and milestone owners can update milestones" on public.milestones for update using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[]))) with check (public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and milestone owners can delete milestones" on public.milestones;
create policy "Parents and milestone owners can delete milestones" on public.milestones for delete using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])));

drop policy if exists "Members can read calendar events" on public.calendar_events;
create policy "Members can read calendar events" on public.calendar_events for select using (public.is_baby_member(baby_id));
drop policy if exists "Parents and caregivers can add calendar events" on public.calendar_events;
create policy "Parents and caregivers can add calendar events" on public.calendar_events for insert with check (created_by = auth.uid() and public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and event owners can update calendar events" on public.calendar_events;
create policy "Parents and event owners can update calendar events" on public.calendar_events for update using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[]))) with check (public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and event owners can delete calendar events" on public.calendar_events;
create policy "Parents and event owners can delete calendar events" on public.calendar_events for delete using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])));

drop policy if exists "Members can read reminders" on public.reminders;
create policy "Members can read reminders" on public.reminders for select using (public.is_baby_member(baby_id));
drop policy if exists "Parents and caregivers can add reminders" on public.reminders;
create policy "Parents and caregivers can add reminders" on public.reminders for insert with check (created_by = auth.uid() and public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and reminder owners can update reminders" on public.reminders;
create policy "Parents and reminder owners can update reminders" on public.reminders for update using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[]))) with check (public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and reminder owners can delete reminders" on public.reminders;
create policy "Parents and reminder owners can delete reminders" on public.reminders for delete using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])));

drop policy if exists "Members can read photo metadata" on public.photo_metadata;
create policy "Members can read photo metadata" on public.photo_metadata
for select
using (baby_id is null or public.is_baby_member(baby_id));

drop policy if exists "Parents and caregivers can add photo metadata" on public.photo_metadata;
create policy "Parents and caregivers can add photo metadata"
on public.photo_metadata for insert
with check (
  uploaded_by = auth.uid()
  and (baby_id is null or public.can_add_baby_logs(baby_id))
);

drop policy if exists "Photo owners and parents can update photo metadata" on public.photo_metadata;
create policy "Photo owners and parents can update photo metadata"
on public.photo_metadata for update
using (
  (uploaded_by = auth.uid() and (baby_id is null or public.can_add_baby_logs(baby_id)))
  or (baby_id is not null and public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]))
)
with check (
  (uploaded_by = auth.uid() and (baby_id is null or public.can_add_baby_logs(baby_id)))
  or (baby_id is not null and public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]))
);

drop policy if exists "Photo owners and parents can delete photo metadata" on public.photo_metadata;
create policy "Photo owners and parents can delete photo metadata"
on public.photo_metadata for delete
using (
  (uploaded_by = auth.uid() and (baby_id is null or public.can_add_baby_logs(baby_id)))
  or (baby_id is not null and public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]))
);
