const assert = require("node:assert/strict");
const { test } = require("node:test");
const { mkdtemp, writeFile, readFile, symlink } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { unzipSync, strFromU8 } = require("fflate");
const {
  redactLog,
  createSupportBundle,
  supportSummary,
  buildBugReportUrl,
  allowedBugReportUrl,
  openBugReport,
} = require("./desktop-support.cjs");
const summary = {
  version: "1.0.0",
  os: "macOS",
  mode: "remote",
  language: "ja",
  serverVersion: "1.0.0",
  migrationState: "failed",
};

test("fixture redaction fails closed for every sensitive kind, including arbitrary vault content", async () => {
  const raw = await readFile(path.join(__dirname, "fixtures/support-sensitive.log"), "utf8");
  const output = redactLog(raw);
  for (const sensitive of [
    "SETUP-928384-secret",
    "correct-horse-secret",
    "scrypt",
    "privatehash",
    "SESSION-secret",
    "COOKIE-secret",
    "AUTH-secret",
    "PrivateOwner",
    "PrivateWindows",
    "PrivateLinux",
    "/Users/",
    "C:\\Users\\",
    "$HOME",
    "person-private@example.invalid",
    "PRIVATE",
    "Dragon Red",
    "Moon Knight",
    "army notes",
  ])
    assert.ok(!output.includes(sensitive), sensitive);
  assert.match(output, /startup:failed/);
  assert.match(output, /error:foreign-key/);
  assert.match(output, /error:details-omitted/);
  assert.equal(
    redactLog('PAINTWARDEN_STARTUP {"phase":"PRIVATE"}\nFutureSecret=unknown-format'),
    "[omitted]\n[omitted]\n",
  );
});

test("ZIP includes only known rotating logs and allowlisted summary; no files/vault/symlinks", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pv-support-"));
  const raw = await readFile(path.join(__dirname, "fixtures/support-sensitive.log"), "utf8");
  await writeFile(path.join(directory, "vault-server.log"), raw);
  await writeFile(path.join(directory, "vault-server.log.1"), raw);
  await writeFile(path.join(directory, "vault-desktop.log"), raw);
  await writeFile(path.join(directory, "vault.sqlite"), "PRIVATE DATABASE");
  await symlink(path.join(directory, "vault.sqlite"), path.join(directory, "vault-server.log.2"));
  const files = unzipSync(
    await createSupportBundle(directory, {
      ...summary,
      notes: "PRIVATE",
      recentErrors: ["PRIVATE"],
      serverUrl: "PRIVATE",
    }),
  );
  assert.deepEqual(Object.keys(files).sort(), [
    "logs/vault-desktop.log",
    "logs/vault-server.log",
    "logs/vault-server.log.1",
    "summary.json",
  ]);
  for (const bytes of Object.values(files)) assert.ok(!strFromU8(bytes).includes("PRIVATE"));
  const json = JSON.parse(strFromU8(files["summary.json"]));
  assert.deepEqual(json.recentErrors, ["error:foreign-key", "error:details-omitted"]);
  assert.equal(json.serverVersion, "1.0.0");
});

test("summary and issue URL reject untrusted fields, tokens, paths, versions, locale strings", async () => {
  const safe = supportSummary({
    version: "person@example.com",
    os: "/Users/PRIVATE",
    mode: "remote",
    language: "PRIVATE",
    serverVersion: "https://PRIVATE",
    migrationState: "PRIVATE",
    recentErrors: ["PRIVATE"],
  });
  assert.deepEqual(safe, {
    version: "unknown",
    os: "Other",
    mode: "remote",
    language: "en",
    serverVersion: "unknown",
    migrationState: "idle",
    recentErrors: [],
  });
  const url = buildBugReportUrl(summary);
  assert.ok(allowedBugReportUrl(url));
  assert.equal(new URL(url).searchParams.get("os"), "macOS");
  let opened;
  await openBugReport(summary, async (value) => {
    opened = value;
  });
  assert.equal(opened, url);
  for (const bad of [
    url + "&logs=PRIVATE",
    url + "#PRIVATE",
    url.replace("github.com", "evil.invalid"),
    url.replace("https:", "http:"),
    url.replace("/issues/new", "/issues/new/"),
    url + "&mode=remote",
    url.replace("version=1.0.0", "version=PRIVATE"),
  ])
    assert.equal(allowedBugReportUrl(bad), false, bad);
});
