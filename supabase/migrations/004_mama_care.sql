-- LittleNest MY Mama Care tables and RLS.
-- Run after the initial schema so baby_members and role helpers exist.

create table if not exists public.mama_checkins (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  checkin_date date not null,
  mood text,
  pain_level integer check (pain_level is null or (pain_level >= 0 and pain_level <= 10)),
  bleeding text check (bleeding is null or bleeding in ('light', 'normal', 'heavy')),
  sleep_hours numeric(4,1),
  water_cups integer,
  meals_count integer,
  breastfeeding_comfort text,
  wound_note text,
  toilet_note text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (baby_id, checkin_date)
);

create table if not exists public.mama_support_tasks (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  task_title text not null,
  task_date date not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.mama_medications (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  medication_name text not null,
  dose text,
  medication_time timestamptz,
  status text not null default 'pending' check (status in ('pending', 'taken', 'skipped')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.mama_appointments (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null,
  appointment_time timestamptz,
  location text,
  notes text,
  reminder_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.mama_recovery_notes (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  note_date date not null,
  note_type text,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists mama_checkins_baby_date_idx on public.mama_checkins(baby_id, checkin_date desc);
create index if not exists mama_support_tasks_baby_date_idx on public.mama_support_tasks(baby_id, task_date desc);
create index if not exists mama_medications_baby_time_idx on public.mama_medications(baby_id, medication_time desc);
create index if not exists mama_appointments_baby_time_idx on public.mama_appointments(baby_id, appointment_time);
create index if not exists mama_recovery_notes_baby_date_idx on public.mama_recovery_notes(baby_id, note_date desc);

drop trigger if exists set_mama_checkins_updated_at on public.mama_checkins;
create trigger set_mama_checkins_updated_at
before update on public.mama_checkins
for each row execute function public.set_updated_at();

alter table public.mama_checkins enable row level security;
alter table public.mama_support_tasks enable row level security;
alter table public.mama_medications enable row level security;
alter table public.mama_appointments enable row level security;
alter table public.mama_recovery_notes enable row level security;

drop policy if exists "Members can read mama checkins" on public.mama_checkins;
create policy "Members can read mama checkins" on public.mama_checkins
for select using (public.is_baby_member(baby_id));
drop policy if exists "Parents and caregivers can add mama checkins" on public.mama_checkins;
create policy "Parents and caregivers can add mama checkins" on public.mama_checkins
for insert with check (created_by = auth.uid() and public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and checkin owners can update mama checkins" on public.mama_checkins;
create policy "Parents and checkin owners can update mama checkins" on public.mama_checkins
for update
using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])))
with check (public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and checkin owners can delete mama checkins" on public.mama_checkins;
create policy "Parents and checkin owners can delete mama checkins" on public.mama_checkins
for delete using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])));

drop policy if exists "Members can read mama support tasks" on public.mama_support_tasks;
create policy "Members can read mama support tasks" on public.mama_support_tasks
for select using (public.is_baby_member(baby_id));
drop policy if exists "Parents and caregivers can add mama support tasks" on public.mama_support_tasks;
create policy "Parents and caregivers can add mama support tasks" on public.mama_support_tasks
for insert with check (created_by = auth.uid() and public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and task owners can update mama support tasks" on public.mama_support_tasks;
create policy "Parents and task owners can update mama support tasks" on public.mama_support_tasks
for update
using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])))
with check (public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and task owners can delete mama support tasks" on public.mama_support_tasks;
create policy "Parents and task owners can delete mama support tasks" on public.mama_support_tasks
for delete using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])));

drop policy if exists "Members can read mama medications" on public.mama_medications;
create policy "Members can read mama medications" on public.mama_medications
for select using (public.is_baby_member(baby_id));
drop policy if exists "Parents and caregivers can add mama medications" on public.mama_medications;
create policy "Parents and caregivers can add mama medications" on public.mama_medications
for insert with check (created_by = auth.uid() and public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and med owners can update mama medications" on public.mama_medications;
create policy "Parents and med owners can update mama medications" on public.mama_medications
for update
using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])))
with check (public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and med owners can delete mama medications" on public.mama_medications;
create policy "Parents and med owners can delete mama medications" on public.mama_medications
for delete using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])));

drop policy if exists "Members can read mama appointments" on public.mama_appointments;
create policy "Members can read mama appointments" on public.mama_appointments
for select using (public.is_baby_member(baby_id));
drop policy if exists "Parents and caregivers can add mama appointments" on public.mama_appointments;
create policy "Parents and caregivers can add mama appointments" on public.mama_appointments
for insert with check (created_by = auth.uid() and public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and appointment owners can update mama appointments" on public.mama_appointments;
create policy "Parents and appointment owners can update mama appointments" on public.mama_appointments
for update
using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])))
with check (public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and appointment owners can delete mama appointments" on public.mama_appointments;
create policy "Parents and appointment owners can delete mama appointments" on public.mama_appointments
for delete using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])));

drop policy if exists "Members can read mama recovery notes" on public.mama_recovery_notes;
create policy "Members can read mama recovery notes" on public.mama_recovery_notes
for select using (public.is_baby_member(baby_id));
drop policy if exists "Parents and caregivers can add mama recovery notes" on public.mama_recovery_notes;
create policy "Parents and caregivers can add mama recovery notes" on public.mama_recovery_notes
for insert with check (created_by = auth.uid() and public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and note owners can update mama recovery notes" on public.mama_recovery_notes;
create policy "Parents and note owners can update mama recovery notes" on public.mama_recovery_notes
for update
using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])))
with check (public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and note owners can delete mama recovery notes" on public.mama_recovery_notes;
create policy "Parents and note owners can delete mama recovery notes" on public.mama_recovery_notes
for delete using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])));
