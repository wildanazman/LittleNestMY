export const authLoggedInKey = "isLoggedIn";
export const authCurrentUserKey = "currentUser";

export function isLoggedIn() {
  return readRaw(authLoggedInKey) === "true";
}

export function getCurrentUser() {
  return readJson(authCurrentUserKey, null);
}

export function loginLocalUser({ email, name = "" }) {
  const user = {
    email,
    name: name || email.split("@")[0] || "Parent",
    mode: "local",
    loggedInAt: new Date().toISOString()
  };
  writeRaw(authLoggedInKey, "true");
  writeJson(authCurrentUserKey, user);
  return user;
}

export function signupLocalUser({ name, email }) {
  return loginLocalUser({ name, email });
}

export function loginAsGuest() {
  const user = {
    email: "",
    name: "Guest Parent",
    mode: "guest",
    loggedInAt: new Date().toISOString()
  };
  writeRaw(authLoggedInKey, "true");
  writeJson(authCurrentUserKey, user);
  return user;
}

export function logoutLocalUser() {
  writeRaw(authLoggedInKey, "false");
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export function routeAfterAuth(hasBabyProfiles, screenUrl) {
  return hasBabyProfiles ? screenUrl("home_dashboard") : `${screenUrl("add_baby_profile")}?mode=create`;
}

function readRaw(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeRaw(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Local storage can be unavailable in private or restricted contexts.
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage can be unavailable in private or restricted contexts.
  }
}
