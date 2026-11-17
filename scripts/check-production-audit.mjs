import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowedAdvisories = new Map([
  ["https://github.com/advisories/GHSA-mh32-jxcr-mh9f", "low"],
  ["https://github.com/advisories/GHSA-r3h5-4585-7x3w", "moderate"],
]);
// Exact reviewed build-only graph, not a package-name or severity allowlist.
// Remove after a patched picomatch release; see docs/dependency-audit.md.
const reviewedPicomatch = JSON.parse(
  fs.readFileSync(new URL("./production-audit-picomatch-reviewed.json", import.meta.url), "utf8"),
);
const severities = ["info", "low", "moderate", "high", "critical"];
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string" && value.length > 0;
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
function requireShape(condition, message) {
  if (!condition) throw new Error(message);
}
function keysAre(value, keys) {
  return object(value) && Object.keys(value).every((key) => keys.includes(key));
}

// The site is built as static HTML: these two reviewed Astro advisories do not affect
// its deployment. The fixed release requires a newer Node than our pinned runtime.
// Never allow an entire package: new advisories and severity changes require review.
export function checkProductionAudit(report, astroVersion, lockPackages) {
  requireShape(
    keysAre(report, ["auditReportVersion", "vulnerabilities", "metadata"]) &&
      report.auditReportVersion === 2 &&
      object(report.vulnerabilities) &&
      keysAre(report.metadata, ["vulnerabilities", "dependencies"]),
    "Invalid npm audit report (or audit returned an error).",
  );
  const counts = report.metadata.vulnerabilities;
  requireShape(
    keysAre(counts, [...severities, "total"]) &&
      [...severities, "total"].every((key) => integer(counts[key])) &&
      counts.total === severities.reduce((sum, key) => sum + counts[key], 0) &&
      counts.total === Object.keys(report.vulnerabilities).length,
    "Invalid npm audit vulnerability counts.",
  );
  requireShape(
    keysAre(report.metadata.dependencies, ["prod", "dev", "optional", "peer", "peerOptional", "total"]) &&
      ["prod", "dev", "optional", "peer", "peerOptional", "total"].every((key) =>
        integer(report.metadata.dependencies[key]),
      ),
    "Invalid npm audit dependency metadata.",
  );
  if (Object.hasOwn(report.vulnerabilities, "picomatch")) {
    return checkReviewedPicomatch(report, astroVersion, lockPackages);
  }
  const expectedCounts = Object.fromEntries(severities.map((severity) => [severity, 0]));
  const accepted = [];
  for (const [name, entry] of Object.entries(report.vulnerabilities)) {
    requireShape(name === "astro", `Unreviewed production vulnerability: ${name}.`);
    requireShape(
      astroVersion === "7.4.0",
      `Astro exception requires locked version 7.4.0, got ${astroVersion}.`,
    );
    requireShape(
      keysAre(entry, ["name", "severity", "isDirect", "via", "effects", "range", "nodes", "fixAvailable"]) &&
        entry.name === "astro" &&
        entry.isDirect === true &&
        Array.isArray(entry.via) &&
        entry.via.length > 0 &&
        Array.isArray(entry.effects) &&
        entry.effects.length === 0 &&
        text(entry.range) &&
        Array.isArray(entry.nodes) &&
        entry.nodes.length === 1 &&
        entry.nodes[0] === "node_modules/astro" &&
        (entry.fixAvailable === false ||
          (keysAre(entry.fixAvailable, ["name", "version", "isSemVerMajor"]) &&
            entry.fixAvailable.name === "astro" &&
            text(entry.fixAvailable.version) &&
            typeof entry.fixAvailable.isSemVerMajor === "boolean")),
      "Unrecognized Astro vulnerability entry (indirect vulnerabilities are not exempt).",
    );
    const seen = new Set();
    let severity = "low";
    for (const advisory of entry.via) {
      requireShape(
        keysAre(advisory, [
          "source",
          "name",
          "dependency",
          "title",
          "url",
          "severity",
          "cwe",
          "cvss",
          "range",
        ]) &&
          integer(advisory.source) &&
          advisory.source > 0 &&
          advisory.name === "astro" &&
          advisory.dependency === "astro" &&
          text(advisory.title) &&
          text(advisory.range) &&
          Array.isArray(advisory.cwe) &&
          advisory.cwe.every(text) &&
          keysAre(advisory.cvss, ["score", "vectorString"]) &&
          typeof advisory.cvss.score === "number" &&
          Number.isFinite(advisory.cvss.score) &&
          advisory.cvss.score >= 0 &&
          advisory.cvss.score <= 10 &&
          (advisory.cvss.vectorString === null || text(advisory.cvss.vectorString)),
        "Unrecognized Astro advisory; expected a root advisory object.",
      );
      requireShape(
        allowedAdvisories.has(advisory.url) &&
          allowedAdvisories.get(advisory.url) === advisory.severity &&
          !seen.has(advisory.url),
        `Unreviewed or changed Astro advisory: ${advisory.url} (${advisory.severity}).`,
      );
      seen.add(advisory.url);
      accepted.push(advisory.url);
      if (advisory.severity === "moderate") severity = "moderate";
    }
    requireShape(entry.severity === severity, `Unreviewed Astro severity: ${entry.severity}.`);
    expectedCounts[severity] += 1;
  }
  requireShape(
    severities.every((severity) => counts[severity] === expectedCounts[severity]),
    "npm audit severity counts do not match its vulnerability entries.",
  );
  return { vulnerablePackages: counts.total, acceptedAdvisories: accepted };
}

function checkReviewedPicomatch(report, astroVersion, lockPackages) {
  requireShape(astroVersion === "7.4.0", "Picomatch graph requires locked Astro version 7.4.0.");
  requireShape(object(lockPackages), "Picomatch exception requires the complete lock package map.");
  const names = new Set(Object.keys(reviewedPicomatch.vulnerabilities));
  const actualLocks = Object.fromEntries(
    Object.entries(lockPackages)
      .filter(
        ([location, entry]) =>
          location.includes("node_modules/") &&
          object(entry) &&
          names.has(entry.name ?? location.split("node_modules/").at(-1)),
      )
      .map(([location, entry]) => [location, { version: entry.version, dev: entry.dev === true }]),
  );
  requireShape(
    isDeepStrictEqual(actualLocks, reviewedPicomatch.lockPackages),
    "Unreviewed picomatch dependency lock version, location or development/runtime classification.",
  );
  // npm's suggested upgrade can change with registry state even when the
  // installed tree and advisory graph are identical. Validate its shape, but
  // never use this recommendation to approve a package, path or advisory.
  const graph = (entries) =>
    Object.fromEntries(
      Object.entries(entries).map(([name, entry]) => {
        const { fixAvailable, ...security } = entry;
        requireShape(
          fixAvailable === false ||
            (keysAre(fixAvailable, ["name", "version", "isSemVerMajor"]) &&
              text(fixAvailable.name) &&
              text(fixAvailable.version) &&
              typeof fixAvailable.isSemVerMajor === "boolean"),
          "Invalid npm fix recommendation in reviewed picomatch graph.",
        );
        return [name, security];
      }),
    );
  requireShape(
    isDeepStrictEqual(graph(report.vulnerabilities), graph(reviewedPicomatch.vulnerabilities)),
    "Unreviewed picomatch advisory or propagated vulnerability graph (including Astro advisories).",
  );
  const expectedCounts = Object.fromEntries(severities.map((severity) => [severity, 0]));
  for (const entry of Object.values(reviewedPicomatch.vulnerabilities)) expectedCounts[entry.severity]++;
  requireShape(
    severities.every((severity) => report.metadata.vulnerabilities[severity] === expectedCounts[severity]),
    "npm audit severity counts do not match the reviewed picomatch graph.",
  );
  return {
    vulnerablePackages: report.metadata.vulnerabilities.total,
    acceptedAdvisories: [...allowedAdvisories.keys(), reviewedPicomatch.advisory],
  };
}

export function checkAuditResult(result, astroVersion, lockPackages) {
  requireShape(
    !result.error && !result.signal && [0, 1].includes(result.status),
    `npm audit failed: ${result.error?.message || result.signal || result.stderr || result.status}.`,
  );
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error("npm audit did not return valid JSON.");
  }
  const checked = checkProductionAudit(report, astroVersion, lockPackages);
  requireShape(
    result.status === (checked.vulnerablePackages ? 1 : 0),
    "npm audit exit status does not match its report.",
  );
  return checked;
}

function main() {
  requireShape(text(process.env.npm_execpath), "Run this check with npm run audit:production.");
  const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
  // Invoke the npm JavaScript CLI with Node, not a shell/npm.cmd, on every platform.
  const result = spawnSync(process.execPath, [process.env.npm_execpath, "audit", "--omit=dev", "--json"], {
    cwd: root,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const checked = checkAuditResult(result, lock.packages?.["node_modules/astro"]?.version, lock.packages);
  console.log(`Production audit: ${checked.vulnerablePackages} vulnerable package(s).`);
  if (checked.acceptedAdvisories.length) {
    console.log(
      `Accepted reviewed static/build-only exceptions: ${checked.acceptedAdvisories.length} advisory/advisories.`,
    );
    checked.acceptedAdvisories.forEach((url) => console.log(`  ${url}`));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`Production audit FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}
