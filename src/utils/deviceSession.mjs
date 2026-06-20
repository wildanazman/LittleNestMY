// Single-device login enforcement.
//
// On every fresh login/signup the device generates a random session id, stores
// it locally, and writes it onto `profiles.active_session_id`. Each protected
// screen verifies that the remote id still matches this device; if another
// device has since logged in (and overwritten the id), this device is signed
// out. A realtime subscription kicks the stale device instantly while the app
// is open. Purpose: stop one account being shared across two phones.

import { isSupabaseConfigured, supabase } from "./supabaseClient.mjs";

const deviceSessionKey = "littlenest:deviceSessionId";
export const kickedFlagKey = "littlenest:kickedOtherDevice";

function readLocalId() {
  try {
    return window.localStorage.getItem(deviceSessionKey) || "";
  } catch {
    return "";
  }
}

function writeLocalId(id) {
  try {
    if (id) window.localStorage.setItem(deviceSessionKey, id);
    else window.localStorage.removeItem(deviceSessionKey);
  } catch {
    // Device session id is best-effort local state.
  }
}

function newSessionId() {
  try {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  } catch {
    // fall through to manual id
  }
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

// Called right after a successful login/signup. Mints a brand-new id and writes
// it to the profile, which evicts whichever device was active before.
export async function claimDeviceSession(userId) {
  if (!isSupabaseConfigured || !supabase || !userId) return "";
  const id = newSessionId();
  writeLocalId(id);
  const { error } = await supabase
    .from("profiles")
    .update({ active_session_id: id })
    .eq("id", userId);
  if (error) {
    console.warn("Could not claim device session.", error);
  }
  return id;
}

// Clears the local id on logout (and best-effort releases the remote slot so a
// later login on another device adopts cleanly).
export async function releaseDeviceSession(userId) {
  writeLocalId("");
  if (!isSupabaseConfigured || !supabase || !userId) return;
  try {
    // Null the remote slot so the next login on any device adopts cleanly.
    await supabase.from("profiles").update({ active_session_id: null }).eq("id", userId);
  } catch (error) {
    console.warn("Could not release device session.", error);
  }
}

// Returns "ok" | "superseded". If the remote slot is empty or we have no local
// id yet (e.g. a session that predates this feature), this device adopts the
// slot so existing users aren't kicked on first load after the update.
export async function verifyDeviceSession(userId) {
  if (!isSupabaseConfigured || !supabase || !userId) return "ok";

  const localId = readLocalId();
  const { data, error } = await supabase
    .from("profiles")
    .select("active_session_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    // Network/permission hiccup — fail open so a flaky connection never locks
    // a legitimate user out of their own account.
    console.warn("Could not verify device session.", error);
    return "ok";
  }

  const remoteId = data?.active_session_id || "";

  if (!remoteId) {
    // Nobody holds the slot — claim it.
    await claimDeviceSession(userId);
    return "ok";
  }
  if (!localId) {
    // We have a valid auth session but never claimed (pre-feature). Adopt by
    // claiming a new id; last device to load wins, then normal rules apply.
    await claimDeviceSession(userId);
    return "ok";
  }
  return localId === remoteId ? "ok" : "superseded";
}

// Realtime kick: fires onSuperseded() the moment another device overwrites the
// active_session_id while this screen is open. Returns an unsubscribe fn.
export function watchDeviceSession(userId, onSuperseded) {
  if (!isSupabaseConfigured || !supabase || !userId) return () => {};

  const channel = supabase
    .channel(`device-session-${userId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
      (payload) => {
        const remoteId = payload?.new?.active_session_id || "";
        const localId = readLocalId();
        if (remoteId && localId && remoteId !== localId) {
          onSuperseded();
        }
      }
    )
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {
      // best effort
    }
  };
}

export function markKickedFlag() {
  try {
    window.localStorage.setItem(kickedFlagKey, "1");
  } catch {
    // best effort
  }
}

export function consumeKickedFlag() {
  try {
    const v = window.localStorage.getItem(kickedFlagKey) === "1";
    window.localStorage.removeItem(kickedFlagKey);
    return v;
  } catch {
    return false;
  }
}
