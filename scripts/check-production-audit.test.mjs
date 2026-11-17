import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { checkAuditResult, checkProductionAudit } from "./check-production-audit.mjs";

const lowUrl = "https://github.com/advisories/GHSA-mh32-jxcr-mh9f";
const moderateUrl = "https://github.com/advisories/GHSA-r3h5-4585-7x3w";
function advisory(url, severity) {
  return {
    source: 12345,
    name: "astro",
    dependency: "astro",
    title: "Reviewed Astro advisory",
    url,
    severity,
    cwe: ["CWE-79"],
    cvss: { score: 0, vectorString: null },
    range: "<=7.4.6",
  };
}
function fixture(withAstro = true) {
  return {
    auditReportVersion: 2,
    vulnerabilities: withAstro
      ? {
          astro: {
            name: "astro",
            severity: "moderate",
            isDirect: true,
            via: [advisory(lowUrl, "low"), advisory(moderateUrl, "moderate")],
            effects: [],
            range: "<=7.4.6",
            nodes: ["node_modules/astro"],
            fixAvailable: { name: "astro", version: "7.4.12", isSemVerMajor: false },
          },
        }
      : {},
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: withAstro ? 1 : 0,
        high: 0,
        critical: 0,
        total: withAstro ? 1 : 0,
      },
      dependencies: { prod: 1, dev: 1, optional: 0, peer: 0, peerOptional: 0, total: 2 },
    },
  };
}
function checked(report, status = 1, astroVersion = "7.4.0") {
  return checkAuditResult({ stdout: JSON.stringify(report), status }, astroVersion);
}

test("clean production audit passes without an Astro exception", () => {
  assert.deepEqual(checked(fixture(false), 0, undefined), { vulnerablePackages: 0, acceptedAdvisories: [] });
});

test("only the two reviewed advisories on locked Astro 7.4.0 are accepted", () => {
  assert.deepEqual(checked(fixture()), { vulnerablePackages: 1, acceptedAdvisories: [lowUrl, moderateUrl] });
  for (const version of [undefined, "7.4.1", "7.4.7", "8.0.0"])
    assert.throws(() => checkProductionAudit(fixture(), version), /locked version/);
});

test("a remaining subset of reviewed advisories is accepted with matching counts", () => {
  const report = fixture();
  report.vulnerabilities.astro.via.pop();
  report.vulnerabilities.astro.severity = "low";
  report.metadata.vulnerabilities.low = 1;
  report.metadata.vulnerabilities.moderate = 0;
  assert.deepEqual(checked(report).acceptedAdvisories, [lowUrl]);
});

test("new advisories under Astro are not hidden by the package exception", () => {
  const report = fixture();
  report.vulnerabilities.astro.via.push(advisory("https://github.com/advisories/GHSA-new-advisory", "low"));
  assert.throws(() => checked(report), /Unreviewed or changed Astro advisory/);
});

test("severity escalation of a known advisory or package fails", () => {
  const advisoryChange = fixture();
  advisoryChange.vulnerabilities.astro.via[0].severity = "high";
  assert.throws(() => checked(advisoryChange), /changed Astro advisory/);
  const packageChange = fixture();
  packageChange.vulnerabilities.astro.severity = "high";
  assert.throws(() => checked(packageChange), /Unreviewed Astro severity/);
});

test("unreviewed packages, indirect entries and nested copies fail", () => {
  const extra = fixture();
  extra.vulnerabilities.other = { name: "other", via: ["astro"] };
  extra.metadata.vulnerabilities.low = 1;
  extra.metadata.vulnerabilities.total = 2;
  assert.throws(() => checked(extra), /Unreviewed production vulnerability: other/);
  for (const mutate of [
    (entry) => (entry.via = ["astro"]),
    (entry) => (entry.effects = ["other"]),
    (entry) => entry.nodes.push("node_modules/other/node_modules/astro"),
    (entry) => (entry.isDirect = false),
  ]) {
    const report = fixture();
    mutate(report.vulnerabilities.astro);
    assert.throws(() => checked(report), /Unrecognized Astro/);
  }
});

test("advisory identity, duplicates and malformed root advisory objects fail", () => {
  for (const mutate of [
    (entry) => (entry.name = "other"),
    (entry) => (entry.dependency = "other"),
    (entry) => delete entry.url,
    (entry) => delete entry.cvss,
    (entry) => (entry.cvss.score = "0"),
    (entry) => (entry.source = 0),
    (entry) => (entry.cwe = "CWE-79"),
    (entry) => (entry.unknownField = true),
  ]) {
    const report = fixture();
    mutate(report.vulnerabilities.astro.via[0]);
    assert.throws(() => checked(report), /Astro advisory/);
  }
  const duplicate = fixture();
  duplicate.vulnerabilities.astro.via.push(duplicate.vulnerabilities.astro.via[0]);
  assert.throws(() => checked(duplicate), /changed Astro advisory/);
});

test("unknown report shapes and audit error reports fail closed", () => {
  for (const report of [null, [], {}, { error: { code: "EAUDITNOLOCK" } }, { auditReportVersion: 3 }])
    assert.throws(() => checked(report), /Invalid npm audit report/);
  const error = fixture(false);
  error.error = { code: "ENOTFOUND", summary: "Registry unavailable" };
  assert.throws(() => checked(error, 0), /Invalid npm audit report/);
  const unknown = fixture();
  unknown.vulnerabilities.astro.unknownField = true;
  assert.throws(() => checked(unknown), /Unrecognized Astro vulnerability/);
});

test("missing or inconsistent metadata cannot hide vulnerabilities", () => {
  for (const mutate of [
    (report) => delete report.metadata,
    (report) => delete report.metadata.vulnerabilities,
    (report) => (report.metadata.dependencies = null),
    (report) => (report.metadata.dependencies = {}),
    (report) => (report.metadata.vulnerabilities.total = 0),
    (report) => (report.metadata.vulnerabilities.high = 1),
    (report) => (report.metadata.vulnerabilities.total = "1"),
    (report) => delete report.metadata.vulnerabilities.low,
  ]) {
    const report = fixture();
    mutate(report);
    assert.throws(() => checked(report), /Invalid npm audit/);
  }
  const counts = fixture();
  counts.metadata.vulnerabilities.moderate = 0;
  counts.metadata.vulnerabilities.low = 1;
  assert.throws(() => checked(counts), /severity counts/);
});

test("command errors, non-audit exit codes, signals and malformed JSON fail", () => {
  for (const result of [
    { status: 2, stderr: "Registry unavailable" },
    { status: null },
    { status: 0, error: new Error("spawn failed") },
    { status: 0, signal: "SIGTERM" },
  ])
    assert.throws(
      () => checkAuditResult({ stdout: JSON.stringify(fixture(false)), ...result }),
      /npm audit failed/,
    );
  for (const stdout of ["", "not JSON", "{", "npm warning\n{}"])
    assert.throws(() => checkAuditResult({ stdout, status: 0 }), /valid JSON/);
});

test("exit status must match whether the audit found vulnerabilities", () => {
  assert.throws(() => checked(fixture(false), 1), /exit status/);
  assert.throws(() => checked(fixture(), 0), /exit status/);
});

test("validator accepts the npm report object without mutating it", () => {
  const report = fixture();
  const before = structuredClone(report);
  checkProductionAudit(report, "7.4.0");
  assert.deepEqual(report, before);
});

// This is a reviewed graph contract, not output regenerated during the test run.
const reviewedPicomatch = JSON.parse(
  fs.readFileSync(new URL("./production-audit-picomatch-reviewed.json", import.meta.url), "utf8"),
);
function picomatchFixture() {
  const report = fixture(false);
  report.vulnerabilities = structuredClone(reviewedPicomatch.vulnerabilities);
  report.metadata.vulnerabilities.high = 11;
  report.metadata.vulnerabilities.total = 11;
  return { report, lock: structuredClone(reviewedPicomatch.lockPackages) };
}
function checkedPicomatch(report, lock) {
  return checkAuditResult({ stdout: JSON.stringify(report), status: 1 }, "7.4.0", lock);
}

test("reviewed picomatch advisory and its exact build-only propagated graph pass", () => {
  const { report, lock } = picomatchFixture();
  assert.deepEqual(checkedPicomatch(report, lock), {
    vulnerablePackages: 11,
    acceptedAdvisories: [lowUrl, moderateUrl, "https://github.com/advisories/GHSA-fc5q-39xc-vjpf"],
  });
});

test("picomatch exception requires the reviewed lock, including every propagated version", () => {
  const { report, lock } = picomatchFixture();
  assert.throws(() => checkedPicomatch(report), /complete lock/);
  for (const location of Object.keys(lock)) {
    const changed = structuredClone(lock);
    changed[location].version += "-changed";
    assert.throws(() => checkedPicomatch(report, changed), /lock version/);
    delete changed[location];
    assert.throws(() => checkedPicomatch(report, changed), /lock version/);
  }
  assert.throws(() => checkProductionAudit(report, "7.4.1", lock), /locked Astro version/);
});

test("new picomatch lock locations and changed dev/runtime classification fail", () => {
  const { report, lock } = picomatchFixture();
  for (const extra of [
    "node_modules/new-runtime-consumer/node_modules/picomatch",
    "apps/paintwarden/node_modules/picomatch",
    "node_modules/new-dev-consumer/node_modules/vite",
  ]) {
    const changed = structuredClone(lock);
    changed[extra] = { version: extra.endsWith("/vite") ? "7.3.7" : "4.0.7", dev: false };
    assert.throws(() => checkedPicomatch(report, changed), /location or development\/runtime/);
  }
  lock["node_modules/micromatch/node_modules/picomatch"].dev = false;
  assert.throws(() => checkedPicomatch(report, lock), /development\/runtime/);
});

test("new, changed, duplicate or malformed advisory objects fail throughout the pinned graph", () => {
  for (const mutate of [
    (r) => r.picomatch.via.push({ ...r.picomatch.via[0], url: "https://github.com/advisories/GHSA-new" }),
    (r) => r.picomatch.via.push(structuredClone(r.picomatch.via[0])),
    (r) => (r.picomatch.via[0].severity = "critical"),
    (r) => (r.picomatch.via[0].range = "<=4.0.8"),
    (r) => (r.picomatch.via[0].source = 1),
    (r) => delete r.picomatch.via[0].cvss,
    (r) => r.vite.via.push({ ...r.picomatch.via[0], name: "vite", dependency: "vite" }),
    (r) => r.astro.via.push(advisory("https://github.com/advisories/GHSA-new", "low")),
    (r) => (r.astro.via.find((v) => typeof v === "object").severity = "high"),
    (r) => r.astro.via.push(structuredClone(r.astro.via.find((v) => typeof v === "object"))),
  ]) {
    const { report, lock } = picomatchFixture();
    mutate(report.vulnerabilities);
    assert.throws(() => checkedPicomatch(report, lock), /Unreviewed picomatch advisory/);
  }
});

test("changed propagation edges, paths, package identity and extra entries fail", () => {
  for (const mutate of [
    (r) => r.picomatch.effects.push("new-runtime-consumer"),
    (r) => r.vite.via.push("other"),
    (r) => r.picomatch.nodes.push("apps/paintwarden/node_modules/picomatch"),
    (r) => (r.anymatch.isDirect = true),
    (r) => (r.unstorage.name = "other"),
    (r) => (r.astro.severity = "critical"),

    (r) => (r.picomatch.unknownField = true),
  ]) {
    const { report, lock } = picomatchFixture();
    mutate(report.vulnerabilities);
    assert.throws(() => checkedPicomatch(report, lock), /Unreviewed picomatch advisory/);
  }
  const { report, lock } = picomatchFixture();
  report.vulnerabilities["new-runtime-consumer"] = {
    name: "new-runtime-consumer",
    via: ["picomatch"],
    fixAvailable: false,
  };
  report.metadata.vulnerabilities.high++;
  report.metadata.vulnerabilities.total++;
  assert.throws(() => checkedPicomatch(report, lock), /Unreviewed picomatch advisory/);
});

test("picomatch severity metadata and npm exit status must agree with the pinned graph", () => {
  const { report, lock } = picomatchFixture();
  assert.throws(
    () => checkAuditResult({ stdout: JSON.stringify(report), status: 0 }, "7.4.0", lock),
    /exit status/,
  );
  report.metadata.vulnerabilities.high--;
  report.metadata.vulnerabilities.moderate++;
  assert.throws(() => checkedPicomatch(report, lock), /severity counts/);
});

test("npm fix recommendations may change without changing installed versions or advisory approval", () => {
  const { report, lock } = picomatchFixture();
  report.vulnerabilities["@astrojs/react"].fixAvailable = {
    name: "@astrojs/react",
    version: "7.1.9",
    isSemVerMajor: false,
  };
  assert.equal(checkedPicomatch(report, lock).vulnerablePackages, 11);
  report.vulnerabilities.picomatch.fixAvailable = true;
  assert.throws(() => checkedPicomatch(report, lock), /Invalid npm fix recommendation/);
});
