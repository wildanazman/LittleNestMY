import { getCachedAuthUser } from "./localAuth.mjs";

const parentProfileKey = "littlenest:parentProfile";

export { parentProfileKey };

export function getParentProfile() {
  const user = getCachedAuthUser() || {};
  const saved = user.id ? readScopedProfile(user) : readJson(parentProfileKey, null);
  return {
    name: saved?.name || user.user_metadata?.display_name || user.user_metadata?.name || "Parent",
    email: saved?.email || user.email || "",
    photoUrl: saved?.photoUrl || "",
    updatedAt: saved?.updatedAt || ""
  };
}

export function saveParentProfile(profile) {
  const user = getCachedAuthUser() || {};
  const nextProfile = {
    ...getParentProfile(),
    ...profile,
    updatedAt: new Date().toISOString()
  };
  writeJson(parentProfileStorageKey(user.id), nextProfile);
  removeLegacyParentProfileIfDifferentUser(user);
  return nextProfile;
}

export function initialsForName(name) {
  return String(name || "Parent")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "P";
}

function readJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage can be unavailable in private or restricted contexts.
  }
}

function readScopedProfile(user) {
  const scoped = readJson(parentProfileStorageKey(user.id), null);
  if (scoped) return scoped;

  const legacy = readJson(parentProfileKey, null);
  const legacyEmail = String(legacy?.email || "").toLowerCase();
  const userEmail = String(user.email || "").toLowerCase();
  if (legacy && legacyEmail && legacyEmail === userEmail) {
    writeJson(parentProfileStorageKey(user.id), legacy);
    removeJson(parentProfileKey);
    return legacy;
  }

  if (legacy && legacyEmail && legacyEmail !== userEmail) {
    removeJson(parentProfileKey);
  }
  return null;
}

function parentProfileStorageKey(userId) {
  return userId ? `${parentProfileKey}:${userId}` : parentProfileKey;
}

function removeLegacyParentProfileIfDifferentUser(user) {
  const legacy = readJson(parentProfileKey, null);
  const legacyEmail = String(legacy?.email || "").toLowerCase();
  const userEmail = String(user?.email || "").toLowerCase();
  if (!legacy || !legacyEmail || legacyEmail === userEmail) return;
  removeJson(parentProfileKey);
}

function removeJson(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Local storage can be unavailable in private or restricted contexts.
  }
}
