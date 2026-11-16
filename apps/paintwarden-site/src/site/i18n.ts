import { localizedFontVars } from "@paintwarden/ui/theme-tokens";
import { createInstance } from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { useEffect, useState, useSyncExternalStore } from "react";

import { languages, resolveLanguage } from "../../../../packages/paint-i18n/languages";
import english from "../../../../packages/paint-i18n/locales/en/site.json";

export { languages };
export type SiteKey = keyof typeof english;
const storageKey = "paintwarden-language";
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
  const [initialized, setInitialized] = useState(false);
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
    const code = resolveLanguage(saved || navigator.language);
    void siteI18n
      .loadLanguages(code)
      .then(() => siteI18n.changeLanguage(siteI18n.hasResourceBundle(code, "site") ? code : "en"))
      .catch(() => {
        // Keep the bundled English fallback if the selected catalog cannot load.
        return siteI18n.changeLanguage("en");
      })
      .finally(() => {
        setInitialized(true);
      });
  }, []);
  useEffect(() => {
    document.documentElement.lang = siteI18n.resolvedLanguage || "en";
    document.documentElement.dir = "ltr";
    for (const [name, value] of Object.entries(localizedFontVars(siteI18n.resolvedLanguage || "en")))
      document.documentElement.style.setProperty(name, value);
  }, [language]);
  useEffect(() => {
    if (!initialized) return;
    let cancelled = false;
    const reveal = async () => {
      try {
        // Include below-the-fold weights too: lazy content must not swap fonts on scroll.
        await Promise.allSettled([
          ...[400, 500, 600, 700].map((weight) => document.fonts.load(`${weight} 16px Inter`)),
          document.fonts.load("600 40px Fraunces"),
        ]);
        await document.fonts.ready;
      } catch {
        // A failed font request must not leave the page invisible.
      }
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!cancelled) document.documentElement.removeAttribute("data-site-pending");
        }),
      );
    };
    void reveal();
    return () => {
      cancelled = true;
    };
  }, [initialized, language]);
  return {
    language,
    setLanguage: async (input: string) => {
      const code = resolveLanguage(input);
      await siteI18n.loadLanguages(code);
      // Keep the current translated page when a newly selected catalog is offline.
      if (!siteI18n.hasResourceBundle(code, "site")) return;
      await siteI18n.changeLanguage(code);
      try {
        localStorage.setItem(storageKey, code);
      } catch {
        /* Storage may be disabled. */
      }
    },
  };
}
