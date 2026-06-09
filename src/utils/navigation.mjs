import { applyTranslations, getLanguage, t } from "./i18n.mjs";

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
  quick_log: "log",
  quick_log_dark: "log",
  feeding_log: "log",
  feeding_log_dark: "log",
  sleep_log: "log",
  sleep_log_dark: "log",
  diaper_log: "log",
  diaper_log_dark: "log",
  calendar: "calendar",
  weekly_insights: "calendar",
  milestones: "milestones",
  memory_book: "milestones",
  assistant: "assistant",
  settings: "assistant",
  family_sharing: "assistant"
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

    link.dataset.navKey = key;
    link.dataset.i18n = `navigation.${key}`;
    link.querySelector("span:last-child").textContent = t(`navigation.${key}`);

    if (link.tagName === "A") {
      link.href = route;
    } else {
      link.type = "button";
      link.addEventListener("click", () => {
        window.location.href = route;
      });
    }
    link.setAttribute("data-nav-item", key);

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
    nav.fixed a.nav-tab-active {
      outline: 2px solid rgba(131, 83, 60, 0.24);
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
}

setupBottomNavigation();

function getNavKey(link) {
  if (link.dataset.navKey) return link.dataset.navKey;
  const label = link.textContent.trim().toLowerCase();
  const language = getLanguage();
  return Object.keys(routes).find((key) => label === t(`navigation.${key}`, language).toLowerCase())
    || Object.keys(routes).find((key) => label === t(`navigation.${key}`, "en").toLowerCase())
    || "";
}
