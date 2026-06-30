import Stripe from "stripe";
import { getConfigError, getServiceClient, hasServerSupabaseConfig } from "../lib/supabaseAdmin.mjs";

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

  // Fetch HTTP client — reliable on Vercel serverless, same reason as the
  // checkout endpoint. The webhook also makes outbound calls (charge lookup
  // for disputes), so it needs a working network client too.
  const stripe = new Stripe(stripeSecretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
    timeout: 20000
  });

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks);

  let event;
  try {
    const sig = req.headers["stripe-signature"];
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
  } catch (err) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: `Webhook signature verification failed: ${err.message}` }));
    return;
  }

  const service = getServiceClient();

  try {
    // Idempotency: record the event id first; a duplicate delivery hits the
    // primary-key conflict and is acknowledged without re-applying anything.
    const { error: insertError } = await service
      .from("stripe_events")
      .insert({ id: event.id, type: event.type });
    if (insertError) {
      if (insertError.code === "23505") {
        return ok(res, { received: true, duplicate: true });
      }
      // stripe_events table missing or other issue — log and continue rather
      // than drop a real payment event.
      console.warn("stripe_events insert failed; processing without dedup.", insertError.message);
    }

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      if (session.payment_status !== "paid") return ok(res, { received: true });
      await upgradeFromCheckoutSession(service, session);
      return ok(res, { received: true });
    }

    // Refund or dispute → revoke premium for that customer.
    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      await downgradeByCustomer(service, charge.customer);
      return ok(res, { received: true });
    }

    if (event.type === "charge.dispute.created") {
      const dispute = event.data.object;
      let customerId = dispute.customer || null;
      if (!customerId && dispute.charge) {
        const charge = await stripe.charges.retrieve(dispute.charge);
        customerId = charge?.customer || null;
      }
      await downgradeByCustomer(service, customerId);
      return ok(res, { received: true });
    }

    return ok(res, { received: true });
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: error.message || "Webhook handler failed." }));
  }
}

function ok(res, payload) {
  res.statusCode = 200;
  res.end(JSON.stringify(payload));
}

async function downgradeByCustomer(service, customerId) {
  if (!customerId) return;
  const { error } = await service.from("profiles").update({ plan: "free" }).eq("stripe_customer_id", customerId);
  if (error) throw error;
}

async function upgradeFromCheckoutSession(service, session) {
  const userId = session.metadata?.supabaseUserId || "";
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id || "";

  let query = service.from("profiles").update({
    plan: "premium",
    stripe_customer_id: customerId || null
  });

  query = userId ? query.eq("id", userId) : query.eq("stripe_customer_id", customerId);
  const { error } = await query;
  if (error) throw error;
}
