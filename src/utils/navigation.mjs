import { applyTranslations, getLanguage, t } from "./i18n.mjs";
import { getAuthSession, isEmailVerified, isGuestMode, isLoggedIn, logoutLocalUser } from "./localAuth.mjs";
import { markKickedFlag, verifyDeviceSession, watchDeviceSession } from "./deviceSession.mjs";
import { getParentProfile, initialsForName } from "./profile.mjs";
import { acceptFamilyInviteRemote, declineFamilyInviteRemote, loadPendingFamilyInvitesRemote } from "./familyInvitesRemote.mjs";

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
  return window.location.protocol === "file:" ? `../${screenId}/code.html` : `/${screenId}/`;
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
      link.href = route;
      link.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigateWithTransition(route);
      });
    } else {
      link.type = "button";
      link.addEventListener("click", () => {
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
      border: 1px solid rgba(124, 92, 255, 0.12) !important;
      background: rgba(255, 255, 255, 0.74) !important;
      box-shadow: 0 18px 46px rgba(124, 92, 255, 0.16), inset 0 1px 0 rgba(255,255,255,.82) !important;
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
      background: rgba(124, 92, 255, 0.14) !important;
      border-color: rgba(124, 92, 255, 0.12) !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 8px 20px rgba(124,92,255,.12) !important;
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

guardAuthenticatedRoutes();
setupBottomNavigation();
normalizePageHeaders();
bindHeaderProfileButtons();
setupPendingInviteBar();
setupMotionReady();
setupOfflineIndicator();
setupModalNavGuard();

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
    "flex flex-col items-center justify-center rounded-full transition-all active:scale-90 duration-150",
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
    item.className = "flex flex-col items-center justify-center rounded-full transition-all active:scale-90 duration-150 text-white";
    item.style.flex = "0 0 64px";
    item.style.width = "64px";
    item.style.maxWidth = "64px";
    item.style.height = "64px";
    item.style.marginTop = "-28px";
    item.style.background = "linear-gradient(145deg, #9b7cff, #7056f4)";
    item.style.boxShadow = "0 16px 32px rgba(124, 92, 255, 0.34)";
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
  if (isGuestMode()) return;

  const redirect = (screen) => window.location.replace(screenUrl(screen));

  const session = await getAuthSession();
  if (!session) { redirect("auth_welcome"); return; }
  // Logged-in but unverified email → hold at the verification screen.
  if (!isEmailVerified(session.user)) { redirect("verify_pending"); return; }

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
    header.className = "sticky top-0 z-40 bg-surface/95 backdrop-blur-md px-container-padding h-14 flex justify-between items-center w-full";
    header.style.position = "sticky";
    header.style.top = "0";
    header.style.height = "56px";
    header.style.minHeight = "56px";

    const title = header.querySelector("h1");
    if (title) {
      title.className = "font-headline-lg-mobile text-headline-lg-mobile text-primary truncate";
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
      backButton.className = "w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors active:scale-95 text-primary shrink-0";
      backButton.querySelector(".material-symbols-outlined")?.classList.add("text-primary");
      backButton.setAttribute("aria-label", "Back to home");
      backButton.dataset.headerBackHomeBound = "true";
      backButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        navigateWithTransition(window.location.protocol === "file:" ? "../home_dashboard/code.html" : "/home_dashboard/");
      }, true);
    }
  });
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
    ensureHeaderRefreshButton(header);
    const target = findOrCreateHeaderProfileTarget(header);
    if (!target || target.dataset.profileNavBound === "true") return;
    target.dataset.profileNavBound = "true";
    target.setAttribute("role", target.tagName === "BUTTON" ? "button" : "button");
    target.setAttribute("tabindex", target.getAttribute("tabindex") || "0");
    target.setAttribute("aria-label", target.getAttribute("aria-label") || "Open settings");
    target.className = "w-8 h-8 rounded-full bg-secondary-container overflow-hidden flex items-center justify-center active:scale-95 transition-transform cursor-pointer border-2 border-primary-container shrink-0";
    if (target.dataset.createdHeaderProfile === "true") target.classList.add("ml-auto");
    const image = ensureHeaderProfileImage(target);
    image.className = "w-full h-full object-cover";
    renderHeaderProfileAvatar(target, image);
    target.addEventListener("click", () => {
      navigateWithTransition(window.location.protocol === "file:" ? "../settings/code.html" : "/settings/");
    });
    target.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        navigateWithTransition(window.location.protocol === "file:" ? "../settings/code.html" : "/settings/");
      }
    });
  });
}

function ensureHeaderRefreshButton(header) {
  if (!header || header.querySelector("[data-header-refresh]")) return;
  const profileTarget = findOrCreateHeaderProfileTarget(header);
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.headerRefresh = "true";
  button.setAttribute("aria-label", "Refresh page");
  // Soft, ghosted refresh that blends into the airy header — secondary to the
  // profile button. Spins on tap for feedback, then reloads.
  button.className = "w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant/70 hover:text-primary hover:bg-black/[0.04] dark:hover:bg-white/10 active:scale-90 transition-all shrink-0";
  button.innerHTML = '<span class="material-symbols-outlined text-[20px]">refresh</span>';
  button.addEventListener("click", () => {
    if (button.dataset.refreshing === "true") return;
    button.dataset.refreshing = "true";
    button.querySelector(".material-symbols-outlined")?.classList.add("animate-spin");
    button.classList.add("text-primary");
    setTimeout(() => window.location.reload(), 360);
  });
  // Keep refresh snug next to the profile on the right, instead of letting the
  // header's justify-between fling it into the middle.
  if (profileTarget?.parentElement === header) {
    let group = header.querySelector("[data-header-right-group]");
    if (!group) {
      group = document.createElement("div");
      group.dataset.headerRightGroup = "true";
      group.className = "flex items-center gap-1.5 shrink-0";
      header.insertBefore(group, profileTarget);
      group.appendChild(profileTarget);
    }
    group.insertBefore(button, group.firstChild);
  } else {
    header.appendChild(button);
  }
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
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.location.href = url;
    return;
  }
  document.documentElement.classList.add("ln-page-exit");
  window.setTimeout(() => {
    window.location.href = url;
  }, 120);
}

function isSameLocation(url) {
  try {
    const next = new URL(url, window.location.href);
    return next.href === window.location.href;
  } catch {
    return false;
  }
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

function getCurrentScreenId() {
  const path = window.location.pathname.replaceAll("\\", "/");
  const fileMatch = path.match(/\/src\/screens\/([^/]+)\/code\.html$/);
  if (fileMatch) return fileMatch[1];
  return path.split("/").filter(Boolean)[0] || "auth_welcome";
}
