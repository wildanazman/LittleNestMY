import {
  getAuthenticatedUser,
  getConfigError,
  getServiceClient,
  hasServerSupabaseConfig,
  readJsonBody,
  sendJson
} from "../lib/supabaseAdmin.mjs";

// Throttle redemption attempts so short invite codes can't be brute-forced.
const attemptMap = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function tooManyAttempts(key) {
  const now = Date.now();
  const recent = (attemptMap.get(key) || []).filter((t) => t > now - WINDOW_MS);
  attemptMap.set(key, recent);
  return recent.length >= MAX_ATTEMPTS;
}
function recordAttempt(key) {
  const recent = attemptMap.get(key) || [];
  recent.push(Date.now());
  attemptMap.set(key, recent);
}
function normalizeCode(value) {
  return String(value || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

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

  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  if (tooManyAttempts(auth.user.id) || tooManyAttempts(ip)) {
    return sendJson(res, 429, { error: "Too many attempts. Please wait 15 minutes." });
  }

  try {
    const body = await readJsonBody(req);
    const token = String(body.token || "").trim();
    const code = normalizeCode(body.code);
    if (!token && !code) return sendJson(res, 400, { error: "Enter an invite code." });

    recordAttempt(auth.user.id);
    recordAttempt(ip);

    const service = getServiceClient();
    const query = service
      .from("family_invitations")
      .select("id,baby_id,email,role,status,expires_at,invited_by");
    const { data: invitation, error: invitationError } = await (
      code ? query.eq("invite_code", code) : query.eq("token", token)
    ).maybeSingle();

    if (invitationError || !invitation) return sendJson(res, 404, { error: "Invite not found. Check the code and try again." });
    if (invitation.status !== "pending") return sendJson(res, 400, { error: `Invite is ${invitation.status}.` });
    if (new Date(invitation.expires_at) < new Date()) {
      await service.from("family_invitations").update({ status: "expired" }).eq("id", invitation.id);
      return sendJson(res, 400, { error: "Invite has expired. Ask for a new code." });
    }
    // Email-bound invites must be redeemed by the matching account. Code-only
    // invites (email is null) can be redeemed by any signed-in account.
    if (invitation.email && invitation.email.toLowerCase() !== String(auth.user.email || "").toLowerCase()) {
      return sendJson(res, 403, { error: "This invitation was sent to another email address." });
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
        role: invitation.role,
        invited_by: invitation.invited_by
      }, { onConflict: "baby_id,user_id" });
    if (memberError) throw memberError;

    // Single-use: mark accepted so the code/link can't be redeemed again.
    const { error: updateError } = await service
      .from("family_invitations")
      .update({ status: "accepted", accepted_by: auth.user.id })
      .eq("id", invitation.id)
      .eq("status", "pending");
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
