import { createInstance } from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { useEffect, useSyncExternalStore } from "react";

import { languages, resolveLanguage } from "../../../../packages/paint-i18n/languages";
import english from "../../../../packages/paint-i18n/locales/en/site.json";

export { languages };
export type SiteKey = keyof typeof english;
const storageKey = "paint-vault-language";
const resources = import.meta.glob<{ default: Record<string, string> }>(
  "../../../../packages/paint-i18n/locales/*/site.json",
);
export const siteI18n = createInstance();
// English is bundled for deterministic static rendering and hydration. Other
// languages load only when selected, with an English placeholder until its namespace is translated.
void siteI18n
  .use(
    resourcesToBackend(async (language: string) => {
      const loader = resources[`../../../../packages/paint-i18n/locales/${language}/site.json`];
      if (!loader) return english;
      return (await loader()).default;
    }),
  )
  .init({
    resources: { en: { site: english } },
    partialBundledLanguages: true,
    lng: "en",
    supportedLngs: languages.map(({ code }) => code),
    fallbackLng: false,
    load: "currentOnly",
    ns: ["site"],
    defaultNS: "site",
    keySeparator: false,
    initAsync: false,
    interpolation: { escapeValue: false },
  });

export const siteT = (key: SiteKey): string => siteI18n.t(key, { ns: "site" });
const subscribe = (listener: () => void) => {
  siteI18n.on("languageChanged", listener);
  return () => {
    siteI18n.off("languageChanged", listener);
  };
};
export function useSiteLanguage() {
  const language = useSyncExternalStore(
    subscribe,
    () => siteI18n.language,
    () => "en",
  );
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(storageKey);
    } catch {
      /* Storage may be disabled. */
    }
    void siteI18n.changeLanguage(resolveLanguage(saved || navigator.language));
  }, []);
  useEffect(() => {
    document.documentElement.lang = siteI18n.resolvedLanguage || "en";
    document.documentElement.dir = "ltr";
  }, [language]);
  return {
    language,
    setLanguage: async (input: string) => {
      const code = resolveLanguage(input);
      await siteI18n.changeLanguage(code);
      try {
        localStorage.setItem(storageKey, code);
      } catch {
        /* Storage may be disabled. */
      }
    },
  };
}
