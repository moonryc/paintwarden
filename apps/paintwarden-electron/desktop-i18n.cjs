const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const { createInstance } = require("i18next");

const supportedLanguages = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt-BR",
  "nl",
  "pl",
  "ru",
  "ja",
  "ko",
  "zh-Hans",
  "zh-Hant",
];
function resolveLanguage(input) {
  const tag = String(input || "en")
    .replaceAll("_", "-")
    .toLowerCase();
  if (tag.startsWith("zh")) return /(?:hant|tw|hk|mo)/.test(tag) ? "zh-Hant" : "zh-Hans";
  return (
    supportedLanguages.find((code) => code.toLowerCase() === tag) ||
    supportedLanguages.find((code) => code.split("-")[0] === tag.split("-")[0]) ||
    "en"
  );
}
const packaged = process.resourcesPath && path.join(process.resourcesPath, "locales");
const directory =
  packaged && existsSync(packaged) ? packaged : path.resolve(__dirname, "../../packages/paint-i18n/locales");
// Keep English available at startup; read each other native namespace only when
// the user selects it, not all locales on every desktop launch.
const english = JSON.parse(readFileSync(path.join(directory, "en", "desktop.json"), "utf8"));
const resources = { en: { desktop: english } };
const i18n = createInstance();
void i18n.init({
  resources,
  lng: "en",
  fallbackLng: false,
  supportedLngs: supportedLanguages,
  load: "currentOnly",
  defaultNS: "desktop",
  ns: ["desktop"],
  initAsync: false,
  interpolation: { escapeValue: false },
});
const t = (key, values) => i18n.t(key, values);
function setLanguage(language) {
  if (!supportedLanguages.includes(language)) throw new Error(t("errors.invalidLanguage"));
  if (!i18n.hasResourceBundle(language, "desktop")) {
    const file = path.join(directory, language, "desktop.json");
    const resource = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : english;
    i18n.addResourceBundle(language, "desktop", resource);
  }
  void i18n.changeLanguage(language);
  return i18n.language;
}
module.exports = { t, setLanguage, getLanguage: () => i18n.language, supportedLanguages, resolveLanguage };
