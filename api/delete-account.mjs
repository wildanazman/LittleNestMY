import {
  getAuthenticatedUser,
  getConfigError,
  getServiceClient,
  hasServerSupabaseConfig,
  sendJson
} from "../lib/supabaseAdmin.mjs";

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    res.setHeader("allow", "DELETE");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  if (!hasServerSupabaseConfig()) {
    return sendJson(res, 500, { error: getConfigError() });
  }

  const auth = await getAuthenticatedUser(req);
  if (!auth.user) return sendJson(res, 401, { error: auth.error });

  const service = getServiceClient();
  const { error: profileError } = await service
    .from("profiles")
    .delete()
    .eq("id", auth.user.id);
  if (profileError) return sendJson(res, 500, { error: profileError.message || "Could not delete profile." });

  const { error: authError } = await service.auth.admin.deleteUser(auth.user.id);
  if (authError) return sendJson(res, 500, { error: authError.message || "Could not delete account." });

  return sendJson(res, 200, { message: "Account deleted." });
}
