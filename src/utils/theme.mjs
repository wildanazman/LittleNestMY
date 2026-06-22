const themeKey = "littlenest:theme";
const allowedThemes = new Set(["light", "dark", "system"]);

export { themeKey };

export function getThemePreference() {
  try {
    const value = window.localStorage.getItem(themeKey);
    if (allowedThemes.has(value)) return value;
    window.localStorage.setItem(themeKey, "light");
    return "light";
  } catch {
    return "light";
  }
}

export function setThemePreference(theme) {
  const nextTheme = allowedThemes.has(theme) ? theme : "light";
  try {
    window.localStorage.setItem(themeKey, nextTheme);
  } catch {
    // Local storage can be unavailable in private or restricted contexts.
  }
  applyTheme(nextTheme);
  return nextTheme;
}

export function applyTheme(theme = getThemePreference()) {
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches || false;
  const resolved = theme === "system" ? (prefersDark ? "dark" : "light") : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.dataset.theme = resolved;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute("content", resolved === "dark" ? "#050506" : "#ffbfa3");
  window.dispatchEvent(new CustomEvent("littlenest:themechange", { detail: { theme, resolved } }));
  return resolved;
}

export function watchSystemTheme() {
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (!media) return;
  media.addEventListener?.("change", () => {
    if (getThemePreference() === "system") applyTheme("system");
  });
}

applyTheme();
watchSystemTheme();
lockViewportZoom();

function lockViewportZoom() {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const content = meta.getAttribute("content") || "";

  // Hammer in user-scalable=no on touchstart so iOS can't override it
  // after the gesture recognizer has already decided to allow zoom.
  document.addEventListener("touchstart", () => {
    if (!meta.content.includes("user-scalable=no")) {
      meta.setAttribute("content", `${content}, user-scalable=no`);
    }
  }, { passive: true });

  // Also clamp on focus to prevent iOS auto-zoom on inputs
  document.addEventListener("focusin", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") {
      meta.setAttribute("content", `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no`);
    }
  });

  document.addEventListener("focusout", () => {
    meta.setAttribute("content", content);
  });
}
lockViewportZoom();
