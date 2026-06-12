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

const validRoles = new Set(["parent", "caregiver", "viewer"]);

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
    if (req.method === "DELETE") return await removeCareCircleItem(req, res, service, auth.user);
    res.setHeader("allow", "GET, POST, DELETE");
    return sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Invitation request failed." });
  }
}

async function listCareCircle(req, res, service, user) {
  const babyId = new URL(req.url, "http://localhost").searchParams.get("babyId");
  if (!babyId) return sendJson(res, 400, { error: "Missing babyId." });

  const { data: memberRows, error: memberError } = await service
    .from("baby_members")
    .select("baby_id,user_id,role,created_at,updated_at")
    .eq("baby_id", babyId);
  if (memberError) throw memberError;

  const currentMember = memberRows?.find((member) => member.user_id === user.id);
  if (!currentMember) return sendJson(res, 403, { error: "You are not a member of this baby care circle." });

  const userIds = [...new Set((memberRows || []).map((member) => member.user_id))];
  const { data: profiles } = userIds.length
    ? await service.from("profiles").select("id,display_name,email,avatar_url").in("id", userIds)
    : { data: [] };
  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));

  let invitations = [];
  if (currentMember.role === "parent") {
    const { data: invitationRows, error: invitationError } = await service
      .from("family_invitations")
      .select("id,baby_id,email,role,status,invited_by,accepted_by,expires_at,created_at,updated_at")
      .eq("baby_id", babyId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (invitationError) throw invitationError;
    invitations = invitationRows || [];
  }

  return sendJson(res, 200, {
    currentRole: currentMember.role,
    members: (memberRows || []).map((member) => ({
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

async function createInvitation(req, res, service, user) {
  const body = await readJsonBody(req);
  const babyId = body.babyId;
  const email = String(body.email || "").trim().toLowerCase();
  const role = String(body.role || "viewer").toLowerCase();
  const name = String(body.name || "").trim();

  if (!babyId) return sendJson(res, 400, { error: "Missing babyId." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: "Enter a valid email address." });
  if (!validRoles.has(role)) return sendJson(res, 400, { error: "Choose a valid role." });

  const parent = await requireParentForBaby(service, babyId, user.id);
  if (!parent.ok) return sendJson(res, 403, { error: parent.error, currentRole: parent.role });

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
      return sendJson(res, 409, {
        error: "This person is already in this baby's care circle.",
        alreadyMember: true
      });
    }
  }

  const { data: pendingInvitation, error: pendingError } = await service
    .from("family_invitations")
    .select("id,email,role,status,token,expires_at,created_at")
    .eq("baby_id", babyId)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (pendingError) throw pendingError;

  if (pendingInvitation) {
    const inviteUrl = buildInviteUrl(req, pendingInvitation.token);
    return sendJson(res, 200, {
      message: "Invitation is already pending.",
      emailDelivery: existingUser ? "existing_user" : "pending",
      inviteUrl,
      invitation: pendingInvitation
    });
  }

  const { data: invitation, error: inviteError } = await service
    .from("family_invitations")
    .insert({
      baby_id: babyId,
      email,
      role,
      status: "pending",
      invited_by: user.id,
      accepted_by: null,
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select("id,email,role,status,token,expires_at,created_at")
    .single();

  if (inviteError) throw inviteError;

  const redirectTo = buildInviteUrl(req, invitation.token);
  const { error: emailError } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      family_invitation_id: invitation.id,
      baby_id: babyId,
      role,
      invited_name: name
    }
  });

  if (emailError) {
    if (isExistingUserInviteError(emailError)) {
      return sendJson(res, 200, {
        message: "Invitation link ready.",
        emailDelivery: "existing_user",
        inviteUrl: redirectTo,
        invitation: { ...invitation, status: "pending" }
      });
    }

    await service.from("family_invitations").update({ status: "failed" }).eq("id", invitation.id);
    return sendJson(res, 502, {
      error: `Invite failed. ${emailError.message}`,
      invitation: { ...invitation, status: "failed" }
    });
  }

  return sendJson(res, 200, {
    message: "Invitation sent.",
    emailDelivery: "sent",
    inviteUrl: redirectTo,
    invitation: { ...invitation, status: "pending" }
  });
}

async function findAuthUserByEmail(service, email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const match = data?.users?.find((authUser) => String(authUser.email || "").toLowerCase() === email);
    if (match) return match;
    if (!data?.users || data.users.length < 1000) return null;
  }
  return null;
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
