import { screens } from "../data/screens.mjs";
import { getGuestLockMessage, isGuestScreenAllowed, rememberGuestLockNotice } from "./guestAccess.mjs";

const NAV_STACK_KEY = "littlenest:navStack";
const MAX_NAV_STACK = 24;
const VALID_SCREEN_IDS = new Set(screens.map((screen) => screen.id));
const NON_APP_BACK_SCREEN_IDS = new Set([
  "auth_welcome",
  "login",
  "signup",
  "accept_invite",
  "set_password",
  "verify_pending",
  "onboarding",
  "privacy_policy",
  "terms"
]);

export function screenUrl(screenId) {
  if (window.LittleNestCompat?.screenUrl) {
    return window.LittleNestCompat.screenUrl(screenId);
  }
  return window.location.protocol === "file:"
    ? `../${screenId}/code.html`
    : `/${screenId}/`;
}

export function goToScreen(screenId) {
  if (!ensureGuestCanOpen(screenId)) return;
  navigateWithTransition(screenUrl(screenId));
}

export function goBackOrTo(fallbackScreenId = "home_dashboard") {
  const previousScreenId = takePreviousAppScreen();
  if (previousScreenId) {
    navigateToScreen(previousScreenId, { replace: true });
    return;
  }

  if (hasUsefulBackEntry()) {
    window.history.back();
    return;
  }

  navigateToScreen(validScreenOrDefault(fallbackScreenId), { replace: true });
}

export function navigateWithTransition(url, options = {}) {
  navigateToUrl(url, options);
}

function navigateToScreen(screenId, options = {}) {
  if (!ensureGuestCanOpen(screenId)) return;
  navigateToUrl(screenUrl(validScreenOrDefault(screenId)), options);
}

function navigateToUrl(url, { replace = false } = {}) {
  if (!url) return;
  if (isSameLocation(url)) return;
  const applyNavigation = () => {
    if (replace) {
      window.location.replace(url);
    } else {
      window.location.href = url;
    }
  };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    applyNavigation();
    return;
  }
  document.documentElement.classList.add("ln-page-exit");
  window.setTimeout(applyNavigation, 120);
}

export function showUndoToast(message, onUndo, { duration = 5000 } = {}) {
  let toast = document.getElementById("prototypeUndoToast");
  if (toast) {
    clearTimeout(toast.__timer);
    toast.remove();
  }
  toast = document.createElement("div");
  toast.id = "prototypeUndoToast";
  toast.setAttribute("role", "status");
  toast.style.cssText = [
    "position:fixed",
    "left:50%",
    "bottom:calc(104px + env(safe-area-inset-bottom))",
    "transform:translate(-50%,120%)",
    "z-index:10001",
    "display:flex",
    "align-items:center",
    "gap:14px",
    "max-width:calc(100% - 28px)",
    "padding:12px 14px 12px 18px",
    "border-radius:9999px",
    "background:rgba(40,30,28,.94)",
    "color:#fff",
    "font:600 13px/1.2 'Nunito Sans',sans-serif",
    "box-shadow:0 14px 38px rgba(0,0,0,.32)",
    "backdrop-filter:blur(8px)",
    "transition:transform 240ms cubic-bezier(0.16,1,0.3,1)"
  ].join(";");
  toast.innerHTML = `<span style="min-width:0">${escapeToastHtml(message)}</span>`;
  const undoBtn = document.createElement("button");
  undoBtn.type = "button";
  undoBtn.textContent = "Undo";
  undoBtn.style.cssText = "flex:0 0 auto;padding:6px 14px;border-radius:9999px;background:#fff;color:#7056f4;font:700 13px/1 'Nunito Sans',sans-serif;border:0;cursor:pointer";
  toast.appendChild(undoBtn);
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.transform = "translate(-50%,0)"; });

  const dismiss = () => {
    clearTimeout(toast.__timer);
    toast.style.transform = "translate(-50%,120%)";
    setTimeout(() => toast.remove(), 240);
  };
  undoBtn.addEventListener("click", () => {
    dismiss();
    try { onUndo?.(); } catch { /* undo handler errors shouldn't crash UI */ }
  });
  toast.__timer = setTimeout(dismiss, duration);
  return dismiss;
}

function escapeToastHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function showComingSoon(title, message = "This prototype flow is coming soon.") {
  let modal = document.getElementById("prototypeComingSoonModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "prototypeComingSoonModal";
    modal.className = "fixed inset-0 z-[100] hidden items-end justify-center bg-black/25 px-5 pb-6";
    modal.innerHTML = `
      <div class="w-full max-w-md rounded-[24px] bg-surface-container-lowest p-5 shadow-2xl border border-white/60 space-y-4">
        <div class="flex items-start gap-3">
          <div class="w-11 h-11 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined">hourglass_empty</span>
          </div>
          <div class="flex-1">
            <h2 class="font-headline-md text-headline-md text-on-surface" data-coming-soon-title></h2>
            <p class="font-body-md text-body-md text-on-surface-variant" data-coming-soon-message></p>
          </div>
        </div>
        <button class="w-full h-12 rounded-full bg-primary text-on-primary font-label-md text-label-md active:scale-95 transition-transform" type="button" data-coming-soon-close>Got it</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector("[data-coming-soon-close]").addEventListener("click", () => {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    });
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
      }
    });
  }

  modal.querySelector("[data-coming-soon-title]").textContent = title;
  modal.querySelector("[data-coming-soon-message]").textContent = message;
  modal.querySelector("[data-guest-login]")?.classList.add("hidden");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

export function showGuestLocked(screenId = "") {
  rememberGuestLockNotice(screenId);
  showComingSoon("Create an account to unlock", getGuestLockMessage());
  const modal = document.getElementById("prototypeComingSoonModal");
  const sheet = modal?.querySelector(".w-full.max-w-md");
  if (!modal || !sheet) return;
  let loginButton = modal.querySelector("[data-guest-login]");
  if (!loginButton) {
    loginButton = document.createElement("button");
    loginButton.type = "button";
    loginButton.dataset.guestLogin = "true";
    loginButton.className = "w-full h-12 rounded-full bg-primary-container text-primary font-label-md text-label-md active:scale-95 transition-transform";
    loginButton.textContent = "Log in / Create account";
    loginButton.addEventListener("click", () => {
      window.location.href = screenUrl("auth_welcome");
    });
    sheet.insertBefore(loginButton, sheet.querySelector("[data-coming-soon-close]"));
  }
  loginButton.classList.remove("hidden");
}

function ensureGuestCanOpen(screenId) {
  if (isGuestScreenAllowed(screenId)) return true;
  showGuestLocked(screenId);
  return false;
}

export function bindPrototypeActions(root = document) {
  bindBottomNavigationFallback(root);
  markGuestLockedTargets(root);

  root.querySelectorAll("[data-screen-target]").forEach((element) => {
    element.addEventListener("click", () => goToScreen(element.dataset.screenTarget));
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        goToScreen(element.dataset.screenTarget);
      }
    });
  });

  root.querySelectorAll("[data-coming-soon]").forEach((element) => {
    element.addEventListener("click", () => showComingSoon(
      element.dataset.comingSoon,
      element.dataset.comingSoonMessage || "This prototype flow is coming soon."
    ));
  });
}

function markGuestLockedTargets(root = document) {
  ensureGuestLockStyles();
  root.querySelectorAll("[data-screen-target]").forEach((element) => {
    const screenId = element.dataset.screenTarget;
    const locked = !isGuestScreenAllowed(screenId);
    if (locked) {
      element.setAttribute("data-guest-locked", "true");
      element.setAttribute("aria-disabled", "true");
      element.setAttribute("title", "Create an account to unlock");
    } else {
      element.removeAttribute("data-guest-locked");
      element.removeAttribute("aria-disabled");
      element.removeAttribute("title");
    }
  });
}

function ensureGuestLockStyles() {
  if (document.getElementById("littleNestGuestLockStyles")) return;
  const style = document.createElement("style");
  style.id = "littleNestGuestLockStyles";
  style.textContent = `
    [data-guest-locked="true"] {
      position: relative;
    }
    [data-guest-locked="true"]::after {
      content: "lock";
      position: absolute;
      right: 8px;
      top: 8px;
      z-index: 3;
      width: 22px;
      height: 22px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,.86);
      color: var(--color-primary, #7056f4);
      border: 1px solid rgba(124,92,255,.14);
      box-shadow: 0 6px 14px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.82);
      font-family: "Material Symbols Outlined";
      font-size: 14px;
      font-weight: normal;
      line-height: 1;
      pointer-events: none;
      font-variation-settings: "FILL" 1, "wght" 500, "GRAD" 0, "opsz" 20;
    }
    nav [data-guest-locked="true"]::after {
      right: 4px;
      top: 2px;
      width: 18px;
      height: 18px;
      font-size: 12px;
    }
    :root.dark [data-guest-locked="true"]::after {
      background: rgba(18,27,45,.92);
      color: #d6ccff;
      border-color: rgba(214,204,255,.18);
      box-shadow: 0 8px 18px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.08);
    }
  `;
  document.head.appendChild(style);
}

export function bindBottomNavigationFallback(root = document) {
  hoistBottomNavigation(root);
  const navTargets = {
    home: "home_dashboard",
    log: "quick_log",
    calendar: "calendar",
    milestones: "milestones",
    assistant: "assistant"
  };
  const activeScreen = getCurrentScreenId();
  const activeKey = Object.entries(navTargets).find(([, screenId]) => screenId === activeScreen)?.[0]
    || (["feeding_log", "sleep_log", "diaper_log", "growth_tracker", "health_records"].includes(activeScreen) ? "log" : "")
    || (activeScreen === "mama_care" ? "home" : "")
    || (activeScreen === "daily_summary" ? "home" : "")
    || (activeScreen === "weekly_insights" ? "calendar" : "")
    || (activeScreen === "memory_book" ? "milestones" : "")
    || (["settings", "privacy_safety", "family_sharing", "mommy_guide", "add_baby_profile", "baby_profiles", "sleep_prediction", "growth_correlation"].includes(activeScreen) ? "assistant" : "")
    || "home";

  root.querySelectorAll("nav.fixed a, nav.fixed button").forEach((item) => {
    const label = getNavLabel(item);
    const screenId = navTargets[label];

    if (!screenId || item.dataset.prototypeNavBound === "true") return;

    item.dataset.prototypeNavBound = "true";
    normalizeNavItem(item, label === activeKey);
    if (item.tagName === "A") item.href = isGuestScreenAllowed(screenId) ? screenUrl(screenId) : "#";
    item.addEventListener("click", (event) => {
      event.preventDefault();
      goToScreen(screenId);
    });
  });
}

bindBottomNavigationFallback();
rememberCurrentScreenVisit();

function getNavLabel(item) {
  const labelElement = item.querySelector("span:last-child");
  return (labelElement?.textContent || item.textContent).trim().toLowerCase();
}

function normalizeNavItem(item, isActive) {
  const nav = item.closest("nav.fixed");
  if (nav) {
    if (nav.parentElement !== document.body) document.body.appendChild(nav);
    nav.className = "fixed bottom-0 z-50 flex justify-around items-center";
    nav.style.position = "fixed";
    nav.style.left = "max(14px, env(safe-area-inset-left))";
    nav.style.right = "max(14px, env(safe-area-inset-right))";
    nav.style.bottom = "calc(12px + env(safe-area-inset-bottom))";
    nav.style.width = "auto";
    nav.style.maxWidth = "520px";
    nav.style.minHeight = "76px";
    nav.style.margin = "0 auto";
    nav.style.zIndex = "9999";
  }

  item.className = [
    "flex flex-col items-center justify-center rounded-full transition-colors active:scale-90 duration-150",
    "h-[58px] px-2 py-1 min-w-0",
    isActive
      ? "bg-primary-container text-on-primary-container"
      : "text-on-secondary-fixed-variant hover:bg-secondary-container"
  ].join(" ");
  item.setAttribute("aria-current", isActive ? "page" : "false");
  item.style.width = "clamp(58px, 18vw, 78px)";
  item.style.height = "58px";
  item.style.minWidth = "0";
  item.style.maxWidth = "78px";
  item.style.flex = "1 1 0";
  item.style.borderRadius = "9999px";

  const icon = item.querySelector(".material-symbols-outlined");
  if (icon) {
    icon.classList.add("text-[24px]");
    icon.style.fontVariationSettings = isActive ? "'FILL' 1" : "'FILL' 0";
  }

  const label = item.querySelector("span:last-child");
  if (label) {
    label.className = "font-label-sm text-[10px] leading-4 whitespace-nowrap";
  }
}

function getCurrentScreenId() {
  const path = window.location.pathname.replaceAll("\\", "/");
  const fileMatch = path.match(/\/src\/screens\/([^/]+)\/code\.html$/);
  if (fileMatch) return fileMatch[1];
  const parts = path.split("/").filter(Boolean);
  const indexMatch = parts.length >= 2 && parts[1].toLowerCase() === "index.html" ? parts[0] : "";
  return indexMatch || parts[0] || "home_dashboard";
}

function isSameLocation(url) {
  try {
    const next = new URL(url, window.location.href);
    return next.href === window.location.href;
  } catch {
    return false;
  }
}

function hasUsefulBackEntry() {
  if (window.location.hash) return false;
  if (window.history.length <= 1) return false;
  if (!document.referrer) return false;

  try {
    const previous = new URL(document.referrer);
    const current = new URL(window.location.href);
    if (previous.origin !== current.origin) return false;
    const previousScreenId = screenIdFromUrl(previous);
    const currentScreenId = screenIdFromUrl(current);
    if (!isTrackableAppScreen(previousScreenId)) return false;
    return previousScreenId !== currentScreenId && routeIdentity(previous) !== routeIdentity(current);
  } catch {
    return false;
  }
}

function rememberCurrentScreenVisit() {
  const currentScreenId = getCurrentScreenId();
  if (!isTrackableAppScreen(currentScreenId)) return;
  const stack = readNavStack().filter((screenId) => isTrackableAppScreen(screenId));
  if (stack[stack.length - 1] !== currentScreenId) {
    stack.push(currentScreenId);
  }
  writeNavStack(stack.slice(-MAX_NAV_STACK));
}

function takePreviousAppScreen() {
  const currentScreenId = getCurrentScreenId();
  const stack = readNavStack().filter((screenId) => isTrackableAppScreen(screenId));

  while (stack.length && stack[stack.length - 1] === currentScreenId) {
    stack.pop();
  }

  const previousScreenId = stack.pop();
  writeNavStack(stack);

  if (!isTrackableAppScreen(previousScreenId) || previousScreenId === currentScreenId) return "";
  return previousScreenId;
}

function readNavStack() {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(NAV_STACK_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function writeNavStack(stack) {
  try {
    window.sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack));
  } catch {
    // Some restricted WebViews can deny storage; fallback navigation still works.
  }
}

function screenIdFromUrl(url) {
  const path = url.pathname.replaceAll("\\", "/");
  const fileMatch = path.match(/\/src\/screens\/([^/]+)\/code\.html$/);
  if (fileMatch) return fileMatch[1];
  const parts = path.split("/").filter(Boolean);
  if (parts.length >= 2 && parts[1].toLowerCase() === "index.html") return parts[0];
  return parts[0] || "";
}

function isTrackableAppScreen(screenId) {
  return VALID_SCREEN_IDS.has(screenId) && !NON_APP_BACK_SCREEN_IDS.has(screenId);
}

function validScreenOrDefault(screenId, defaultScreenId = "home_dashboard") {
  return VALID_SCREEN_IDS.has(screenId) ? screenId : defaultScreenId;
}

function routeIdentity(url) {
  return url.pathname
    .replace(/\/code\.html$/i, "/")
    .replace(/\/+$/g, "")
    || "/";
}

function hoistBottomNavigation(root = document) {
  root.querySelectorAll("nav.fixed.bottom-0").forEach((nav) => {
    if (nav.parentElement !== document.body) document.body.appendChild(nav);
    nav.style.position = "fixed";
    nav.style.left = "max(14px, env(safe-area-inset-left))";
    nav.style.right = "max(14px, env(safe-area-inset-right))";
    nav.style.bottom = "calc(12px + env(safe-area-inset-bottom))";
    nav.style.width = "auto";
    nav.style.maxWidth = "520px";
    nav.style.margin = "0 auto";
    nav.style.zIndex = "9999";
  });
}
