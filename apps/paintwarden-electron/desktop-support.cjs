const { open } = require("node:fs/promises");
const path = require("node:path");
const { zipSync, strToU8 } = require("fflate");

const issueUrl = "https://github.com/moonryc/paintwarden/issues/new";
const phases = new Set(["idle", "starting", "backing-up", "migrating", "ready", "failed"]);
const version = (value) =>
  /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-(?:alpha|beta|rc)\.\d{1,4})?$/.test(value) ? value : "unknown";
const language = (value) =>
  ["en", "es", "fr", "de", "it", "pt-BR", "nl", "pl", "ru", "ja", "ko", "zh-Hans", "zh-Hant"].includes(value)
    ? value
    : "en";
function supportSummary(input) {
  return {
    version: version(input.version),
    os: ["macOS", "Windows", "Linux"].includes(input.os) ? input.os : "Other",
    mode: input.mode === "remote" ? "remote" : "local",
    language: language(input.language),
    ...(input.mode === "remote" ? { serverVersion: version(input.serverVersion) } : {}),
    migrationState: phases.has(input.migrationState) ? input.migrationState : "idle",
    recentErrors: [],
  };
}

// Fail-closed redaction: do not try to guess arbitrary vault content or future secret
// formats. Export only constant event labels, never free text, stack traces, SQL,
// identifiers, paths, messages, URLs, or values parsed from ordinary log lines.
// Even recognized lines cannot carry their trailing text into the support bundle.
function redactLog(text) {
  return (
    text
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-2000)
      .map((line) => {
        if (line.startsWith("PAINTWARDEN_STARTUP ")) {
          try {
            const event = JSON.parse(line.slice(20));
            if (phases.has(event.phase)) return `startup:${event.phase}`;
          } catch {
            /* Omit malformed protocol and all its values. */
          }
        }
        if (/Starting bundled server/.test(line)) return "server:starting";
        if (/Server exited:/.test(line)) return "server:exited";
        if (/SQLITE_CONSTRAINT_FOREIGNKEY/.test(line)) return "error:foreign-key";
        if (/SQLITE_BUSY/.test(line)) return "error:database-busy";
        if (/SQLITE_CORRUPT/.test(line)) return "error:database-corrupt";
        if (/error|failed|exception/i.test(line)) return "error:details-omitted";
        return "[omitted]";
      })
      .join("\n") + "\n"
  );
}

async function readLog(file) {
  let handle;
  try {
    // O_NOFOLLOW prevents exporting unrelated files through a substituted log symlink.
    handle = await open(
      file,
      require("node:fs").constants.O_RDONLY | (require("node:fs").constants.O_NOFOLLOW || 0),
    );
    const stats = await handle.stat();
    if (!stats.isFile()) return null;
    const size = Math.min(stats.size, 2 * 1024 * 1024);
    const bytes = Buffer.alloc(size);
    await handle.read(bytes, 0, size, stats.size - size);
    return redactLog(bytes.toString("utf8"));
  } catch (error) {
    if (["ENOENT", "ELOOP"].includes(error.code)) return null;
    throw error;
  } finally {
    await handle?.close();
  }
}

async function createSupportBundle(directory, input) {
  const summary = supportSummary(input);
  const files = {};
  for (const name of ["vault-server.log", "vault-desktop.log"]) {
    for (const suffix of ["", ".1", ".2", ".3"]) {
      const text = await readLog(path.join(directory, name + suffix));
      if (text === null) continue;
      files[`logs/${name}${suffix}`] = strToU8(text);
      summary.recentErrors.push(...text.split("\n").filter((line) => line.startsWith("error:")));
    }
  }
  summary.recentErrors = [...new Set(summary.recentErrors)].slice(-20);
  files["summary.json"] = strToU8(JSON.stringify(summary, null, 2));
  return zipSync(files, { level: 6 });
}
function buildBugReportUrl(input) {
  const summary = supportSummary(input);
  const url = new URL(issueUrl);
  url.searchParams.set("template", "bug_report.yml");
  for (const key of ["version", "os", "mode", "language"]) url.searchParams.set(key, summary[key]);
  return url.href;
}
function allowedBugReportUrl(value) {
  try {
    const url = new URL(value);
    if (url.origin + url.pathname !== issueUrl || url.username || url.password || url.hash) return false;
    const keys = [...url.searchParams.keys()];
    if (
      keys.length !== 5 ||
      new Set(keys).size !== 5 ||
      url.searchParams.get("template") !== "bug_report.yml"
    )
      return false;
    return buildBugReportUrl(Object.fromEntries(url.searchParams)) === url.href;
  } catch {
    return false;
  }
}
async function openBugReport(input, openExternal) {
  const url = buildBugReportUrl(input);
  if (!allowedBugReportUrl(url)) throw new Error("Invalid bug report URL");
  await openExternal(url);
  return true;
}
module.exports = {
  supportSummary,
  redactLog,
  createSupportBundle,
  buildBugReportUrl,
  allowedBugReportUrl,
  openBugReport,
};
