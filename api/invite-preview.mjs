import {
  getConfigError,
  getServiceClient,
  hasServerSupabaseConfig,
  sendJson
} from "../lib/supabaseAdmin.mjs";

// Public, read-only preview of an invitation by token. Returns only the
// minimal, non-sensitive details needed to render the Accept Invite page
// before the user signs in (baby name, inviter name, role, expiry, status).
// Does NOT accept the invite and does NOT require auth.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  if (!hasServerSupabaseConfig()) {
    return sendJson(res, 500, { error: getConfigError() });
  }

  const token = new URL(req.url, "http://localhost").searchParams.get("token");
  if (!token) return sendJson(res, 400, { error: "Missing invite token." });

  try {
    const service = getServiceClient();
    const { data: invitation, error } = await service
      .from("family_invitations")
      .select("baby_id,email,role,status,expires_at,invited_by")
      .eq("token", token)
      .maybeSingle();

    if (error) throw error;
    if (!invitation) return sendJson(res, 404, { error: "Invite not found." });

    const expired = new Date(invitation.expires_at) < new Date();
    const status = expired && invitation.status === "pending" ? "expired" : invitation.status;

    const { data: baby } = await service
      .from("babies")
      .select("name")
      .eq("id", invitation.baby_id)
      .maybeSingle();

    let inviterName = "";
    if (invitation.invited_by) {
      const { data: inviter } = await service
        .from("profiles")
        .select("display_name")
        .eq("id", invitation.invited_by)
        .maybeSingle();
      inviterName = inviter?.display_name || "";
    }

    return sendJson(res, 200, {
      babyName: baby?.name || "this baby",
      inviterName,
      role: invitation.role,
      status,
      expiresAt: invitation.expires_at,
      invitedEmail: invitation.email
    });
  } catch (err) {
    return sendJson(res, 500, { error: err.message || "Could not load invite." });
  }
}
