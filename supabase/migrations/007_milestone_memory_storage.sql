-- Cloud storage for milestone memory photos.
-- Public read keeps shared family photos easy to render in the PWA.
-- Write/update/delete is still limited to parent/caregiver members of the baby.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'littlenest-memories',
  'littlenest-memories',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read LittleNest memory photos" on storage.objects;
create policy "Anyone can read LittleNest memory photos"
on storage.objects for select
using (bucket_id = 'littlenest-memories');

drop policy if exists "Baby caregivers can upload milestone photos" on storage.objects;
create policy "Baby caregivers can upload milestone photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'littlenest-memories'
  and (storage.foldername(name))[1] = 'milestones'
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.can_add_baby_logs(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "Baby caregivers can update milestone photos" on storage.objects;
create policy "Baby caregivers can update milestone photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'littlenest-memories'
  and (storage.foldername(name))[1] = 'milestones'
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$'
  and public.can_add_baby_logs(((storage.foldername(name))[2])::uuid)
)
with check (
  bucket_id = 'littlenest-memories'
  and (storage.foldername(name))[1] = 'milestones'
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$'
  and public.can_add_baby_logs(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "Parents can delete milestone photos" on storage.objects;
create policy "Parents can delete milestone photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'littlenest-memories'
  and (storage.foldername(name))[1] = 'milestones'
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$'
  and public.has_baby_role(((storage.foldername(name))[2])::uuid, array['parent']::public.baby_member_role[])
);
