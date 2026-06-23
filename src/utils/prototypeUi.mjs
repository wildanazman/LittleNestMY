export function screenUrl(screenId) {
  if (window.LittleNestCompat?.screenUrl) {
    return window.LittleNestCompat.screenUrl(screenId);
  }
  return window.location.protocol === "file:"
    ? `../${screenId}/code.html`
    : `/${screenId}/`;
}

export function goToScreen(screenId) {
  navigateWithTransition(screenUrl(screenId));
}

export function goBackOrTo(fallbackScreenId = "home_dashboard") {
  if (hasUsefulBackEntry()) {
    window.history.back();
    return;
  }
  goToScreen(fallbackScreenId);
}

export function navigateWithTransition(url) {
  if (!url) return;
  if (isSameLocation(url)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.location.href = url;
    return;
  }
  document.documentElement.classList.add("ln-page-exit");
  window.setTimeout(() => {
    window.location.href = url;
  }, 120);
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
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

export function bindPrototypeActions(root = document) {
  bindBottomNavigationFallback(root);

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
    || (["settings", "privacy_safety", "family_sharing", "mommy_guide", "add_baby_profile", "baby_profiles"].includes(activeScreen) ? "assistant" : "")
    || "home";

  root.querySelectorAll("nav.fixed a, nav.fixed button").forEach((item) => {
    const label = getNavLabel(item);
    const screenId = navTargets[label];

    if (!screenId || item.dataset.prototypeNavBound === "true") return;

    item.dataset.prototypeNavBound = "true";
    normalizeNavItem(item, label === activeKey);
    if (item.tagName === "A") item.href = screenUrl(screenId);
    item.addEventListener("click", (event) => {
      event.preventDefault();
      goToScreen(screenId);
    });
  });
}

bindBottomNavigationFallback();

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
  return path.split("/").filter(Boolean)[0] || "home_dashboard";
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
    return routeIdentity(previous) !== routeIdentity(current);
  } catch {
    return false;
  }
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
