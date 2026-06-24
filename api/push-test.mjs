import { getAuthenticatedUser, getConfigError, getServiceClient, hasServerSupabaseConfig, sendJson } from "./_supabaseAdmin.mjs";
import { isPushConfigured, sendPushToUser } from "./_push.mjs";

// Sends a test push to the signed-in user's own devices, so they can confirm
// Web Push works (especially on an installed iOS PWA) without waiting for a
// real reminder to come due.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  if (!hasServerSupabaseConfig()) return sendJson(res, 500, { error: getConfigError() });
  if (!isPushConfigured()) return sendJson(res, 500, { error: "Push is not configured (VAPID keys missing)." });

  const auth = await getAuthenticatedUser(req);
  if (!auth.user) return sendJson(res, 401, { error: auth.error });

  const service = getServiceClient();
  const result = await sendPushToUser(service, auth.user.id, {
    title: "LittleNest test 🔔",
    body: "Push notifications are working on this device.",
    tag: "littlenest-test",
    url: "/home_dashboard/"
  });

  if (!result.sent) {
    return sendJson(res, 200, { sent: 0, note: "No active subscription for this account. Turn on a reminder in Settings first (on the installed app)." });
  }
  return sendJson(res, 200, { sent: result.sent });
}
