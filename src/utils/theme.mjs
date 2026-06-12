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
