(function () {
  function isNativeCapacitor() {
    try {
      return Boolean(
        window.Capacitor?.isNativePlatform?.()
        || window.Capacitor?.isNative
        || window.location.protocol === "capacitor:"
        || (window.location.hostname === "localhost" && !window.location.port && window.location.protocol !== "https:")
      );
    } catch {
      return false;
    }
  }

  function screenUrl(screenId) {
    if (!screenId) return "";
    if (isNativeCapacitor()) return `/${screenId}/index.html`;
    return window.location.protocol === "file:"
      ? `../${screenId}/code.html`
      : `/${screenId}/`;
  }

  function go(screenId) {
    const url = screenUrl(screenId);
    if (url) window.location.href = url;
  }

  window.LittleNestCompat = {
    isNativeCapacitor,
    screenUrl,
    go
  };

  if (isNativeCapacitor() && navigator.serviceWorker?.register) {
    try {
      navigator.serviceWorker.register = function () {
        return Promise.resolve({ scope: window.location.origin, active: null });
      };
    } catch {
      // Some WebViews expose serviceWorker as read-only. Existing callers catch registration errors.
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindScreenButtons();
    bindGuestButton();
    bindBottomNav();
  });

  function bindScreenButtons(root) {
    (root || document).querySelectorAll("[data-screen-target]").forEach((element) => {
      if (element.dataset.capacitorCompatBound === "true") return;
      element.dataset.capacitorCompatBound = "true";
      element.addEventListener("click", () => go(element.dataset.screenTarget));
      element.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        go(element.dataset.screenTarget);
      });
    });
  }

  function bindGuestButton() {
    const guestButton = document.getElementById("guestButton");
    if (!guestButton || guestButton.dataset.capacitorGuestBound === "true") return;
    guestButton.dataset.capacitorGuestBound = "true";
    guestButton.addEventListener("click", () => {
      try {
        window.localStorage.setItem("littlenest:isGuest", "true");
        window.localStorage.removeItem("currentUser");
      } catch {
        // Local storage may be unavailable in restricted WebViews.
      }
      go("home_dashboard");
    });
  }

  function bindBottomNav(root) {
    const navTargets = {
      home: "home_dashboard",
      log: "quick_log",
      calendar: "calendar",
      milestones: "milestones",
      assistant: "assistant",
      insights: "assistant"
    };

    (root || document).querySelectorAll("nav.fixed a, nav.fixed button").forEach((item) => {
      if (item.dataset.capacitorNavBound === "true") return;
      const key = getNavKey(item);
      const target = navTargets[key];
      if (!target) return;

      item.dataset.capacitorNavBound = "true";
      if (item.tagName === "A") item.setAttribute("href", screenUrl(target));
      item.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        go(target);
      });
    });
  }

  function getNavKey(item) {
    const icon = (item.querySelector(".material-symbols-outlined")?.textContent || "").trim().toLowerCase();
    const iconMap = {
      home: "home",
      add: "log",
      add_circle: "log",
      calendar_month: "calendar",
      event: "calendar",
      auto_awesome: "milestones",
      stars: "milestones",
      smart_toy: "assistant",
      psychology: "assistant",
      insights: "insights"
    };
    if (iconMap[icon]) return iconMap[icon];

    const labelElement = item.querySelector("span:last-child");
    const label = (labelElement?.textContent || item.textContent || "").trim().toLowerCase();
    if (label.includes("home")) return "home";
    if (label.includes("log") || label.includes("+")) return "log";
    if (label.includes("calendar")) return "calendar";
    if (label.includes("milestone")) return "milestones";
    if (label.includes("assistant") || label.includes("insight")) return "assistant";
    return "";
  }
})();
