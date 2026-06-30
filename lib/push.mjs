import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@littlenestmy.com";

let configured = false;
export function configurePush() {
  if (configured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export function isPushConfigured() {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

// Send to all of a user's subscriptions. Dead endpoints (404/410) are pruned.
export async function sendPushToUser(service, userId, payload) {
  if (!configurePush()) return { sent: 0, removed: 0 };
  const { data: subs, error } = await service
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error || !subs?.length) return { sent: 0, removed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      );
      sent += 1;
    } catch (err) {
      const code = err?.statusCode;
      if (code === 404 || code === 410) {
        await service.from("push_subscriptions").delete().eq("endpoint", sub.endpoint).catch(() => {});
        removed += 1;
      }
    }
  }
  return { sent, removed };
}
