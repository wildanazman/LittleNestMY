alter table public.diaper_logs
  add column if not exists pee_amount text,
  add column if not exists pee_color text,
  add column if not exists pee_color_other text,
  add column if not exists poop_consistency text,
  add column if not exists poop_consistency_other text,
  add column if not exists poop_color text,
  add column if not exists poop_color_other text;

comment on column public.diaper_logs.pee_amount is 'Optional pee amount detail: Light, Normal, or Heavy.';
comment on column public.diaper_logs.pee_color is 'Optional pee color category.';
comment on column public.diaper_logs.poop_consistency is 'Optional poop consistency category.';
comment on column public.diaper_logs.poop_color is 'Optional poop color category.';
