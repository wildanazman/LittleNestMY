import {
  getAuthenticatedUser,
  getConfigError,
  getRequestOrigin,
  getServiceClient,
  hasServerSupabaseConfig,
  readJsonBody,
  requireParentForBaby,
  sendJson
} from "./_supabaseAdmin.mjs";
import { inviteEmailHtml, isEmailProviderConfigured, sendEmail } from "./_email.mjs";
import { randomInt } from "node:crypto";

const validRoles = new Set(["parent", "caregiver", "viewer"]);

// Crockford base32 (no I, L, O, U) — unambiguous when typed or read aloud.
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateInviteCode() {
  let code = "";
  for (let i = 0; i < 8; i += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

export function normalizeInviteCode(value) {
  return String(value || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function formatInviteCode(code) {
  const c = normalizeInviteCode(code);
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4, 8)}` : c;
}

// Insert an invitation, retrying on the rare invite_code uniqueness collision.
async function insertInvitationWithCode(service, row) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await service
      .from("family_invitations")
      .insert({ ...row, invite_code: generateInviteCode() })
      .select("id,email,role,status,token,invite_code,expires_at,created_at")
      .single();
    if (!error) return { data, error: null };
    if (error.code !== "23505") return { data: null, error };
  }
  return { data: null, error: new Error("Could not allocate a unique invite code.") };
}

const inviteRateMap = new Map();
const INVITE_MAX = 5;
const INVITE_WINDOW_MS = 15 * 60 * 1000;

function checkInviteRate(userId) {
  const now = Date.now();
  const attempts = inviteRateMap.get(userId) || [];
  const recent = attempts.filter((t) => t > now - INVITE_WINDOW_MS);
  inviteRateMap.set(userId, recent);
  return recent.length >= INVITE_MAX;
}

function recordInviteAttempt(userId) {
  const now = Date.now();
  const attempts = inviteRateMap.get(userId) || [];
  attempts.push(now);
  inviteRateMap.set(userId, attempts);
}

export default async function handler(req, res) {
  if (!hasServerSupabaseConfig()) {
    return sendJson(res, 500, { error: getConfigError() });
  }

  const auth = await getAuthenticatedUser(req);
  if (!auth.user) return sendJson(res, 401, { error: auth.error });

  const service = getServiceClient();

  try {
    if (req.method === "GET") return await listCareCircle(req, res, service, auth.user);
    if (req.method === "POST") return await createInvitation(req, res, service, auth.user);
    if (req.method === "PATCH") return await updateInvitation(req, res, service, auth.user);
    if (req.method === "DELETE") return await removeCareCircleItem(req, res, service, auth.user);
    res.setHeader("allow", "GET, POST, PATCH, DELETE");
    return sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Invitation request failed." });
  }
}

async function listCareCircle(req, res, service, user) {
  const babyId = new URL(req.url, "http://localhost").searchParams.get("babyId");
  if (!babyId) return await listMyPendingInvites(req, res, service, user);

  const { data: rawRows, error: memberError } = await service
    .from("baby_members")
    .select("baby_id,user_id,role,created_at,updated_at")
    .eq("baby_id", babyId);
  if (memberError) throw memberError;
  const memberRows = rawRows || [];

  let currentMember = memberRows.find((member) => member.user_id === user.id);
  if (!currentMember) {
    const { data: baby } = await service
      .from("babies")
      .select("id,created_by")
      .eq("id", babyId)
      .maybeSingle();
    if (baby && baby.created_by === user.id) {
      await service
        .from("baby_members")
        .upsert({ baby_id: babyId, user_id: user.id, role: "parent", invited_by: user.id }, { onConflict: "baby_id,user_id" });
      const fixupRow = { baby_id: babyId, user_id: user.id, role: "parent", created_at: new Date().toISOString() };
      memberRows.push(fixupRow);
      currentMember = fixupRow;
    } else {
      return sendJson(res, 403, { error: "You are not a member of this baby care circle." });
    }
  }

  const userIds = [...new Set(memberRows.map((member) => member.user_id))];
  const { data: profiles } = userIds.length
    ? await service.from("profiles").select("id,display_name,email,avatar_url").in("id", userIds)
    : { data: [] };
  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));

  let invitations = [];
  if (currentMember.role === "parent") {
    const { data: invitationRows, error: invitationError } = await service
      .from("family_invitations")
      .select("id,baby_id,email,role,status,token,invited_by,accepted_by,expires_at,created_at,updated_at")
      .eq("baby_id", babyId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (invitationError) throw invitationError;
    invitations = invitationRows || [];
  }

  return sendJson(res, 200, {
    currentRole: currentMember.role,
    members: memberRows.map((member) => ({
      babyId: member.baby_id,
      userId: member.user_id,
      role: member.role,
      name: profileById.get(member.user_id)?.display_name || "Care circle member",
      email: profileById.get(member.user_id)?.email || "",
      acceptedAt: member.created_at,
      isCurrentUser: member.user_id === user.id
    })),
    invitations
  });
}

async function listMyPendingInvites(req, res, service, user) {
  const email = String(user.email || "").trim().toLowerCase();
  if (!email) return sendJson(res, 200, { invitations: [] });

  const { data, error } = await service
    .from("family_invitations")
    .select("id,baby_id,email,role,status,token,expires_at,created_at")
    .eq("email", email)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;

  const babyIds = [...new Set((data || []).map((item) => item.baby_id).filter(Boolean))];
  const { data: babies } = babyIds.length
    ? await service.from("babies").select("id,name").in("id", babyIds)
    : { data: [] };
  const babyById = new Map((babies || []).map((baby) => [baby.id, baby]));

  return sendJson(res, 200, {
    invitations: (data || []).map((item) => ({
      id: item.id,
      babyId: item.baby_id,
      babyName: babyById.get(item.baby_id)?.name || "baby",
      email: item.email,
      role: item.role,
      status: item.status,
      token: item.token,
      expiresAt: item.expires_at,
      createdAt: item.created_at
    }))
  });
}

async function createInvitation(req, res, service, user) {
  if (checkInviteRate(user.id)) {
    return sendJson(res, 429, { error: "Too many invites. Please wait 15 minutes." });
  }
  const body = await readJsonBody(req);
  const babyId = body.babyId;
  const email = String(body.email || "").trim().toLowerCase();
  const role = String(body.role || "viewer").toLowerCase();
  const name = String(body.name || "").trim();

  if (!babyId) return sendJson(res, 400, { error: "Missing babyId." });
  if (!validRoles.has(role)) return sendJson(res, 400, { error: "Choose a valid role." });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendJson(res, 400, { error: "Enter a valid email address." });
  }

  recordInviteAttempt(user.id);

  const parent = await requireParentForBaby(service, babyId, user.id);
  if (!parent.ok) return sendJson(res, 403, { error: parent.error, currentRole: parent.role });

  // Email-bound path only: block existing members and reuse a pending invite.
  if (email) {
    const existingUser = await findAuthUserByEmail(service, email);
    if (existingUser) {
      const { data: existingMember, error: existingMemberError } = await service
        .from("baby_members")
        .select("user_id,role")
        .eq("baby_id", babyId)
        .eq("user_id", existingUser.id)
        .maybeSingle();
      if (existingMemberError) throw existingMemberError;
      if (existingMember) {
        return sendJson(res, 409, { error: "This person is already in this baby's care circle.", alreadyMember: true });
      }
    }

    const { data: pendingInvitation, error: pendingError } = await service
      .from("family_invitations")
      .select("id,email,role,status,token,invite_code,expires_at,created_at")
      .eq("baby_id", babyId)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();
    if (pendingError) throw pendingError;
    if (pendingInvitation) {
      return sendJson(res, 200, {
        message: "Invitation is already pending.",
        emailDelivery: "pending",
        inviteUrl: buildInviteUrl(req, pendingInvitation.token),
        inviteCode: formatInviteCode(pendingInvitation.invite_code),
        invitation: pendingInvitation
      });
    }
  }

  const { data: invitation, error: inviteError } = await insertInvitationWithCode(service, {
    baby_id: babyId,
    email: email || null,
    role,
    status: "pending",
    invited_by: user.id,
    accepted_by: null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });
  if (inviteError) throw inviteError;

  const inviteUrl = buildInviteUrl(req, invitation.token);
  const inviteCode = formatInviteCode(invitation.invite_code);

  // Code-only invite: nothing to email — the parent shares the code/link directly.
  if (!email) {
    return sendJson(res, 200, { message: "Invite code ready.", emailDelivery: "code_only", inviteUrl, inviteCode, invitation });
  }

  // Email-bound invite: own-brand Resend email when configured, else Supabase invite.
  if (isEmailProviderConfigured()) {
    try {
      const [{ data: babyRow }, { data: inviterRow }] = await Promise.all([
        service.from("babies").select("name").eq("id", babyId).maybeSingle(),
        service.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
      ]);
      await sendEmail({
        to: email,
        subject: `You're invited to care for ${babyRow?.name || "a baby"} on LittleNest MY`,
        html: inviteEmailHtml({ inviteUrl, babyName: babyRow?.name || "", inviterName: inviterRow?.display_name || "", role })
      });
      return sendJson(res, 200, { message: "Invitation sent.", emailDelivery: "sent", inviteUrl, inviteCode, invitation });
    } catch (sendErr) {
      console.warn("Own-brand invite email failed; falling back to Supabase invite.", sendErr.message);
    }
  }

  const { error: emailError } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo: inviteUrl,
    data: { family_invitation_id: invitation.id, baby_id: babyId, role, invited_name: name }
  });
  if (emailError) {
    if (isExistingUserInviteError(emailError)) {
      return sendJson(res, 200, { message: "Invitation link ready.", emailDelivery: "existing_user", inviteUrl, inviteCode, invitation });
    }
    await service.from("family_invitations").update({ status: "failed" }).eq("id", invitation.id);
    return sendJson(res, 502, { error: `Invite failed. ${emailError.message}`, invitation: { ...invitation, status: "failed" } });
  }

  return sendJson(res, 200, { message: "Invitation sent.", emailDelivery: "sent", inviteUrl, inviteCode, invitation });
}

async function findAuthUserByEmail(service, email) {
  try {
    const { data, error } = await service.auth.admin.getUserByEmail(email);
    if (error) return null;
    return data?.user || null;
  } catch {
    return null;
  }
}

function buildInviteUrl(req, token) {
  const origin = getRequestOrigin(req);
  return `${origin}/accept_invite/?token=${encodeURIComponent(token)}`;
}

function isExistingUserInviteError(error) {
  return /already|registered|exists/i.test(String(error?.message || error || ""));
}

async function removeCareCircleItem(req, res, service, user) {
  const body = await readJsonBody(req);
  const babyId = body.babyId;
  if (!babyId) return sendJson(res, 400, { error: "Missing babyId." });

  const parent = await requireParentForBaby(service, babyId, user.id);
  if (!parent.ok) return sendJson(res, 403, { error: parent.error, currentRole: parent.role });

  if (body.invitationId) {
    const { error } = await service
      .from("family_invitations")
      .update({ status: "revoked" })
      .eq("id", body.invitationId)
      .eq("baby_id", babyId);
    if (error) throw error;
    return sendJson(res, 200, { message: "Invitation removed." });
  }

  if (body.userId) {
    if (body.userId === user.id) return sendJson(res, 400, { error: "Parents cannot remove themselves here." });
    const { data: targetMember, error: targetError } = await service
      .from("baby_members")
      .select("user_id,role")
      .eq("baby_id", babyId)
      .eq("user_id", body.userId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!targetMember) return sendJson(res, 404, { error: "Family member was not found." });
    if (targetMember.role === "parent") {
      const { count, error: parentCountError } = await service
        .from("baby_members")
        .select("user_id", { count: "exact", head: true })
        .eq("baby_id", babyId)
        .eq("role", "parent");
      if (parentCountError) throw parentCountError;
      if ((count || 0) <= 1) {
        return sendJson(res, 400, { error: "This baby needs at least one parent before removing this member." });
      }
    }

    const { error } = await service
      .from("baby_members")
      .delete()
      .eq("baby_id", babyId)
      .eq("user_id", body.userId);
    if (error) throw error;

    const { error: inviteCleanupError } = await service
      .from("family_invitations")
      .delete()
      .eq("baby_id", babyId)
      .eq("accepted_by", body.userId);
    if (inviteCleanupError) throw inviteCleanupError;

    return sendJson(res, 200, { message: "Member removed." });
  }

  return sendJson(res, 400, { error: "Choose an invitation or member to remove." });
}

async function updateInvitation(req, res, service, user) {
  const body = await readJsonBody(req);
  const invitationId = String(body.invitationId || "").trim();
  const action = String(body.action || "").trim().toLowerCase();
  if (!invitationId) return sendJson(res, 400, { error: "Missing invitation." });
  if (action !== "decline") return sendJson(res, 400, { error: "Unsupported invitation action." });

  const email = String(user.email || "").trim().toLowerCase();
  const { data: invitation, error: invitationError } = await service
    .from("family_invitations")
    .select("id,email,status")
    .eq("id", invitationId)
    .maybeSingle();
  if (invitationError) throw invitationError;
  if (!invitation) return sendJson(res, 404, { error: "Invite not found." });
  if (String(invitation.email || "").toLowerCase() !== email) {
    return sendJson(res, 403, { error: "This invitation was sent to another email address." });
  }
  if (invitation.status !== "pending") {
    return sendJson(res, 400, { error: `Invite is ${invitation.status}.` });
  }

  const { error } = await service
    .from("family_invitations")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("id", invitationId);
  if (error) throw error;

  return sendJson(res, 200, { message: "Invite declined." });
}
