import { defaultLanguage, supportedLanguages, translations } from "../i18n/translations.mjs";

const languageKey = "littlenest:language";

export function getLanguage() {
  try {
    const value = window.localStorage.getItem(languageKey);
    return isSupportedLanguage(value) ? value : defaultLanguage;
  } catch {
    return defaultLanguage;
  }
}

export function setLanguage(language) {
  const nextLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  try {
    window.localStorage.setItem(languageKey, nextLanguage);
  } catch {
    // Local storage can be unavailable in private or restricted contexts.
  }
  window.dispatchEvent(new CustomEvent("littlenest:languagechange", { detail: { language: nextLanguage } }));
  return nextLanguage;
}

export function t(key, language = getLanguage()) {
  return getByPath(translations[language], key) || getByPath(translations[defaultLanguage], key) || key;
}

export function applyTranslations(root = document, language = getLanguage()) {
  root.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n, language);
  });

  root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder, language));
  });
}

export { defaultLanguage, supportedLanguages, translations };

function isSupportedLanguage(language) {
  return supportedLanguages.some((item) => item.code === language);
}

function getByPath(source, path) {
  return path.split(".").reduce((value, segment) => value?.[segment], source);
}
