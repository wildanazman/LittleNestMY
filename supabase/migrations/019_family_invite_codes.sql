-- Code-based family invites.
-- Adds a short, shareable one-time invite code alongside the existing token/link
-- flow, and allows code-only invites that are not bound to a specific email.

-- Email is now optional (code-only invites have no recipient email).
alter table public.family_invitations
  alter column email drop not null;

-- Short human-friendly redemption code (Crockford base32, stored normalized,
-- e.g. "K7QM4P2A"). Unique among non-null values; old rows stay null and keep
-- using their token/link.
alter table public.family_invitations
  add column if not exists invite_code text;

create unique index if not exists family_invitations_invite_code_key
  on public.family_invitations (invite_code)
  where invite_code is not null;
