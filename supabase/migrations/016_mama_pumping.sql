-- Breast Pumping and Milk Storage module for Mama Care.

create table if not exists public.mama_pump_sessions (
  id text primary key,
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes integer not null default 0,
  left_ml numeric(7,1) not null default 0,
  right_ml numeric(7,1) not null default 0,
  total_ml numeric(7,1) not null default 0,
  pump_used text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mama_pump_schedules (
  id text primary key,
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  pump_time time not null,
  label text,
  active boolean not null default true,
  skipped_dates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mama_milk_storage (
  id text primary key,
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  quantity_ml numeric(7,1) not null default 0,
  remaining_ml numeric(7,1) not null default 0,
  storage_type text not null check (storage_type in ('refrigerator', 'freezer')),
  container_type text not null default 'Storage Bag',
  pump_date date not null,
  expiration_date date not null,
  label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mama_pump_parts (
  id text primary key,
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  part_type text not null,
  last_changed_date date not null,
  interval_days integer not null default 30,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mama_pump_sessions_baby_started_idx on public.mama_pump_sessions(baby_id, started_at desc);
create index if not exists mama_pump_schedules_baby_time_idx on public.mama_pump_schedules(baby_id, pump_time);
create index if not exists mama_milk_storage_baby_expiry_idx on public.mama_milk_storage(baby_id, expiration_date);
create index if not exists mama_pump_parts_baby_type_idx on public.mama_pump_parts(baby_id, part_type);

drop trigger if exists set_mama_pump_sessions_updated_at on public.mama_pump_sessions;
create trigger set_mama_pump_sessions_updated_at before update on public.mama_pump_sessions
for each row execute function public.set_updated_at();
drop trigger if exists set_mama_pump_schedules_updated_at on public.mama_pump_schedules;
create trigger set_mama_pump_schedules_updated_at before update on public.mama_pump_schedules
for each row execute function public.set_updated_at();
drop trigger if exists set_mama_milk_storage_updated_at on public.mama_milk_storage;
create trigger set_mama_milk_storage_updated_at before update on public.mama_milk_storage
for each row execute function public.set_updated_at();
drop trigger if exists set_mama_pump_parts_updated_at on public.mama_pump_parts;
create trigger set_mama_pump_parts_updated_at before update on public.mama_pump_parts
for each row execute function public.set_updated_at();

alter table public.mama_pump_sessions enable row level security;
alter table public.mama_pump_schedules enable row level security;
alter table public.mama_milk_storage enable row level security;
alter table public.mama_pump_parts enable row level security;

drop policy if exists "Members can read pump sessions" on public.mama_pump_sessions;
create policy "Members can read pump sessions" on public.mama_pump_sessions
for select using (public.is_baby_member(baby_id));
drop policy if exists "Parents and caregivers can add pump sessions" on public.mama_pump_sessions;
create policy "Parents and caregivers can add pump sessions" on public.mama_pump_sessions
for insert with check (created_by = auth.uid() and public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and session owners can update pump sessions" on public.mama_pump_sessions;
create policy "Parents and session owners can update pump sessions" on public.mama_pump_sessions
for update using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or created_by = auth.uid())
with check (public.can_add_baby_logs(baby_id));
drop policy if exists "Parents and session owners can delete pump sessions" on public.mama_pump_sessions;
create policy "Parents and session owners can delete pump sessions" on public.mama_pump_sessions
for delete using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or created_by = auth.uid());

drop policy if exists "Members can read pump schedules" on public.mama_pump_schedules;
create policy "Members can read pump schedules" on public.mama_pump_schedules
for select using (public.is_baby_member(baby_id));
drop policy if exists "Parents and caregivers can write pump schedules" on public.mama_pump_schedules;
create policy "Parents and caregivers can write pump schedules" on public.mama_pump_schedules
for all using (public.can_add_baby_logs(baby_id)) with check (created_by = auth.uid() and public.can_add_baby_logs(baby_id));

drop policy if exists "Members can read milk storage" on public.mama_milk_storage;
create policy "Members can read milk storage" on public.mama_milk_storage
for select using (public.is_baby_member(baby_id));
drop policy if exists "Parents and caregivers can write milk storage" on public.mama_milk_storage;
create policy "Parents and caregivers can write milk storage" on public.mama_milk_storage
for all using (public.can_add_baby_logs(baby_id)) with check (created_by = auth.uid() and public.can_add_baby_logs(baby_id));

drop policy if exists "Members can read pump parts" on public.mama_pump_parts;
create policy "Members can read pump parts" on public.mama_pump_parts
for select using (public.is_baby_member(baby_id));
drop policy if exists "Parents and caregivers can write pump parts" on public.mama_pump_parts;
create policy "Parents and caregivers can write pump parts" on public.mama_pump_parts
for all using (public.can_add_baby_logs(baby_id)) with check (created_by = auth.uid() and public.can_add_baby_logs(baby_id));
