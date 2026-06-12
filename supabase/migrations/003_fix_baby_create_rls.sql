-- LittleNest MY Phase 3 repair: allow authenticated users to create babies
-- while keeping baby data private behind creator/member RLS.

alter table public.babies
  add column if not exists created_by uuid;

alter table public.babies
  alter column created_by set default auth.uid();

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
    where nsp.nspname = 'public'
      and rel.relname = 'babies'
      and att.attname = 'created_by'
      and con.contype = 'f'
  loop
    execute format('alter table public.babies drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table public.babies
  add constraint babies_created_by_auth_users_fkey
  foreign key (created_by) references auth.users(id) on delete cascade
  not valid;

do $$
begin
  if not exists (select 1 from public.babies where created_by is null) then
    alter table public.babies alter column created_by set not null;
  end if;
end $$;

create or replace function public.add_creator_as_parent_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.created_by)
  on conflict (id) do nothing;

  insert into public.baby_members (baby_id, user_id, role, invited_by)
  values (new.id, new.created_by, 'parent', new.created_by)
  on conflict (baby_id, user_id) do update set role = 'parent', updated_at = now();

  return new;
end;
$$;

drop trigger if exists add_creator_as_parent_member on public.babies;
create trigger add_creator_as_parent_member
after insert on public.babies
for each row execute function public.add_creator_as_parent_member();

alter table public.babies enable row level security;

drop policy if exists "Members can read assigned babies" on public.babies;
create policy "Members can read assigned babies"
on public.babies for select
using (
  created_by = auth.uid()
  or public.is_baby_member(id)
);

drop policy if exists "Users can create babies" on public.babies;
create policy "Users can create babies"
on public.babies for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Parents can update baby profile" on public.babies;
create policy "Parents can update baby profile"
on public.babies for update
using (
  created_by = auth.uid()
  or public.has_baby_role(id, array['parent']::public.baby_member_role[])
)
with check (
  created_by = auth.uid()
  or public.has_baby_role(id, array['parent']::public.baby_member_role[])
);

drop policy if exists "Parents can delete baby profile" on public.babies;
create policy "Parents can delete baby profile"
on public.babies for delete
using (
  created_by = auth.uid()
  or public.has_baby_role(id, array['parent']::public.baby_member_role[])
);
