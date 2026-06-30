alter table if exists public.babies
  add column if not exists blood_type text check (blood_type is null or blood_type in ('A', 'B', 'AB', 'O')),
  add column if not exists rhesus_factor text check (rhesus_factor is null or rhesus_factor in ('positive', 'negative'));
