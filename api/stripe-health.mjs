import {
  getAuthenticatedUser,
  getConfigError,
  getServiceClient,
  hasServerSupabaseConfig,
  sendJson
} from "./_supabaseAdmin.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const auth = await getAuthenticatedUser(req);
  if (!auth.user) return sendJson(res, 401, { error: auth.error });

  const env = {
    supabase: hasServerSupabaseConfig(),
    stripeSecret: Boolean(process.env.STRIPE_SECRET_KEY),
    stripeWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    stripePrice: Boolean(process.env.NEXT_PUBLIC_STRIPE_PRICE_ID)
  };

  const result = {
    ok: false,
    env,
    configError: getConfigError(),
    profile: null,
    stripeEventsTable: "unchecked"
  };

  if (!env.supabase) return sendJson(res, 500, result);

  const service = getServiceClient();
  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("id, email, plan, stripe_customer_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  result.profile = profileError
    ? { error: profileError.message }
    : profile;

  const { error: eventError } = await service
    .from("stripe_events")
    .select("id")
    .limit(1);
  result.stripeEventsTable = eventError ? `error: ${eventError.message}` : "ok";
  result.ok = env.supabase && env.stripeSecret && env.stripeWebhookSecret && env.stripePrice && !profileError && !eventError;

  return sendJson(res, result.ok ? 200 : 500, result);
}
