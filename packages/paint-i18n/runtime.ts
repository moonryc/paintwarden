/// <reference types="vite/client" />
import { createInstance } from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { languages, resolveLanguage, type Language } from "./languages.ts";
import type common from "./locales/en/common.json";
import type components from "./locales/en/components.json";
import type desktop from "./locales/en/desktop.json";
import type errors from "./locales/en/errors.json";
import type glossary from "./locales/en/glossary.json";
import type pages from "./locales/en/pages.json";
import type shell from "./locales/en/shell.json";
import type site from "./locales/en/site.json";
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    returnNull: false;
    resources: {
      common: typeof common;
      components: typeof components;
      desktop: typeof desktop;
      errors: typeof errors;
      glossary: typeof glossary;
      pages: typeof pages;
      shell: typeof shell;
      site: typeof site;
    };
  }
}

export { languages, resolveLanguage };
export type { Language };
export const i18n = createInstance();
const storageKey = "paintwarden-language";
const namespaces = ["common", "glossary", "pages", "components", "shell", "errors"];
const accents: Record<string, string> = {
  a: "á",
  e: "ë",
  i: "ï",
  o: "ô",
  u: "ü",
  A: "Á",
  E: "Ë",
  I: "Ï",
  O: "Ô",
  U: "Ü",
};
export function pseudoText(text: string): string {
  const parts = text.split(/(\{\{.*?\}\}|\$t\(.*?\)|<[^>]*>)/g);
  return `［${parts
    .map((part, index) => {
      if (index % 2) return part;
      // Distribute expansion over words: a paragraph must not gain a single
      // unbreakable 60-character padding suffix that no natural language has.
      const words = part.match(/\S+/g) || [];
      const weight = words.reduce((sum, word) => sum + word.length, 0);
      const padding = Math.ceil(part.length * 0.4);
      let cumulative = 0;
      let emitted = 0;
      return part.replace(/\S+/g, (word) => {
        cumulative += word.length;
        const target = Math.round((padding * cumulative) / weight);
        const extra = target - emitted;
        emitted = target;
        return word.replace(/[aeiouAEIOU]/g, (c) => accents[c]) + "~".repeat(extra);
      });
    })
    .join("")}］`;
}
function pseudoResource(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      typeof item === "string" ? pseudoText(item) : pseudoResource(item as Record<string, unknown>),
    ]),
  );
}
function savedLanguage(): string | undefined {
  try {
    return localStorage.getItem(storageKey) || undefined;
  } catch {
    return undefined;
  }
}
const bundledResources =
  typeof window !== "undefined"
    ? import.meta.glob<{ default: Record<string, unknown> }>("./locales/*/*.json")
    : null;
export const i18nReady = i18n
  .use(
    resourcesToBackend(async (language: string, namespace: string) => {
      const code = language === "en-XA" ? "en" : language;
      const resourcePath = `./locales/${code}/${namespace}.json`;
      const resource = bundledResources
        ? await bundledResources[resourcePath]()
        : ((await import(/* @vite-ignore */ resourcePath, { with: { type: "json" } })) as {
            default: Record<string, unknown>;
          });
      // Return the module wrapper: the backend unwraps it once. A namespace may itself
      // legitimately contain a translation key named "default".
      return language === "en-XA" ? { default: pseudoResource(resource.default) } : resource;
    }),
  )
  .init({
    lng:
      savedLanguage() === "en-XA"
        ? "en-XA"
        : resolveLanguage(savedLanguage() || (typeof navigator !== "undefined" ? navigator.language : "en")),
    supportedLngs: [...languages.map(({ code }) => code), "en-XA"],
    fallbackLng: false,
    load: "currentOnly",
    defaultNS: "common",
    ns: namespaces,
    interpolation: { escapeValue: false },
    returnNull: false,
  });

// Importers never render untranslated keys during initial namespace loading.
await i18nReady;

export const intlLocale = () => (i18n.language === "en-XA" ? "en" : i18n.language);
export const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(intlLocale(), options).format(value);
export const formatDate = (value: Date | number | string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(intlLocale(), options).format(new Date(value));
export const formatRelativeTime = (value: number, unit: Intl.RelativeTimeFormatUnit) =>
  new Intl.RelativeTimeFormat(intlLocale(), { numeric: "auto" }).format(value, unit);

export type PublicError = {
  error?: unknown;
  errorCode?: string;
  errorParameters?: Record<string, unknown>;
  extensions?: { errorCode?: unknown; errorParameters?: unknown; code?: unknown };
};
export function translateServerError(error: PublicError): string {
  const code =
    error.errorCode ||
    (typeof error.extensions?.errorCode === "string" ? error.extensions.errorCode : undefined) ||
    (typeof error.extensions?.code === "string" ? error.extensions.code : "REQUEST_FAILED");
  const parameters = error.errorParameters || error.extensions?.errorParameters;
  const key = `errors:${code}`;
  return i18n.exists(key)
    ? i18n.t(
        key as `errors:${keyof typeof errors}`,
        parameters && typeof parameters === "object" ? (parameters as Record<string, unknown>) : {},
      )
    : i18n.t("errors:REQUEST_FAILED");
}
