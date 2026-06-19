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
  const priceId = body.priceId || process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || "";
  if (!priceId) {
    return sendJson(res, 400, { error: "Missing price ID." });
  }

  const service = getServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select("stripe_customer_id, plan, email, display_name")
    .eq("id", auth.user.id)
    .maybeSingle();

  const origin = req.headers["x-forwarded-proto"]
    ? `${req.headers["x-forwarded-proto"]}://${req.headers["x-forwarded-host"] || req.headers.host}`
    : `http://localhost:${process.env.PORT || 5173}`;

  const stripe = new Stripe(stripeSecretKey);

  try {
    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email || auth.user.email,
        name: profile?.display_name || "LittleNest User",
        metadata: { supabaseUserId: auth.user.id }
      });
      customerId = customer.id;
      await service.from("profiles").update({ stripe_customer_id: customerId }).eq("id", auth.user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/subscription/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/subscription/?canceled=true`,
      metadata: { supabaseUserId: auth.user.id }
    });

    return sendJson(res, 200, { url: session.url, sessionId: session.id });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Checkout session creation failed." });
  }
}
