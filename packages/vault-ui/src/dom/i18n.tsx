import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import * as muiLocales from "@mui/material/locale";

import { i18n, i18nReady, resolveLanguage } from "@paint-vault/i18n/runtime";
import { theme } from "./theme";
export {
  i18n,
  i18nReady,
  languages,
  resolveLanguage,
  formatNumber,
  formatDate,
  formatRelativeTime,
  translateServerError,
} from "@paint-vault/i18n/runtime";
export type { Language } from "@paint-vault/i18n/runtime";
const storageKey = "paint-vault-language";
type LanguageBridge = {
  getLanguage?: () => Promise<string>;
  setLanguage?: (language: string) => Promise<unknown>;
};
function desktopBridge(): LanguageBridge | undefined {
  return typeof window === "undefined"
    ? undefined
    : (window as Window & { paintVaultDesktop?: LanguageBridge }).paintVaultDesktop;
}
const defaultLanguage = { language: "en", setLanguage: async (_language: string): Promise<void> => {} };
const LanguageContext = createContext<typeof defaultLanguage | null>(null);
export const useLanguage = () => useContext(LanguageContext) || defaultLanguage;
type LanguageProviderProps = { children: ReactNode; language?: string };
export function LanguageProvider(props: LanguageProviderProps) {
  const inherited = useContext(LanguageContext);
  return inherited ? props.children : <DeviceLanguageProvider {...props} />;
}
function DeviceLanguageProvider({ children, language: requestedLanguage }: LanguageProviderProps) {
  const [ready, setReady] = useState(i18n.isInitialized && (!desktopBridge() || !!requestedLanguage));
  const [language, setCurrent] = useState(i18n.language || "en");
  useEffect(() => {
    let active = true;
    const changed = (next: string) => {
      if (active) setCurrent(next);
    };
    i18n.on("languageChanged", changed);
    void i18nReady
      .then(async () => {
        const nativeLanguage = requestedLanguage ? undefined : await desktopBridge()?.getLanguage?.();
        const next = requestedLanguage || nativeLanguage;
        if (next) await i18n.changeLanguage(next === "en-XA" ? next : resolveLanguage(next));
        if (active) {
          setCurrent(i18n.language);
          setReady(true);
        }
      })
      .catch(() => {
        // A missing native preference must not prevent opening the device's vault.
        if (active) setReady(true);
      });
    return () => {
      active = false;
      i18n.off("languageChanged", changed);
    };
  }, [requestedLanguage]);
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
      document.documentElement.dir = "ltr";
    }
  }, [language]);
  const value = useMemo(
    () => ({
      language,
      setLanguage: async (next: string) => {
        const code = next === "en-XA" ? next : resolveLanguage(next);
        await i18n.changeLanguage(code);
        try {
          localStorage.setItem(storageKey, code);
        } catch {
          /* Private browsing can disable storage. */
        }
        if (code !== "en-XA") await desktopBridge()?.setLanguage?.(code);
      },
    }),
    [language],
  );
  const localizedTheme = useMemo(() => {
    const key = (
      {
        en: "enUS",
        es: "esES",
        fr: "frFR",
        de: "deDE",
        it: "itIT",
        "pt-BR": "ptBR",
        nl: "nlNL",
        pl: "plPL",
        ru: "ruRU",
        ja: "jaJP",
        ko: "koKR",
        "zh-Hans": "zhCN",
        "zh-Hant": "zhTW",
      } as const
    )[resolveLanguage(language)];
    // The key is constrained to exported MUI locale names above.
    // eslint-disable-next-line import/namespace
    return createTheme(theme, muiLocales[key]);
  }, [language]);
  if (!ready) return null;
  return (
    <LanguageContext.Provider value={value}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider theme={localizedTheme}>{children}</ThemeProvider>
      </I18nextProvider>
    </LanguageContext.Provider>
  );
}
