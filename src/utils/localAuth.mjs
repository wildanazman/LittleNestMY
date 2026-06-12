import { isSupabaseConfigured, requireSupabaseClient, supabase, supabaseConfigMessage } from "./supabaseClient.mjs";

let cachedSession = null;

export function hasSupabaseConfig() {
  return isSupabaseConfigured;
}

export function getAuthConfigMessage() {
  return supabaseConfigMessage;
}

export async function isLoggedIn() {
  return Boolean(await getAuthSession());
}

export async function getAuthSession() {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn("Unable to read Supabase session.", error);
    return null;
  }

  cachedSession = data.session || null;
  return cachedSession;
}

export async function getCurrentUser() {
  const session = await getAuthSession();
  return session?.user || null;
}

export async function loginLocalUser({ email, password }) {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;

  cachedSession = data.session || null;
  if (data.user) await upsertProfileForUser(data.user);
  return data;
}

export async function signupLocalUser({ name, email, password }) {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: name,
        name
      }
    }
  });

  if (error) throw error;

  cachedSession = data.session || null;
  if (data.user) await upsertProfileForUser(data.user, { displayName: name });
  return data;
}

export async function loginAsGuest() {
  throw new Error("Guest mode is not available while Supabase Auth is enabled. Please log in or create an account.");
}

export async function logoutLocalUser() {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  cachedSession = null;
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export function routeAfterAuth(hasBabyProfiles, screenUrl) {
  return hasBabyProfiles ? screenUrl("home_dashboard") : `${screenUrl("add_baby_profile")}?mode=create`;
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
    const existing = JSON.parse(window.localStorage.getItem("littlenest:parentProfile") || "{}");
    window.localStorage.setItem("littlenest:parentProfile", JSON.stringify({
      ...existing,
      name: existing.name || profile.display_name || "Parent",
      email: profile.email || existing.email || "",
      photoUrl: existing.photoUrl || profile.avatar_url || "",
      updatedAt: new Date().toISOString()
    }));
  } catch {
    // Parent profile cache is only for local UI display.
  }
}
