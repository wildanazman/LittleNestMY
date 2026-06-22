// Web Push subscription management (client side).
//
// enablePush(): asks permission, subscribes via the service worker's
// PushManager using the public VAPID key, and saves the subscription to
// Supabase so the reminders cron can push to this device.
// disablePush(): removes the subscription locally and from Supabase.

import { runtimeEnv } from "../config/runtime-env.mjs";
import { isSupabaseConfigured, supabase } from "./supabaseClient.mjs";
import { getAuthSession } from "./localAuth.mjs";

const VAPID_PUBLIC_KEY = runtimeEnv.VITE_VAPID_PUBLIC_KEY || "";

export function isPushSupported() {
  return typeof navigator !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

export function isPushConfigured() {
  return Boolean(VAPID_PUBLIC_KEY);
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS
}

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches
    || window.navigator.standalone === true;
}

// Why push can't be enabled here (for user-facing messaging).
// "needs-install" = iOS requires the app added to the Home Screen first.
export function pushUnavailableReason() {
  if (isIOS() && !isStandalone()) return "needs-install";
  if (!isPushSupported()) return "unsupported";
  if (!isPushConfigured()) return "not-configured";
  return "";
}

export async function enablePush() {
  // iOS only allows web push from an installed (Home Screen) PWA.
  if (isIOS() && !isStandalone()) return { ok: false, reason: "needs-install" };
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (!VAPID_PUBLIC_KEY || !isSupabaseConfigured) return { ok: false, reason: "not-configured" };

  // Request permission as the first async step so it stays inside the user
  // gesture (iOS rejects permission prompts that aren't gesture-initiated).
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    await saveSubscription(subscription);
    return { ok: true };
  } catch (error) {
    console.warn("Push subscribe failed.", error);
    return { ok: false, reason: "error", error };
  }
}

export async function disablePush() {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await removeSubscription(subscription.endpoint);
      await subscription.unsubscribe();
    }
  } catch (error) {
    console.warn("Push unsubscribe failed.", error);
  }
}

async function saveSubscription(subscription) {
  const session = await getAuthSession();
  if (!session?.user) return;
  const json = subscription.toJSON();
  if (!json.keys?.p256dh || !json.keys?.auth) return;
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: session.user.id,
    endpoint: subscription.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent,
    updated_at: new Date().toISOString()
  }, { onConflict: "endpoint" });
  if (error) console.warn("Could not save push subscription.", error);
}

async function removeSubscription(endpoint) {
  try {
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  } catch (error) {
    console.warn("Could not remove push subscription.", error);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
