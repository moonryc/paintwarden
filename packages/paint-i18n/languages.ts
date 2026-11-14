export const languages = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "it", name: "Italiano" },
  { code: "pt-BR", name: "Português (Brasil)" },
  { code: "nl", name: "Nederlands" },
  { code: "pl", name: "Polski" },
  { code: "ru", name: "Русский" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "zh-Hans", name: "简体中文" },
  { code: "zh-Hant", name: "繁體中文" },
] as const;
export type Language = (typeof languages)[number]["code"];
export function resolveLanguage(input: string | undefined): Language {
  const tag = (input || "en").replaceAll("_", "-").toLowerCase();
  if (tag.startsWith("zh")) return /(?:hant|tw|hk|mo)/.test(tag) ? "zh-Hant" : "zh-Hans";
  return (
    languages.find(({ code }) => code.toLowerCase() === tag)?.code ||
    languages.find(({ code }) => code.split("-")[0] === tag.split("-")[0])?.code ||
    "en"
  );
}
