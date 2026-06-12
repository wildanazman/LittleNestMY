import {
  getAuthenticatedUser,
  getConfigError,
  getServiceClient,
  hasServerSupabaseConfig,
  readJsonBody,
  sendJson
} from "./_supabaseAdmin.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  if (!hasServerSupabaseConfig()) {
    return sendJson(res, 500, { error: getConfigError() });
  }

  const auth = await getAuthenticatedUser(req);
  if (!auth.user) return sendJson(res, 401, { error: auth.error });

  try {
    const body = await readJsonBody(req);
    const token = String(body.token || "").trim();
    if (!token) return sendJson(res, 400, { error: "Missing invite token." });

    const service = getServiceClient();
    const { data: invitation, error: invitationError } = await service
      .from("family_invitations")
      .select("id,baby_id,email,role,status,expires_at")
      .eq("token", token)
      .single();

    if (invitationError || !invitation) return sendJson(res, 404, { error: "Invite not found." });
    if (invitation.status !== "pending") return sendJson(res, 400, { error: `Invite is ${invitation.status}.` });
    if (new Date(invitation.expires_at) < new Date()) {
      await service.from("family_invitations").update({ status: "expired" }).eq("id", invitation.id);
      return sendJson(res, 400, { error: "Invite has expired." });
    }
    if (invitation.email.toLowerCase() !== String(auth.user.email || "").toLowerCase()) {
      return sendJson(res, 403, { error: "Please log in with the email address that received this invite." });
    }

    await service.from("profiles").upsert({
      id: auth.user.id,
      email: auth.user.email || invitation.email,
      display_name: auth.user.user_metadata?.display_name || auth.user.user_metadata?.name || auth.user.email?.split("@")[0] || "Parent",
      avatar_url: auth.user.user_metadata?.avatar_url || null,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });

    const { error: memberError } = await service
      .from("baby_members")
      .upsert({
        baby_id: invitation.baby_id,
        user_id: auth.user.id,
        role: invitation.role
      }, { onConflict: "baby_id,user_id" });
    if (memberError) throw memberError;

    const { error: updateError } = await service
      .from("family_invitations")
      .update({
        status: "accepted",
        accepted_by: auth.user.id
      })
      .eq("id", invitation.id);
    if (updateError) throw updateError;

    return sendJson(res, 200, {
      message: "Invite accepted.",
      babyId: invitation.baby_id,
      role: invitation.role
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Could not accept invite." });
  }
}
