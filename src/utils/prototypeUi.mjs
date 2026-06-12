export function screenUrl(screenId) {
  return window.location.protocol === "file:"
    ? `../${screenId}/code.html`
    : `/${screenId}/`;
}

export function goToScreen(screenId) {
  window.location.href = screenUrl(screenId);
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
  const navTargets = {
    home: "home_dashboard",
    log: "quick_log",
    calendar: "calendar",
    milestones: "milestones",
    assistant: "assistant"
  };
  const activeScreen = getCurrentScreenId();
  const activeKey = Object.entries(navTargets).find(([, screenId]) => screenId === activeScreen)?.[0]
    || (["feeding_log", "sleep_log", "diaper_log", "growth_tracker"].includes(activeScreen) ? "log" : "")
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
  item.setAttribute("aria-current", isActive ? "page" : "false");
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

function getCurrentScreenId() {
  const path = window.location.pathname.replaceAll("\\", "/");
  const fileMatch = path.match(/\/src\/screens\/([^/]+)\/code\.html$/);
  if (fileMatch) return fileMatch[1];
  return path.split("/").filter(Boolean)[0] || "home_dashboard";
}
