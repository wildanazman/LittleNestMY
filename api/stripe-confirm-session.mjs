import Stripe from "stripe";
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

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
  if (!stripeSecretKey) {
    return sendJson(res, 500, { error: "Stripe is not configured." });
  }

  const auth = await getAuthenticatedUser(req);
  if (!auth.user) return sendJson(res, 401, { error: auth.error });

  const body = await readJsonBody(req);
  const sessionId = String(body.sessionId || "").trim();
  if (!/^cs_(test|live)_/.test(sessionId)) {
    return sendJson(res, 400, { error: "Invalid checkout session." });
  }

  const stripe = new Stripe(stripeSecretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
    timeout: 20000
  });
  const service = getServiceClient();

  try {
    const [session, profileResult] = await Promise.all([
      stripe.checkout.sessions.retrieve(sessionId),
      service
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", auth.user.id)
        .maybeSingle()
    ]);

    if (session.payment_status !== "paid") {
      return sendJson(res, 409, { error: "Payment is not marked as paid yet." });
    }

    const userId = session.metadata?.supabaseUserId || "";
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id || "";
    const customerMatchesProfile = Boolean(customerId && profileResult.data?.stripe_customer_id === customerId);
    if (userId !== auth.user.id && !customerMatchesProfile) {
      return sendJson(res, 403, { error: "Checkout session does not belong to this account." });
    }

    const { error: updateError } = await service
      .from("profiles")
      .update({ plan: "premium", stripe_customer_id: customerId || null })
      .eq("id", auth.user.id);
    if (updateError) throw updateError;

    await service
      .from("stripe_events")
      .insert({ id: `confirm:${session.id}`, type: "checkout.session.confirmed" })
      .then(({ error }) => {
        if (error && error.code !== "23505") {
          console.warn("stripe confirm event insert failed.", error.message);
        }
      });

    return sendJson(res, 200, { plan: "premium" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Could not confirm checkout session." });
  }
}
