import metadata from "../../../../../package.json" with { type: "json" };

export type SupportSummary = {
  version: string;
  os: string;
  mode: "local" | "remote";
  language: string;
  serverVersion?: string;
  migrationState?: string;
  recentErrors?: string[];
};

const issueUrl = "https://github.com/moonryc/paintwarden/issues/new";
const safeVersion = (value: unknown): string =>
  typeof value === "string" && /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-(?:alpha|beta|rc)\.\d{1,4})?$/.test(value)
    ? value
    : "unknown";
const safeLanguage = (language: string): string =>
  ["en", "es", "fr", "de", "it", "pt-BR", "nl", "pl", "ru", "ja", "ko", "zh-Hans", "zh-Hant"].includes(
    language,
  )
    ? language
    : "en";

export function buildBugReportUrl(summary: SupportSummary): string {
  const url = new URL(issueUrl);
  url.searchParams.set("template", "bug_report.yml");
  url.searchParams.set("version", safeVersion(summary.version));
  url.searchParams.set("os", ["macOS", "Windows", "Linux"].includes(summary.os) ? summary.os : "Other");
  url.searchParams.set("mode", summary.mode === "remote" ? "remote" : "local");
  url.searchParams.set("language", safeLanguage(summary.language));
  return url.href;
}

export async function getSupportSummary(language: string): Promise<SupportSummary> {
  if (window.paintwardenDesktop) return window.paintwardenDesktop.getSupportSummary(safeLanguage(language));
  // Do not export userAgent, URLs, hostname, cookies, storage, errors, or vault data.
  const platform = navigator.platform;
  const summary: SupportSummary = {
    version: metadata.version,
    os: /Mac/i.test(platform)
      ? "macOS"
      : /Win/i.test(platform)
        ? "Windows"
        : /Linux/i.test(platform)
          ? "Linux"
          : "Other",
    mode: ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname) ? "local" : "remote",
    language: safeLanguage(language),
    migrationState: "unavailable",
    recentErrors: [],
  };
  try {
    const response = await fetch("/api/version", { cache: "no-store", signal: AbortSignal.timeout(3000) });
    const body = response.ok ? ((await response.json()) as { version?: unknown }) : null;
    summary.serverVersion = safeVersion(body?.version);
  } catch {
    summary.serverVersion = "unknown";
  }
  return summary;
}

export async function reportBug(language: string): Promise<void> {
  if (window.paintwardenDesktop) {
    await window.paintwardenDesktop.openBugReport(safeLanguage(language));
    return;
  }
  // No await before window.open: retain the user's activation for popup protection.
  const platform = navigator.platform;
  const summary: SupportSummary = {
    version: metadata.version,
    os: /Mac/i.test(platform)
      ? "macOS"
      : /Win/i.test(platform)
        ? "Windows"
        : /Linux/i.test(platform)
          ? "Linux"
          : "Other",
    mode: ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname) ? "local" : "remote",
    language: safeLanguage(language),
  };
  window.open(buildBugReportUrl(summary), "_blank", "noopener,noreferrer");
}

export async function saveSupportBundle(language: string): Promise<boolean> {
  if (window.paintwardenDesktop) return window.paintwardenDesktop.saveSupportBundle(safeLanguage(language));
  const summary = await getSupportSummary(language);
  const url = URL.createObjectURL(new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" }));
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = "paintwarden-support.json";
    link.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return true;
}
