import { applyTranslations, getLanguage, t } from "./i18n.mjs";
import { isLoggedIn } from "./localAuth.mjs";
import { getParentProfile, initialsForName } from "./profile.mjs";

const routes = {
  home: "/home_dashboard/",
  log: "/quick_log/",
  calendar: "/calendar/",
  milestones: "/milestones/",
  assistant: "/assistant/"
};

const activeGroups = {
  home_dashboard: "home",
  home_dashboard_dark: "home",
  mama_care: "home",
  daily_summary: "home",
  quick_log: "log",
  quick_log_dark: "log",
  feeding_log: "log",
  feeding_log_dark: "log",
  sleep_log: "log",
  sleep_log_dark: "log",
  diaper_log: "log",
  diaper_log_dark: "log",
  growth_tracker: "log",
  health_records: "log",
  calendar: "calendar",
  weekly_insights: "calendar",
  milestones: "milestones",
  memory_book: "milestones",
  assistant: "assistant",
  settings: "assistant",
  privacy_safety: "assistant",
  family_sharing: "assistant",
  mommy_guide: "assistant",
  add_baby_profile: "assistant",
  baby_profiles: "assistant"
};

export function setupBottomNavigation(currentPath = window.location.pathname) {
  ensureNavigationStyles();
  applyTranslations();

  const screenId = currentPath.split("/").filter(Boolean)[0] || "home_dashboard";
  const activeKey = activeGroups[screenId] || "home";

  document.querySelectorAll("nav.fixed a, nav.fixed button").forEach((link) => {
    const key = getNavKey(link);
    const route = routes[key];

    if (!route) return;

    const labelElement = link.querySelector("span:last-child");
    if (!labelElement) return;

    link.dataset.navKey = key;
    labelElement.dataset.i18n = `navigation.${key}`;
    labelElement.textContent = t(`navigation.${key}`);

    if (link.tagName === "A") {
      link.href = route;
    } else {
      link.type = "button";
      link.addEventListener("click", () => {
        window.location.href = route;
      });
    }
    link.setAttribute("data-nav-item", key);

    normalizeNavItem(link, key === activeKey);

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
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100% !important;
      min-height: calc(4.75rem + env(safe-area-inset-bottom)) !important;
      padding: 0.5rem 0.5rem max(1rem, env(safe-area-inset-bottom)) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-around !important;
      gap: 0.125rem !important;
      border-top-left-radius: 0.75rem !important;
      border-top-right-radius: 0.75rem !important;
      z-index: 80 !important;
      transform: translateZ(0);
      -webkit-transform: translateZ(0);
      backface-visibility: hidden;
    }
    nav.fixed.bottom-0 > a,
    nav.fixed.bottom-0 > button {
      width: 68px !important;
      height: 52px !important;
      min-width: 68px !important;
      max-width: 68px !important;
      flex: 0 0 68px !important;
      padding: 0.25rem 0.5rem !important;
      border-radius: 9999px !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0 !important;
      line-height: 1 !important;
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
      outline: 2px solid rgba(131, 83, 60, 0.24);
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
}

guardAuthenticatedRoutes();
setupBottomNavigation();
normalizePageHeaders();
bindHeaderProfileButtons();

function getNavKey(link) {
  if (link.dataset.navKey) return link.dataset.navKey;
  const labelElement = link.querySelector("span:last-child");
  const label = (labelElement?.textContent || link.textContent).trim().toLowerCase();
  const language = getLanguage();
  return Object.keys(routes).find((key) => label === t(`navigation.${key}`, language).toLowerCase())
    || Object.keys(routes).find((key) => label === t(`navigation.${key}`, "en").toLowerCase())
    || "";
}

function normalizeNavItem(item, isActive) {
  const nav = item.closest("nav.fixed");
  if (nav) {
    nav.className = "fixed bottom-0 left-0 w-full z-50 bg-surface-container-highest shadow-[0_-4px_12px_rgba(255,191,163,0.15)] rounded-t-xl px-2 pb-4 pt-2 flex justify-around items-center";
    nav.style.position = "fixed";
    nav.style.left = "0";
    nav.style.right = "0";
    nav.style.bottom = "0";
    nav.style.width = "100%";
    nav.style.minHeight = "calc(4.75rem + env(safe-area-inset-bottom))";
  }

  item.className = [
    "flex flex-col items-center justify-center rounded-full transition-colors active:scale-90 duration-150",
    "w-[68px] h-[52px] px-2 py-1 shrink-0",
    isActive
      ? "bg-primary-container text-on-primary-container"
      : "text-on-secondary-fixed-variant hover:bg-secondary-container"
  ].join(" ");
  item.style.width = "68px";
  item.style.height = "52px";
  item.style.minWidth = "68px";
  item.style.maxWidth = "68px";
  item.style.flex = "0 0 68px";
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

async function guardAuthenticatedRoutes() {
  const screenId = getCurrentScreenId();
  if (!["auth_welcome", "login", "signup", "accept_invite", "set_password"].includes(screenId) && !(await isLoggedIn())) {
    window.location.replace(window.location.protocol === "file:" ? "../auth_welcome/code.html" : "/auth_welcome/");
  }
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
        window.location.href = window.location.protocol === "file:" ? "../home_dashboard/code.html" : "/home_dashboard/";
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
      window.location.href = window.location.protocol === "file:" ? "../settings/code.html" : "/settings/";
    });
    target.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        window.location.href = window.location.protocol === "file:" ? "../settings/code.html" : "/settings/";
      }
    });
  });
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

function renderHeaderProfileAvatar(target, image) {
  const profile = getParentProfile();
  let initials = target.querySelector("[data-header-profile-initials]");
  if (!initials) {
    initials = document.createElement("span");
    initials.dataset.headerProfileInitials = "true";
    initials.className = "font-headline-md text-headline-md text-primary";
    target.appendChild(initials);
  }

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
