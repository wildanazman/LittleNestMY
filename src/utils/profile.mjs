import { getCachedAuthUser } from "./localAuth.mjs";

const parentProfileKey = "littlenest:parentProfile";

export { parentProfileKey };

export function getParentProfile() {
  const saved = readJson(parentProfileKey, null);
  const user = getCachedAuthUser() || {};
  return {
    name: saved?.name || user.user_metadata?.display_name || user.user_metadata?.name || "Parent",
    email: saved?.email || user.email || "",
    photoUrl: saved?.photoUrl || "",
    updatedAt: saved?.updatedAt || ""
  };
}

export function saveParentProfile(profile) {
  const nextProfile = {
    ...getParentProfile(),
    ...profile,
    updatedAt: new Date().toISOString()
  };
  writeJson(parentProfileKey, nextProfile);
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
