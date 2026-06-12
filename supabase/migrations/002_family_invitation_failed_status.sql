-- Allow failed invite status for real email invitation attempts.
alter table public.family_invitations
  drop constraint if exists family_invitations_status_check;

alter table public.family_invitations
  add constraint family_invitations_status_check
  check (status in ('pending', 'accepted', 'revoked', 'expired', 'failed'));
