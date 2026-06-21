import {
  getAnonClient,
  getConfigError,
  getRequestOrigin,
  getServiceClient,
  hasServerSupabaseConfig,
  readJsonBody,
  sendJson
} from "./_supabaseAdmin.mjs";
import { isEmailProviderConfigured, resetEmailHtml, sendEmail } from "./_email.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  if (!hasServerSupabaseConfig()) {
    return sendJson(res, 500, { error: getConfigError() });
  }

  const body = await readJsonBody(req);
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendJson(res, 400, { error: "Enter a valid email address." });
  }

  // No own-brand provider yet → let the client send the normal Supabase reset
  // email so the flow still works before Resend is configured.
  if (!isEmailProviderConfigured()) {
    return sendJson(res, 200, { fallback: true });
  }

  const origin = getRequestOrigin(req);
  const redirectTo = body.redirectTo || `${origin}/set_password/`;

  try {
    // Generate the recovery link server-side, then deliver it with our own
    // branded email instead of Supabase's default template.
    const { data, error } = await getServiceClient().auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo }
    });

    // Don't reveal whether an account exists. If the user is unknown,
    // generateLink errors — respond success regardless.
    const actionLink = data?.properties?.action_link || "";
    if (error || !actionLink) {
      return sendJson(res, 200, { sent: true });
    }

    await sendEmail({
      to: email,
      subject: "Reset your LittleNest MY password",
      html: resetEmailHtml({ resetUrl: actionLink })
    });
    return sendJson(res, 200, { sent: true });
  } catch (err) {
    // On a provider failure, fall back to Supabase's email rather than leaving
    // the user stuck.
    try {
      await getAnonClient().auth.resetPasswordForEmail(email, { redirectTo });
      return sendJson(res, 200, { sent: true, viaFallback: true });
    } catch {
      return sendJson(res, 500, { error: err.message || "Could not send reset email." });
    }
  }
}
