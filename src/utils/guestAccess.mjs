import { isGuestMode } from "./localAuth.mjs";

const GUEST_ALLOWED_SCREENS = new Set([
  "auth_welcome",
  "login",
  "signup",
  "privacy_policy",
  "terms",
  "home_dashboard",
  "quick_log",
  "feeding_log",
  "sleep_log",
  "diaper_log",
  "baby_profiles",
  "add_baby_profile",
  "settings"
]);

const GUEST_LOCK_MESSAGE = "Guest mode only supports baby profile setup plus feeding, diaper, and sleep logs. Create an account to unlock everything else.";

export function isGuestRestricted() {
  return isGuestMode();
}

export function isGuestScreenAllowed(screenId) {
  if (!isGuestRestricted()) return true;
  return GUEST_ALLOWED_SCREENS.has(String(screenId || ""));
}

export function getGuestLockMessage() {
  return GUEST_LOCK_MESSAGE;
}

export function getGuestFallbackScreen() {
  return "home_dashboard";
}

export function rememberGuestLockNotice(screenId = "") {
  try {
    window.sessionStorage.setItem("littlenest:guestLockNotice", JSON.stringify({
      screenId,
      message: GUEST_LOCK_MESSAGE,
      createdAt: Date.now()
    }));
  } catch {
    // Guest lock notice is best-effort UI state only.
  }
}

export function takeGuestLockNotice() {
  try {
    const raw = window.sessionStorage.getItem("littlenest:guestLockNotice");
    window.sessionStorage.removeItem("littlenest:guestLockNotice");
    if (!raw) return null;
    const notice = JSON.parse(raw);
    if (!notice?.message || Date.now() - Number(notice.createdAt || 0) > 5000) return null;
    return notice;
  } catch {
    return null;
  }
}
