import assert from "node:assert/strict";
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
