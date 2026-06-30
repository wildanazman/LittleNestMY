import { applyTranslations, getLanguage, t } from "./i18n.mjs";
import { getAuthSession, isEmailVerified, isGuestMode, isLoggedIn, logoutLocalUser } from "./localAuth.mjs";
import { markKickedFlag, verifyDeviceSession, watchDeviceSession } from "./deviceSession.mjs";
import { isAdminEmail } from "./admin.mjs";
import { initErrorMonitor } from "./errorMonitor.mjs";
import { getParentProfile, initialsForName } from "./profile.mjs";
import { acceptFamilyInviteRemote, declineFamilyInviteRemote, loadPendingFamilyInvitesRemote } from "./familyInvitesRemote.mjs";
import { goBackOrTo, showGuestLocked } from "./prototypeUi.mjs";
import { getGuestFallbackScreen, isGuestScreenAllowed, rememberGuestLockNotice, takeGuestLockNotice } from "./guestAccess.mjs";

// Screens that already paint their own inline loading skeleton — the shared
// global skeleton would double up, so it is suppressed there.
const BESPOKE_SKELETON_SCREENS = new Set([
  "home_dashboard", "home_dashboard_dark",
  "growth_tracker", "mama_care", "milestones",
  "doctor_report", "baby_profiles",
  "sleep_log", "sleep_log_dark"
]);

// Public/auth screens never get a skeleton.
const SKELETON_PUBLIC_SCREENS = ["auth_welcome", "login", "signup", "accept_invite", "set_password", "verify_pending", "onboarding", "privacy_policy", "terms"];

// Mount the shared skeleton as early as possible so every other screen shows a
// consistent loading state (like the homescreen) while its module fetches data.
(function activateGlobalSkeleton() {
  const screenId = getCurrentScreenId();
  if (SKELETON_PUBLIC_SCREENS.includes(screenId)) return;
  if (BESPOKE_SKELETON_SCREENS.has(screenId)) return;
  mountGlobalSkeleton();
})();

const routes = {
  home: "home_dashboard",
  log: "quick_log",
  calendar: "calendar",
  milestones: "milestones",
  assistant: "assistant"
};

function screenUrl(screenId) {
  if (window.LittleNestCompat?.screenUrl) return window.LittleNestCompat.screenUrl(screenId);
  return window.location.protocol === "file:" ? `../${screenId}/code.html` : `/${screenId}`;
}

const activeGroups = {
  home_dashboard: "home",
  home_dashboard_dark: "home",
  mama_care: "home",
  daily_summary: "home",
  quick_log: "log",
  quick_log_dark: "log",
  feeding_log: "log",
  feeding_log_dark: "log",
  feeding_history: "log",
  sleep_log: "log",
  sleep_log_dark: "log",
  sleep_pattern: "log",
  diaper_log: "log",
  diaper_log_dark: "log",
  diaper_detail: "log",
  growth_tracker: "log",
  health_records: "log",
  calendar: "calendar",
  weekly_insights: "calendar",
  milestones: "milestones",
  memory_book: "milestones",
  vaccinations: "home",
  assistant: "assistant",
  sleep_prediction: "assistant",
  growth_correlation: "assistant",
  settings: "assistant",
  subscription: "assistant",
  privacy_safety: "assistant",
  family_sharing: "assistant",
  mommy_guide: "assistant",
  add_baby_profile: "assistant",
  baby_profiles: "assistant"
};

export function setupBottomNavigation(currentPath = window.location.pathname) {
  ensureNavigationStyles();
  applyTranslations();
  hoistBottomNavigation();

  const screenId = currentPath.split("/").filter(Boolean)[0] || "home_dashboard";
  const activeKey = activeGroups[screenId] || "home";

  document.querySelectorAll("nav.fixed a, nav.fixed button").forEach((link) => {
    const key = getNavKey(link);
    const route = routes[key] ? screenUrl(routes[key]) : "";

    if (!route) return;

    const labelElement = link.querySelector("span:last-child");
    if (!labelElement) return;

    link.dataset.navKey = key;
    labelElement.dataset.i18n = `navigation.${key}`;
    labelElement.textContent = t(`navigation.${key}`);

    if (link.tagName === "A") {
      link.href = isGuestScreenAllowed(routes[key]) ? route : "#";
      link.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        popNavIcon(link);
        if (!isGuestScreenAllowed(routes[key])) {
          showGuestLocked(routes[key]);
          return;
        }
        navigateWithTransition(route);
      });
    } else {
      link.type = "button";
      link.addEventListener("click", () => {
        popNavIcon(link);
        if (!isGuestScreenAllowed(routes[key])) {
          showGuestLocked(routes[key]);
          return;
        }
        navigateWithTransition(route);
      });
    }
    link.setAttribute("data-nav-item", key);

    normalizeNavItem(link, key, key === activeKey);

    if (key === activeKey) {
      link.setAttribute("aria-current", "page");
      link.classList.add("nav-tab-active");
    } else {
      link.removeAttribute("aria-current");
      link.classList.remove("nav-tab-active");
    }
  });
}

window.addEventListener("littlenest:languagechange", () => {
  setupBottomNavigation(window.location.pathname);
});

function ensureNavigationStyles() {
  if (document.getElementById("bottom-navigation-styles")) return;

  const style = document.createElement("style");
  style.id = "bottom-navigation-styles";
  style.textContent = `
    nav.fixed.bottom-0 {
      position: fixed !important;
      left: max(14px, env(safe-area-inset-left)) !important;
      right: max(14px, env(safe-area-inset-right)) !important;
      bottom: calc(12px + env(safe-area-inset-bottom)) !important;
      width: auto !important;
      max-width: 390px !important;
      min-height: 76px !important;
      margin: 0 auto !important;
      padding: 0.55rem !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-around !important;
      gap: 0.2rem !important;
      border-radius: 9999px !important;
      border: 1px solid var(--ln-nav-border, rgba(124, 92, 255, 0.12)) !important;
      background: var(--ln-nav-surface, rgba(255, 255, 255, 0.74)) !important;
      box-shadow: 0 18px 46px var(--ln-nav-shadow, rgba(124, 92, 255, 0.16)), inset 0 1px 0 rgba(255,255,255,.82) !important;
      backdrop-filter: blur(22px) saturate(1.35) !important;
      -webkit-backdrop-filter: blur(22px) saturate(1.35) !important;
      z-index: 9999 !important;
      backface-visibility: hidden;
      overflow: visible !important;
      isolation: isolate;
      /* Pin to its own compositor layer so iOS keeps it fixed during
         momentum / rubber-band scroll instead of re-rasterizing the
         backdrop-filtered bar (which made it drift up on scroll-down). */
      transform: translateZ(0) !important;
      -webkit-transform: translateZ(0) !important;
      will-change: transform;
      transition: none !important;
    }
    nav.fixed.bottom-0 > a,
    nav.fixed.bottom-0 > button {
      width: clamp(58px, 18vw, 78px) !important;
      height: 58px !important;
      min-width: 0 !important;
      max-width: 78px !important;
      flex: 1 1 0 !important;
      padding: 0.32rem 0.35rem !important;
      border-radius: 9999px !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0 !important;
      line-height: 1 !important;
      background: transparent !important;
      border: 1px solid transparent !important;
    }
    nav.fixed.bottom-0 > a span:last-child,
    nav.fixed.bottom-0 > button span:last-child {
      font-size: 10px !important;
      line-height: 1rem !important;
      white-space: nowrap !important;
    }
    nav.fixed.bottom-0 .material-symbols-outlined {
      font-size: 24px !important;
      line-height: 1 !important;
    }
    nav.fixed .nav-tab-active {
      outline: 0;
      background: rgb(var(--ln-nav-accent-rgb, 112 86 244) / 0.14) !important;
      color: var(--ln-nav-accent, #7056f4) !important;
      border-color: rgb(var(--ln-nav-accent-rgb, 112 86 244) / 0.16) !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 8px 20px rgb(var(--ln-nav-accent-rgb, 112 86 244) / 0.12) !important;
    }
  `;
  document.head.appendChild(style);
}

function mountGlobalSkeleton() {
  if (window.__lnNoSkeleton || document.getElementById("ln-global-skeleton")) return;

  if (!document.getElementById("ln-skeleton-styles")) {
    const style = document.createElement("style");
    style.id = "ln-skeleton-styles";
    style.textContent = `
      #ln-global-skeleton {
        position: fixed; inset: 0; z-index: 9990;
        background: #fbf9f4;
        opacity: 1; transition: opacity .35s ease;
        overflow: hidden;
      }
      :root.dark #ln-global-skeleton {
        background: linear-gradient(180deg, #101a2e 0%, #0d1628 48%, #08101f 100%);
      }
      #ln-global-skeleton.ln-skel-hide { opacity: 0; pointer-events: none; }
      #ln-global-skeleton .ln-skel-wrap {
        max-width: 28rem; margin: 0 auto;
        padding: calc(env(safe-area-inset-top) + 18px) 20px 20px;
        display: flex; flex-direction: column; gap: 16px;
      }
      .ln-skel {
        border-radius: 22px;
        background: linear-gradient(90deg, rgba(239,238,233,.72), rgba(255,255,255,.9), rgba(239,238,233,.72));
        background-size: 200% 100%;
        animation: lnSkelPulse 1.4s ease-in-out infinite;
      }
      :root.dark .ln-skel {
        background: linear-gradient(90deg, rgba(255,255,255,.07), rgba(255,255,255,.14), rgba(255,255,255,.07));
        background-size: 200% 100%;
      }
      .ln-skel-row { display: flex; align-items: center; justify-content: space-between; }
      .ln-skel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      @keyframes lnSkelPulse { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      @media (prefers-reduced-motion: reduce) { .ln-skel { animation: none; } }
    `;
    document.head.appendChild(style);
  }

  const overlay = document.createElement("div");
  overlay.id = "ln-global-skeleton";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="ln-skel-wrap">
      <div class="ln-skel-row">
        <div class="ln-skel" style="height:22px;width:44%;border-radius:10px"></div>
        <div class="ln-skel" style="height:40px;width:40px;border-radius:9999px"></div>
      </div>
      <div class="ln-skel" style="height:104px;width:100%"></div>
      <div class="ln-skel-grid">
        <div class="ln-skel" style="height:104px"></div>
        <div class="ln-skel" style="height:104px"></div>
        <div class="ln-skel" style="height:104px"></div>
        <div class="ln-skel" style="height:104px"></div>
      </div>
      <div class="ln-skel" style="height:18px;width:38%;border-radius:9px"></div>
      <div class="ln-skel" style="height:72px;width:100%"></div>
      <div class="ln-skel" style="height:72px;width:100%"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  let hidden = false;
  const hide = () => {
    if (hidden) return;
    hidden = true;
    overlay.classList.add("ln-skel-hide");
    setTimeout(() => overlay.remove(), 400);
  };
  // Screens can hide it precisely once their content is ready.
  window.addEventListener("littlenest:ready", hide, { once: true });
  // Otherwise hide shortly after the page finishes loading…
  if (document.readyState === "complete") {
    setTimeout(hide, 500);
  } else {
    window.addEventListener("load", () => setTimeout(hide, 450), { once: true });
  }
  // …and a safety net so it can never get stuck.
  setTimeout(hide, 3500);
}

initErrorMonitor();
guardAuthenticatedRoutes();
setupBottomNavigation();
installSharedHeaderStyles();
normalizePageHeaders();
bindHeaderProfileButtons();
setupPendingInviteBar();
setupPullToRefresh();
setupMotionReady();
setupOfflineIndicator();
setupModalNavGuard();
enhanceAccessibility();

// App-wide accessibility net: give icon-only controls an accessible name and
// ensure every <img> has an alt (descriptive from data-alt, else decorative).
// Runs after screen-specific labels so it only fills gaps, never overrides.
const ICON_LABELS = {
  arrow_back: "Back", arrow_back_ios: "Back", chevron_left: "Back", close: "Close",
  add: "Add", add_circle: "Add", more_vert: "More options", more_horiz: "More options",
  edit: "Edit", delete: "Delete", settings: "Settings", search: "Search",
  check: "Confirm", check_circle: "Confirm", done: "Done", share: "Share", ios_share: "Share",
  refresh: "Refresh", chevron_right: "Open", play_arrow: "Play", pause: "Pause",
  mic: "Record", photo_camera: "Take photo", videocam: "Record video",
  visibility: "Show", visibility_off: "Hide", favorite: "Favourite", close_fullscreen: "Close"
};
function humanizeIcon(s) {
  const key = String(s).trim();
  return ICON_LABELS[key] || key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function enhanceAccessibility(root = document) {
  try {
    root.querySelectorAll("button, a[role='button'], [role='button']").forEach((el) => {
      if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title")) return;
      const icon = el.querySelector(".material-symbols-outlined");
      if (!icon) return;
      const ligature = (icon.dataset.icon || icon.textContent || "").trim();
      if (!ligature) return;
      const visibleText = (el.textContent || "").replace(ligature, "").trim();
      if (visibleText) return; // already has a real text label
      el.setAttribute("aria-label", humanizeIcon(ligature));
    });
    root.querySelectorAll("img:not([alt]), img[alt='']").forEach((img) => {
      const desc = img.getAttribute("data-alt");
      img.setAttribute("alt", desc ? desc.slice(0, 140) : "");
    });
  } catch {
    // Accessibility enhancement is best-effort; never block the page.
  }
}

// Auth session caches asynchronously; once ready, re-render header avatars so
// the uploaded profile photo (stored under the user-scoped key) is shown.
getAuthSession()
  .catch(() => null)
  .then(() => {
    document.querySelectorAll("header").forEach((header) => {
      const target = header.querySelector("[data-profile-nav-bound='true']");
      if (target) refreshHeaderProfileAvatar(target);
    });
  });

function getNavKey(link) {
  if (link.dataset.navKey) return link.dataset.navKey;
  const iconText = (link.querySelector(".material-symbols-outlined")?.dataset.icon
    || link.querySelector(".material-symbols-outlined")?.textContent
    || "").trim();
  const iconMap = {
    home: "home",
    add: "log",
    add_circle: "log",
    calendar_month: "calendar",
    event: "calendar",
    auto_awesome: "milestones",
    stars: "milestones",
    smart_toy: "assistant",
    psychology: "assistant"
  };
  if (iconMap[iconText]) return iconMap[iconText];
  const labelElement = link.querySelector("span:last-child");
  const label = (labelElement?.textContent || link.textContent).trim().toLowerCase();
  const language = getLanguage();
  return Object.keys(routes).find((key) => label === t(`navigation.${key}`, language).toLowerCase())
    || Object.keys(routes).find((key) => label === t(`navigation.${key}`, "en").toLowerCase())
    || "";
}

function normalizeNavItem(item, key, isActive) {
  const nav = item.closest("nav.fixed");
  if (nav) {
    if (nav.parentElement !== document.body) document.body.appendChild(nav);
    nav.className = "fixed bottom-0 z-50 flex justify-around items-center";
    nav.style.position = "fixed";
    nav.style.left = "max(14px, env(safe-area-inset-left))";
    nav.style.right = "max(14px, env(safe-area-inset-right))";
    nav.style.bottom = "calc(12px + env(safe-area-inset-bottom))";
    nav.style.width = "auto";
    nav.style.maxWidth = "390px";
    nav.style.minHeight = "76px";
    nav.style.margin = "0 auto";
    nav.style.zIndex = "9999";
  }

  item.className = [
    "flex flex-col items-center justify-center rounded-full transition-[transform,background-color,color] active:scale-90 duration-150 ease-out",
    "h-[58px] px-2 py-1 min-w-0",
    isActive
      ? "bg-primary-container text-on-primary-container"
      : "text-on-secondary-fixed-variant hover:bg-secondary-container"
  ].join(" ");
  item.style.width = "clamp(58px, 18vw, 78px)";
  item.style.height = "58px";
  item.style.minWidth = "0";
  item.style.maxWidth = "78px";
  item.style.flex = "1 1 0";
  item.style.borderRadius = "9999px";
  item.style.order = ({ home: 1, calendar: 2, log: 3, milestones: 4, assistant: 5 }[key] || 9);

  if (key === "log") {
    item.className = "flex flex-col items-center justify-center rounded-full transition-[transform,background-color,color] active:scale-90 duration-150 ease-out text-white";
    item.style.flex = "0 0 64px";
    item.style.width = "64px";
    item.style.maxWidth = "64px";
    item.style.height = "64px";
    item.style.marginTop = "-28px";
    item.style.background = "linear-gradient(145deg, var(--ln-nav-accent-2, #9b7cff), var(--ln-nav-accent, #7056f4))";
    item.style.boxShadow = "0 16px 32px rgb(var(--ln-nav-accent-rgb, 112 86 244) / 0.34)";
  }

  const icon = item.querySelector(".material-symbols-outlined");
  if (icon) {
    icon.classList.add("text-[24px]");
    icon.style.fontVariationSettings = isActive ? "'FILL' 1" : "'FILL' 0";
    if (key === "log") {
      icon.textContent = "add";
      icon.style.fontSize = "32px";
      icon.style.fontVariationSettings = "'FILL' 1";
    }
  }

  const label = item.querySelector("span:last-child");
  if (label) {
    label.className = "font-label-sm text-[10px] leading-4 whitespace-nowrap";
    if (key === "log") label.classList.add("hidden");
    // Centralize the Appointment label so every screen's bottom nav matches,
    // regardless of the per-screen hardcoded text ("Calendar").
    if (key === "calendar") label.textContent = t("navigation.calendar", getLanguage());
  }
}

async function guardAuthenticatedRoutes() {
  const screenId = getCurrentScreenId();
  const publicScreens = ["auth_welcome", "login", "signup", "accept_invite", "set_password", "verify_pending", "privacy_policy", "terms"];
  if (publicScreens.includes(screenId)) return;

  // Guests stay local-only and are always allowed into the app shell.
  if (isGuestMode()) {
    if (!isGuestScreenAllowed(screenId)) {
      rememberGuestLockNotice(screenId);
      window.location.replace(screenUrl(getGuestFallbackScreen()));
    } else {
      queueGuestLockNotice();
    }
    return;
  }

  const redirect = (screen) => window.location.replace(screenUrl(screen));

  const session = await getAuthSession();
  if (!session) { redirect("auth_welcome"); return; }
  // Logged-in but unverified email → hold at the verification screen.
  if (!isEmailVerified(session.user)) { redirect("verify_pending"); return; }

  // Admin accounts may use multiple devices at once — skip single-device kick.
  if (isAdminEmail(session.user?.email)) return;

  // Single active device: if another phone has logged into this account, this
  // session was superseded — sign out and send to login with a notice.
  const userId = session.user?.id;
  const status = await verifyDeviceSession(userId);
  if (status === "superseded") {
    await kickToLogin();
    return;
  }
  // While the app is open, kick instantly if another device takes over.
  watchDeviceSession(userId, () => { kickToLogin(); });
}

function queueGuestLockNotice() {
  const notice = takeGuestLockNotice();
  if (!notice) return;
  window.setTimeout(() => showGuestLocked(notice.screenId || ""), 250);
}

async function kickToLogin() {
  markKickedFlag();
  await logoutLocalUser().catch(() => {});
  window.location.replace(screenUrl("login"));
}

async function setupPendingInviteBar() {
  const screenId = getCurrentScreenId();
  if (["auth_welcome", "login", "signup", "accept_invite", "set_password"].includes(screenId)) return;
  if (isGuestMode() || !(await isLoggedIn())) return;

  try {
    const { invitations = [] } = await loadPendingFamilyInvitesRemote();
    const invite = invitations[0];
    if (!invite) return;
    renderPendingInviteBar(invite);
  } catch (error) {
    console.warn("Could not load pending family invites.", error);
  }
}

function renderPendingInviteBar(invite) {
  if (document.getElementById("pendingFamilyInviteBar")) return;
  const bar = document.createElement("div");
  bar.id = "pendingFamilyInviteBar";
  bar.className = "fixed left-4 right-4 top-[64px] z-[9998] mx-auto max-w-md rounded-2xl border p-3 soft-shadow";
  bar.style.background = "rgba(18, 27, 45, 0.94)";
  bar.style.borderColor = "rgba(34, 211, 238, 0.26)";
  bar.style.color = "#eef6ff";
  bar.innerHTML = `
    <div class="flex items-start gap-3">
      <span class="material-symbols-outlined text-primary mt-0.5">mail</span>
      <div class="min-w-0 flex-1">
        <p class="font-label-md text-label-md">Baby invitation</p>
        <p class="font-body-md text-body-md text-on-surface-variant">Join ${escapeHtml(invite.babyName)} as ${escapeHtml(invite.role)}.</p>
        <p class="hidden mt-1 font-label-sm text-label-sm" data-invite-status></p>
      </div>
      <div class="flex gap-2">
        <button class="h-9 px-3 rounded-full bg-primary text-on-primary font-label-sm text-label-sm" type="button" data-accept-invite>Accept</button>
        <button class="h-9 px-3 rounded-full border border-white/20 font-label-sm text-label-sm" type="button" data-decline-invite>Decline</button>
      </div>
    </div>
  `;
  document.body.appendChild(bar);

  const status = bar.querySelector("[data-invite-status]");
  bar.querySelector("[data-accept-invite]")?.addEventListener("click", async () => {
    status.textContent = "Accepting invite...";
    status.classList.remove("hidden");
    try {
      await acceptFamilyInviteRemote(invite.token);
      status.textContent = "Invite accepted.";
      setTimeout(() => window.location.replace(screenUrl("baby_profiles")), 450);
    } catch (error) {
      status.textContent = error.message || "Could not accept invite.";
    }
  });
  bar.querySelector("[data-decline-invite]")?.addEventListener("click", async () => {
    status.textContent = "Declining invite...";
    status.classList.remove("hidden");
    try {
      await declineFamilyInviteRemote(invite.id);
      bar.remove();
    } catch (error) {
      status.textContent = error.message || "Could not decline invite.";
    }
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizePageHeaders(root = document) {
  const screenId = getCurrentScreenId();
  if (["auth_welcome", "login", "signup", "accept_invite", "set_password"].includes(screenId)) return;

  root.querySelectorAll("header").forEach((header) => {
    header.className = "ln-app-header sticky z-40 flex justify-between items-center px-3 h-14";
    header.style.position = "sticky";
    header.style.top = "max(10px, env(safe-area-inset-top))";
    header.style.height = "56px";
    header.style.minHeight = "56px";
    header.style.width = "calc(100% - 28px)";
    header.style.maxWidth = "448px";
    header.style.margin = "10px auto 0";

    const title = header.querySelector("h1");
    if (title) {
      title.className = "ln-app-header-title font-headline-lg-mobile text-headline-lg-mobile text-primary truncate";
      title.dataset.appHeaderTitle = "true";
    }

    const backButton = findHeaderBackButton(header);
    if (backButton && title && backButton.parentElement === header) {
      const group = document.createElement("div");
      group.className = "flex items-center gap-2 min-w-0";
      header.insertBefore(group, backButton);
      group.appendChild(backButton);
      group.appendChild(title);
    } else if (backButton?.parentElement) {
      backButton.parentElement.className = "flex items-center gap-2 min-w-0";
    }

    if (backButton) {
      ensureBackButtonIcon(backButton);
      backButton.className = "ln-header-action w-10 h-10 flex items-center justify-center rounded-full transition-colors active:scale-95 text-primary shrink-0";
      backButton.querySelector(".material-symbols-outlined")?.classList.add("text-primary");
      backButton.setAttribute("aria-label", "Back");
      backButton.dataset.headerBackHomeBound = "true";
      backButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        goBackOrTo(backButton.getAttribute("data-back-to") || defaultBackTargetForScreen(screenId));
      }, true);
    }
  });
}

function defaultBackTargetForScreen(screenId) {
  const defaults = {
    mama_care: "home_dashboard",
    breast_pumping: "mama_care",
    feeding_log: "quick_log",
    feeding_history: "quick_log",
    sleep_log: "quick_log",
    sleep_pattern: "sleep_log",
    diaper_log: "quick_log",
    diaper_detail: "diaper_log",
    health_records: "quick_log",
    daily_summary: "home_dashboard",
    weekly_insights: "daily_summary",
    calendar: "home_dashboard",
    growth_tracker: "home_dashboard",
    doctor_report: "growth_tracker",
    sleep_prediction: "assistant",
    growth_correlation: "assistant",
    milestones: "home_dashboard",
    memory_book: "milestones",
    vaccinations: "home_dashboard",
    assistant: "home_dashboard",
    settings: "home_dashboard",
    subscription: "settings",
    privacy_safety: "settings",
    family_sharing: "settings",
    mommy_guide: "settings",
    baby_profiles: "settings",
    add_baby_profile: "baby_profiles"
  };
  return defaults[screenId] || "home_dashboard";
}

function ensureBackButtonIcon(backButton) {
  if (backButton.querySelector(".material-symbols-outlined")) return;
  if (!/arrow_back/i.test(backButton.textContent || "")) return;
  backButton.innerHTML = '<span class="material-symbols-outlined text-primary">arrow_back</span>';
}

function findHeaderBackButton(header) {
  return [...header.querySelectorAll("button")].find((button) => {
    const text = button.textContent || "";
    const label = button.getAttribute("aria-label") || "";
    return /arrow_back|back/i.test(text) || /back/i.test(label);
  }) || null;
}

function bindHeaderProfileButtons(root = document) {
  root.querySelectorAll("header").forEach((header) => {
    const target = findOrCreateHeaderProfileTarget(header);
    if (!target || target.dataset.profileNavBound === "true") return;
    target.dataset.profileNavBound = "true";
    target.setAttribute("role", target.tagName === "BUTTON" ? "button" : "button");
    target.setAttribute("tabindex", target.getAttribute("tabindex") || "0");
    target.setAttribute("aria-label", target.getAttribute("aria-label") || "Open settings");
    target.className = "ln-header-action w-10 h-10 rounded-full overflow-hidden flex items-center justify-center active:scale-95 transition-transform cursor-pointer shrink-0";
    if (target.dataset.createdHeaderProfile === "true") target.classList.add("ml-auto");
    const image = ensureHeaderProfileImage(target);
    image.className = "w-full h-full object-cover";
    renderHeaderProfileAvatar(target, image);
    target.addEventListener("click", () => {
      if (!isGuestScreenAllowed("settings")) {
        showGuestLocked("settings");
        return;
      }
      navigateWithTransition(window.location.protocol === "file:" ? "../settings/code.html" : "/settings");
    });
    target.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!isGuestScreenAllowed("settings")) {
          showGuestLocked("settings");
          return;
        }
        navigateWithTransition(window.location.protocol === "file:" ? "../settings/code.html" : "/settings");
      }
    });
  });
}

function hoistBottomNavigation() {
  document.querySelectorAll("nav.fixed.bottom-0").forEach((nav) => {
    if (nav.parentElement !== document.body) {
      document.body.appendChild(nav);
    }
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

// Any full-screen overlay (modals, sheets, photo crop, coming-soon popups)
// should hide the bottom nav so its action buttons are never blocked. Instead
// of wiring every modal by hand, watch the DOM for visible `.fixed.inset-0`
// overlays and toggle `ln-modal-open` accordingly. Handles nesting for free.
function setupModalNavGuard() {
  if (window.__littleNestModalGuard) return;
  window.__littleNestModalGuard = true;

  const isVisibleOverlay = (el) => {
    if (el.id === "littleNestOfflineBar" || el.id === "prototypeUndoToast") return false;
    if (el.classList.contains("hidden")) return false;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false;
    return true;
  };
  const anyOverlay = () => [...document.querySelectorAll(".fixed.inset-0")].some(isVisibleOverlay);

  let scheduled = 0;
  const update = () => {
    scheduled = 0;
    document.body.classList.toggle("ln-modal-open", anyOverlay());
  };
  const schedule = () => { if (!scheduled) scheduled = requestAnimationFrame(update); };

  new MutationObserver(schedule).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden"]
  });
  schedule();
}

function setupOfflineIndicator() {
  if (window.__littleNestOfflineBound) return;
  window.__littleNestOfflineBound = true;
  const isNativeCapacitor = Boolean(window.LittleNestCompat?.isNativeCapacitor?.());
  if (isNativeCapacitor) return;

  const bar = document.createElement("div");
  bar.id = "littleNestOfflineBar";
  bar.setAttribute("role", "status");
  bar.style.cssText = [
    "position:fixed",
    "left:50%",
    "top:max(10px, env(safe-area-inset-top))",
    "transform:translate(-50%,-160%)",
    "z-index:10001",
    "display:flex",
    "align-items:center",
    "gap:8px",
    "max-width:calc(100% - 28px)",
    "padding:8px 14px",
    "border-radius:9999px",
    "background:rgba(40,30,28,.92)",
    "color:#fff",
    "font:700 12px/1 'Nunito Sans',sans-serif",
    "box-shadow:0 10px 30px rgba(0,0,0,.28)",
    "backdrop-filter:blur(8px)",
    "transition:transform 240ms cubic-bezier(0.16,1,0.3,1)",
    "pointer-events:none"
  ].join(";");
  bar.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px">cloud_off</span><span>Offline — changes saved on this device</span>`;
  document.body.appendChild(bar);

  const apply = (event) => {
    const shouldShow = !navigator.onLine;
    bar.style.transform = shouldShow ? "translate(-50%,0)" : "translate(-50%,-160%)";
  };
  window.addEventListener("online", apply);
  window.addEventListener("offline", apply);
  apply();
}

function setupMotionReady() {
  if (document.documentElement.classList.contains("ln-motion-ready")) return;
  requestAnimationFrame(() => {
    document.documentElement.classList.add("ln-motion-ready");
  });
}

function navigateWithTransition(url) {
  if (!url || isSameLocation(url)) return;
  const targetScreenId = screenIdFromUrl(url);
  if (targetScreenId && !isGuestScreenAllowed(targetScreenId)) {
    showGuestLocked(targetScreenId);
    return;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.location.href = url;
    return;
  }
  document.documentElement.classList.add("ln-page-exit");
  window.setTimeout(() => {
    window.location.href = url;
  }, 170);
}

function screenIdFromUrl(url) {
  try {
    const next = new URL(url, window.location.href);
    const fileMatch = next.pathname.replaceAll("\\", "/").match(/\/src\/screens\/([^/]+)\/code\.html$/);
    if (fileMatch) return fileMatch[1];
    return next.pathname.split("/").filter(Boolean)[0] || "";
  } catch {
    return "";
  }
}

// Quick squash-and-pop on the tapped nav icon for tactile feedback.
function popNavIcon(link) {
  const icon = link?.querySelector(".material-symbols-outlined");
  if (!icon) return;
  icon.classList.remove("ln-nav-pop");
  void icon.offsetWidth; // restart the animation if tapped again
  icon.classList.add("ln-nav-pop");
  setTimeout(() => icon.classList.remove("ln-nav-pop"), 420);
}

function isSameLocation(url) {
  try {
    const next = new URL(url, window.location.href);
    return next.href === window.location.href;
  } catch {
    return false;
  }
}

function installSharedHeaderStyles() {
  if (document.getElementById("littleNestSharedHeaderStyles")) return;
  const style = document.createElement("style");
  style.id = "littleNestSharedHeaderStyles";
  style.textContent = `
    .ln-app-header {
      position: sticky !important;
      border-radius: 999px !important;
      border: 1px solid rgba(255,255,255,.82) !important;
      background:
        linear-gradient(145deg, rgba(255,255,255,.82), rgba(255,246,239,.68)) !important;
      box-shadow: 0 18px 54px rgba(92,58,44,.12), inset 0 1px 0 rgba(255,255,255,.92) !important;
      backdrop-filter: blur(20px) saturate(1.18);
      -webkit-backdrop-filter: blur(20px) saturate(1.18);
      overflow: hidden;
      isolation: isolate;
    }
    .ln-app-header::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      background:
        radial-gradient(120px 70px at 18% 0%, rgba(255,191,163,.18), transparent 70%),
        radial-gradient(130px 80px at 88% 0%, rgba(207,230,201,.18), transparent 72%);
    }
    .ln-app-header > * {
      z-index: 2;
    }
    .ln-app-header-title {
      position: absolute !important;
      left: 62px !important;
      right: 62px !important;
      top: calc(50% + 1px) !important;
      z-index: 4 !important;
      transform: translateY(-50%) !important;
      width: auto !important;
      max-width: none !important;
      margin: 0 !important;
      text-align: center !important;
      pointer-events: none !important;
      color: var(--ln-primary, #83533c) !important;
      letter-spacing: 0 !important;
      font-family: "Plus Jakarta Sans", "Nunito Sans", sans-serif !important;
      font-size: 1.18rem !important;
      line-height: 1.28 !important;
      font-weight: 800 !important;
    }
    .ln-header-action {
      position: relative;
      z-index: 3;
      background: rgba(255,255,255,.68) !important;
      border: 1px solid rgba(255,255,255,.78) !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.86), 0 10px 28px rgba(131,83,60,.12) !important;
      color: var(--ln-primary, #83533c) !important;
    }
    @media (hover:hover) and (pointer:fine) {
      .ln-header-action:hover { transform: translateY(-1px); }
    }
    .ln-header-action:active { transform: scale(.96); }
    html.dark .ln-app-header {
      background: linear-gradient(145deg, rgba(23,32,50,.88), rgba(12,20,36,.80)) !important;
      border-color: rgba(255,255,255,.12) !important;
      box-shadow: 0 18px 48px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.10) !important;
    }
    html.dark .ln-app-header::before {
      background:
        radial-gradient(130px 82px at 18% 0%, rgba(34,211,238,.14), transparent 72%),
        radial-gradient(130px 82px at 88% 0%, rgba(124,92,255,.14), transparent 72%);
    }
    html.dark .ln-header-action {
      background: rgba(255,255,255,.08) !important;
      border-color: rgba(255,255,255,.12) !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.10), 0 10px 28px rgba(0,0,0,.20) !important;
    }
  `;
  document.head.appendChild(style);
}

function findOrCreateHeaderProfileTarget(header) {
  const explicit = header.querySelector('[data-screen-target="settings"]');
  if (explicit) return explicit;

  const imageTargets = [...header.querySelectorAll("img")]
    .map((image) => image.closest("button") || image.parentElement)
    .filter((target) => target && target.closest("header") === header);
  const roundedTarget = imageTargets.find((target) => /rounded-full|overflow-hidden/.test(target.className || ""));
  if (roundedTarget) return roundedTarget;

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.createdHeaderProfile = "true";
  button.setAttribute("aria-label", "Open settings");
  header.appendChild(button);
  return button;
}

function ensureHeaderProfileImage(target) {
  target.querySelectorAll(".material-symbols-outlined").forEach((icon) => icon.remove());
  let image = target.querySelector("img");
  if (!image) {
    image = document.createElement("img");
    target.prepend(image);
  }
  return image;
}

function refreshHeaderProfileAvatar(target) {
  if (!target) return;
  const image = ensureHeaderProfileImage(target);
  image.className = "w-full h-full object-cover";
  renderHeaderProfileAvatar(target, image);
}

function renderHeaderProfileAvatar(target, image) {
  const profile = getParentProfile();
  // Reuse any existing initials span (e.g. #homeParentInitials) so we don't
  // render a duplicate letter next to the photo.
  let initials = target.querySelector("[data-header-profile-initials]") || target.querySelector("span");
  if (!initials) {
    initials = document.createElement("span");
    initials.className = "font-headline-md text-headline-md text-primary";
    target.appendChild(initials);
  }
  initials.dataset.headerProfileInitials = "true";

  initials.textContent = initialsForName(profile.name);
  if (profile.photoUrl) {
    image.src = profile.photoUrl;
    image.alt = "Parent profile";
    image.classList.remove("hidden");
    initials.classList.add("hidden");
  } else {
    image.removeAttribute("src");
    image.classList.add("hidden");
    initials.classList.remove("hidden");
  }
}

function setupPullToRefresh() {
  if (window.__littleNestPullToRefreshBound) return;

  window.__littleNestPullToRefreshBound = true;

  let startY = 0;
  let startX = 0;
  let pullDistance = 0;
  let isPulling = false;
  let isRefreshing = false;
  let activePointerId = null;
  const threshold = 72;
  const indicator = createPullRefreshIndicator();

  const beginPull = (event, point) => {
    if (isRefreshing || getScrollTop() > 0 || isInteractiveTarget(event.target)) return;
    activePointerId = event.pointerId ?? null;
    startY = point.clientY;
    startX = point.clientX;
    pullDistance = 0;
    isPulling = true;
  };

  const movePull = (event, point) => {
    if (!isPulling || isRefreshing) return;
    if (activePointerId !== null && event.pointerId !== undefined && event.pointerId !== activePointerId) return;
    const deltaY = point.clientY - startY;
    const deltaX = Math.abs(point.clientX - startX);
    if (deltaX > 40 || deltaY <= 0 || getScrollTop() > 0) {
      resetPullIndicator(indicator);
      isPulling = false;
      activePointerId = null;
      return;
    }

    event.preventDefault();
    pullDistance = Math.min(120, deltaY * 0.55);
    updatePullIndicator(indicator, pullDistance, pullDistance >= threshold);
  };

  const endPull = () => {
    if (!isPulling || isRefreshing) return;
    isPulling = false;
    activePointerId = null;
    if (pullDistance >= threshold) {
      isRefreshing = true;
      indicator.textContent = "Refreshing...";
      indicator.style.transform = "translate(-50%, 24px)";
      indicator.classList.add("ptr-spinning");
      setTimeout(() => window.location.reload(), 200);
      return;
    }
    resetPullIndicator(indicator);
  };

  window.addEventListener("touchstart", (event) => beginPull(event, event.touches[0]), { passive: true });
  window.addEventListener("touchmove", (event) => movePull(event, event.touches[0]), { passive: false });
  window.addEventListener("touchend", endPull, { passive: true });
  window.addEventListener("touchcancel", endPull, { passive: true });

  window.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") return;
    if (event.button !== undefined && event.button !== 0) return;
    beginPull(event, event);
  }, { passive: true });
  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    movePull(event, event);
  }, { passive: false });
  window.addEventListener("pointerup", endPull, { passive: true });
  window.addEventListener("pointercancel", endPull, { passive: true });
}

function createPullRefreshIndicator() {
  const existing = document.getElementById("littleNestPullRefresh");
  if (existing) return existing;
  const indicator = document.createElement("div");
  indicator.id = "littleNestPullRefresh";
  indicator.setAttribute("aria-hidden", "true");
  indicator.style.cssText = [
    "position:fixed",
    "left:50%",
    "top:calc(62px + env(safe-area-inset-top))",
    "z-index:10000",
    "transform:translate(-50%,-56px)",
    "height:40px",
    "padding:0 16px",
    "border-radius:9999px",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "gap:8px",
    "background:var(--color-surface-container,#efeee9)",
    "color:var(--color-primary,#83533c)",
    "box-shadow:0 2px 12px rgba(131,83,60,.12)",
    "font:700 12px/1 'Nunito Sans',sans-serif",
    "pointer-events:none",
    "transition:transform 160ms ease,opacity 160ms ease",
    "opacity:0"
  ].join(";");
  document.body.appendChild(indicator);
  return indicator;
}

function getScrollTop() {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

function updatePullIndicator(indicator, distance, ready) {
  indicator.textContent = ready ? "Release to refresh" : "Pull to refresh";
  indicator.style.opacity = String(Math.min(1, distance / 40));
  indicator.style.transform = `translate(-50%, ${Math.max(-52, distance - 56)}px)`;
}

function resetPullIndicator(indicator) {
  indicator.style.opacity = "0";
  indicator.style.transform = "translate(-50%,-56px)";
}

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.("input, textarea, select, button, a, [role='button'], [contenteditable='true']"));
}

function getCurrentScreenId() {
  const path = window.location.pathname.replaceAll("\\", "/");
  const fileMatch = path.match(/\/src\/screens\/([^/]+)\/code\.html$/);
  if (fileMatch) return fileMatch[1];
  return path.split("/").filter(Boolean)[0] || "auth_welcome";
}
