import { isSupabaseConfigured, requireSupabaseClient, supabase, supabaseConfigMessage } from "./supabaseClient.mjs";

let cachedSession = null;
export const pendingInviteTokenKey = "littlenest:pendingInviteToken";
export const needsPasswordSetupKey = "littlenest:needsPasswordSetup";
export const guestModeKey = "littlenest:isGuest";
const lastAuthUserIdKey = "littlenest:lastAuthUserId";

export function hasSupabaseConfig() {
  return isSupabaseConfigured;
}

export function getAuthConfigMessage() {
  return supabaseConfigMessage;
}

export async function isLoggedIn() {
  if (isGuestMode()) return true;
  return Boolean(await getAuthSession());
}

export async function getAuthSession() {
  if (isGuestMode()) return null;
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn("Unable to read Supabase session.", error);
    return null;
  }

  clearStaleProfileCacheForSession(data.session || null);
  cachedSession = data.session || null;
  return cachedSession;
}

export async function getCurrentUser() {
  const session = await getAuthSession();
  return session?.user || null;
}

export async function loginLocalUser({ email, password }) {
  clearGuestMode();
  const client = requireSupabaseClient();
  const cleanEmail = normalizeEmail(email);
  const { data, error } = await client.auth.signInWithPassword({ email: cleanEmail, password });
  if (error) throw friendlyAuthError(error, "login");

  cachedSession = data.session || null;
  if (data.user) await upsertProfileForUser(data.user);
  return data;
}

export async function signupLocalUser({ name, email, password }) {
  clearGuestMode();
  const client = requireSupabaseClient();
  const cleanEmail = normalizeEmail(email);
  const { data, error } = await client.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        display_name: name,
        name
      }
    }
  });

  if (error) throw friendlyAuthError(error, "signup");
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error("An account already exists for this email. Please log in or reset your password.");
  }

  cachedSession = data.session || null;
  if (data.user) await upsertProfileForUser(data.user, { displayName: name });
  return data;
}

export async function sendPasswordReset(email, redirectTo = "") {
  const client = requireSupabaseClient();
  const cleanEmail = normalizeEmail(email);
  const options = redirectTo ? { redirectTo } : undefined;
  const { error } = await client.auth.resetPasswordForEmail(cleanEmail, options);
  if (error) throw friendlyAuthError(error, "reset");
  return true;
}

export async function updateCurrentUserPassword(password) {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.updateUser({ password });
  if (error) throw friendlyAuthError(error, "reset");
  cachedSession = data?.user ? cachedSession : cachedSession;
  clearNeedsPasswordSetup();
  return data;
}

export async function loginAsGuest() {
  try {
    window.localStorage.setItem(guestModeKey, "true");
    window.localStorage.removeItem("currentUser");
  } catch {
    // Guest mode is local-only.
  }
  cachedSession = null;
  return { guest: true };
}

export function isGuestMode() {
  try {
    return window.localStorage.getItem(guestModeKey) === "true";
  } catch {
    return false;
  }
}

function clearGuestMode() {
  try {
    window.localStorage.removeItem(guestModeKey);
  } catch {
    // Guest flag is local-only.
  }
}

export async function logoutLocalUser() {
  clearGuestMode();
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  cachedSession = null;
  clearSessionDisplayCache();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function routeAfterAuth(hasBabyProfiles, screenUrl) {
  const pendingInviteToken = getPendingInviteToken();
  if (pendingInviteToken) {
    return `${screenUrl("accept_invite")}?token=${encodeURIComponent(pendingInviteToken)}`;
  }
  return hasBabyProfiles ? screenUrl("home_dashboard") : `${screenUrl("add_baby_profile")}?mode=create`;
}

export function rememberPendingInviteToken(token) {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) return "";
  try {
    window.localStorage.setItem(pendingInviteTokenKey, cleanToken);
  } catch {
    // Invite resume is best-effort local navigation state.
  }
  return cleanToken;
}

export function getPendingInviteToken() {
  try {
    return String(window.localStorage.getItem(pendingInviteTokenKey) || "").trim();
  } catch {
    return "";
  }
}

export function clearPendingInviteToken() {
  try {
    window.localStorage.removeItem(pendingInviteTokenKey);
  } catch {
    // Invite resume is best-effort local navigation state.
  }
}

export function markNeedsPasswordSetup(email = "") {
  try {
    window.localStorage.setItem(needsPasswordSetupKey, JSON.stringify({
      email,
      createdAt: new Date().toISOString()
    }));
  } catch {
    // Password reminder is local UI state only.
  }
}

export function getNeedsPasswordSetup() {
  try {
    return JSON.parse(window.localStorage.getItem(needsPasswordSetupKey) || "null");
  } catch {
    return null;
  }
}

export function clearNeedsPasswordSetup() {
  try {
    window.localStorage.removeItem(needsPasswordSetupKey);
  } catch {
    // Password reminder is local UI state only.
  }
}

export function getCachedAuthUser() {
  return cachedSession?.user || null;
}

export async function upsertProfileForUser(user, options = {}) {
  if (!user || !isSupabaseConfigured) return null;

  const displayName = options.displayName
    || user.user_metadata?.display_name
    || user.user_metadata?.name
    || user.email?.split("@")[0]
    || "Parent";

  const profile = {
    id: user.id,
    email: user.email || "",
    display_name: displayName,
    avatar_url: user.user_metadata?.avatar_url || null,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "id" });

  if (error) {
    console.warn("Supabase profile upsert skipped.", error);
    return null;
  }

  rememberParentProfile(profile);
  return profile;
}

function rememberParentProfile(profile) {
  try {
    const userId = profile.id || cachedSession?.user?.id || "";
    const storageKey = userId ? `littlenest:parentProfile:${userId}` : "littlenest:parentProfile";
    const existing = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    window.localStorage.setItem(storageKey, JSON.stringify({
      ...existing,
      name: profile.display_name || existing.name || "Parent",
      email: profile.email || existing.email || "",
      photoUrl: existing.photoUrl || profile.avatar_url || "",
      updatedAt: new Date().toISOString()
    }));
    window.localStorage.removeItem("currentUser");
    const legacy = JSON.parse(window.localStorage.getItem("littlenest:parentProfile") || "null");
    if (legacy?.email && String(legacy.email).toLowerCase() !== String(profile.email || "").toLowerCase()) {
      window.localStorage.removeItem("littlenest:parentProfile");
    }
  } catch {
    // Parent profile cache is only for local UI display.
  }
}

function clearStaleProfileCacheForSession(session) {
  try {
    const nextUserId = session?.user?.id || "";
    const previousUserId = window.localStorage.getItem(lastAuthUserIdKey) || "";
    if (nextUserId && previousUserId && previousUserId !== nextUserId) {
      window.localStorage.removeItem("currentUser");
      window.localStorage.removeItem("littlenest:parentProfile");
    }
    if (nextUserId) window.localStorage.setItem(lastAuthUserIdKey, nextUserId);
  } catch {
    // Local display cache cleanup is best effort.
  }
}

function clearSessionDisplayCache() {
  try {
    window.localStorage.removeItem("currentUser");
    window.localStorage.removeItem("littlenest:parentProfile");
  } catch {
    // Local display cache cleanup is best effort.
  }
}

function friendlyAuthError(error, mode) {
  const message = String(error?.message || error || "");
  if (/invalid login credentials|invalid credentials/i.test(message)) {
    return new Error("Email or password is incorrect. If this account was created from an invitation, please set or reset your password first.");
  }
  if (/already registered|already exists|user already/i.test(message)) {
    return new Error("An account already exists for this email. Please log in or reset your password.");
  }
  if (/email not confirmed/i.test(message)) {
    return new Error("Please confirm your email before logging in.");
  }
  if (mode === "signup" && /signup/i.test(message)) {
    return new Error(message);
  }
  return error;
}
