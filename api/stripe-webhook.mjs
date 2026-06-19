import Stripe from "stripe";
import { getConfigError, getServiceClient, hasServerSupabaseConfig } from "./_supabaseAdmin.mjs";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  if (!hasServerSupabaseConfig()) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: getConfigError() }));
    return;
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!stripeSecretKey || !webhookSecret) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Stripe is not configured." }));
    return;
  }

  const stripe = new Stripe(stripeSecretKey);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks);

  let event;
  try {
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: `Webhook signature verification failed: ${err.message}` }));
    return;
  }

  if (event.type !== "checkout.session.completed") {
    res.statusCode = 200;
    res.end(JSON.stringify({ received: true }));
    return;
  }

  const session = event.data.object;
  if (session.payment_status !== "paid") {
    res.statusCode = 200;
    res.end(JSON.stringify({ received: true }));
    return;
  }

  const userId = session.metadata?.supabaseUserId;
  const customerId = session.customer;

  if (!userId) {
    res.statusCode = 200;
    res.end(JSON.stringify({ received: true, note: "No supabaseUserId in metadata." }));
    return;
  }

  const service = getServiceClient();

  try {
    await service.from("profiles").update({
      plan: "premium",
      stripe_customer_id: customerId
    }).eq("id", userId);

    res.statusCode = 200;
    res.end(JSON.stringify({ received: true }));
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: error.message || "Webhook handler failed." }));
  }
}
