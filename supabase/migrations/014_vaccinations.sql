-- LittleNest MY — vaccination records (MOH Malaysia NIP tracking).
-- One row per administered vaccine dose per baby. The schedule itself lives in
-- the app (src/utils/vaccinations.mjs); this table only records what's done.

create table if not exists public.vaccination_records (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  vaccine_key text not null,
  given_on date,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (baby_id, vaccine_key)
);

create index if not exists vaccination_records_baby_idx on public.vaccination_records(baby_id);

alter table public.vaccination_records enable row level security;

-- Same access model as health notes: members read, parents/caregivers write.
drop policy if exists "Members can read vaccination records" on public.vaccination_records;
create policy "Members can read vaccination records" on public.vaccination_records for select using (public.is_baby_member(baby_id));

drop policy if exists "Parents and caregivers can add vaccination records" on public.vaccination_records;
create policy "Parents and caregivers can add vaccination records" on public.vaccination_records for insert with check (created_by = auth.uid() and public.can_add_baby_logs(baby_id));

drop policy if exists "Parents and owners can update vaccination records" on public.vaccination_records;
create policy "Parents and owners can update vaccination records" on public.vaccination_records for update using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[]))) with check (public.can_add_baby_logs(baby_id));

drop policy if exists "Parents and owners can delete vaccination records" on public.vaccination_records;
create policy "Parents and owners can delete vaccination records" on public.vaccination_records for delete using (public.has_baby_role(baby_id, array['parent']::public.baby_member_role[]) or (created_by = auth.uid() and public.has_baby_role(baby_id, array['caregiver']::public.baby_member_role[])));
