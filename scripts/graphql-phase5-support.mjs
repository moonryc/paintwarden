import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { unzipSync, zipSync, strFromU8 } from "fflate";
import { root, outcome, counts } from "./graphql-phase4-support.mjs";
import { fixtureCredentials } from "./smoke-library-native.mjs";

export const checklistNames = [
  "Retired state and changes endpoints return authenticated JSON 404",
  "Demo plugin ZIP installs through production UI and appears in Apollo Library",
  "Real browser backup export contains plugin catalog and image bytes, not account",
  "HTTP merge preserves existing edits and additional records",
  "HTTP replace restores every table and image and preserves account/session",
  "Browser merge and replace controls perform real restore roundtrips",
  "Demo plugin UI removal invalidates Apollo Library",
  "External HTTP plugin install and removal invalidate the mounted Apollo Library",
  "Require-sign-in gates anonymous reads and accepts normal owner UI login",
  "Complete recording has no unplanned retired reads or unmasked errors",
];
export const plannedChecks = () =>
  checklistNames.map((name) => ({
    name,
    status: "NOT RUN",
    reason: "Requires explicit --run against approved stable production artifacts.",
  }));
export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      /password|token|authorization|cookie|setupCode/i.test(key) ? "[REDACTED]" : redact(item),
    ]),
  );
}
export async function scrubLogs(directory) {
  for (const name of await readdir(directory)) {
    if (!name.endsWith(".log")) continue;
    const file = path.join(directory, name);
    const text = await readFile(file, "utf8");
    await writeFile(
      file,
      text
        .replace(/(owner account: )[a-f0-9-]+/gi, "$1[REDACTED]")
        .replaceAll(fixtureCredentials.password, "[REDACTED]"),
    );
  }
}
export async function demoPluginZip() {
  const dir = path.join(root, "examples/demo-plugin");
  const files = {};
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const file = path.join(entry.parentPath, entry.name);
    files[`demo-plugin/${path.relative(dir, file).split(path.sep).join("/")}`] = new Uint8Array(
      await readFile(file),
    );
  }
  assert.ok(files["demo-plugin/source.json"]);
  return Buffer.from(zipSync(files));
}
export function inspectBackup(bytes) {
  const files = unzipSync(new Uint8Array(bytes));
  assert.ok(files["backup.json"], "Production export must be a real backup ZIP");
  const manifest = JSON.parse(strFromU8(files["backup.json"]));
  assert.equal(manifest.format, "paint-vault-backup");
  assert.ok(manifest.tables.paints.length);
  assert.ok(!Object.keys(manifest.tables).some((key) => /account|session|password/i.test(key)));
  const images = Object.fromEntries(
    Object.entries(files)
      .filter(([name]) => name.startsWith("images/") && !name.endsWith("/"))
      .map(([name, data]) => [name, createHash("sha256").update(data).digest("hex")]),
  );
  return { manifest, images, sha256: createHash("sha256").update(bytes).digest("hex") };
}
export function canonicalTables(tables) {
  return Object.fromEntries(
    Object.entries(tables)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, rows]) => [
        name,
        rows
          .map((row) => Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))))
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      ]),
  );
}
export function assertRoundtrip(before, after) {
  assert.deepEqual(
    canonicalTables(after.manifest.tables),
    canonicalTables(before.manifest.tables),
    "Every exported table must roundtrip exactly",
  );
  assert.deepEqual(after.images, before.images, "Every backed-up image must roundtrip byte-for-byte");
}
export async function request(page, route, { method = "GET", json, bytes, expected = 200 } = {}) {
  const result = await page.evaluate(
    async ({ route, method, json, bytes }) => {
      const response = await fetch(route, {
        method,
        headers:
          json !== undefined
            ? { "content-type": "application/json" }
            : bytes
              ? { "content-type": "application/zip" }
              : {},
        body:
          json !== undefined
            ? JSON.stringify(json)
            : bytes
              ? Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0))
              : undefined,
        signal: AbortSignal.timeout(30000),
      });
      return {
        status: response.status,
        body: await response.json(),
        type: response.headers.get("content-type"),
      };
    },
    { route, method, json, bytes: bytes ? Buffer.from(bytes).toString("base64") : undefined },
  );
  assert.equal(result.status, expected, `${method} ${route}: ${JSON.stringify(redact(result.body))}`);
  return result.body;
}
export async function setupOwner(page, setupCode) {
  await page.getByRole("textbox", { name: /^Username/ }).fill(fixtureCredentials.username);
  await page.getByLabel(/^Password/).fill(fixtureCredentials.password);
  if (setupCode) await page.getByRole("textbox", { name: /^Setup code/ }).fill(setupCode);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("button", { name: "Create account", exact: true }).waitFor({ state: "hidden" });
}
export async function signIn(page) {
  await page.getByRole("textbox", { name: /^Username/ }).fill(fixtureCredentials.username);
  await page.getByLabel(/^Password/).fill(fixtureCredentials.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).waitFor({ state: "hidden" });
}
export async function nav(page, name) {
  await page
    .getByRole("button", {
      name: name === "Data & settings" ? /Data & settings$/ : new RegExp(`^${name}(?:\\s|$)`),
    })
    .first()
    .click();
  await page.getByRole("heading", { name, exact: true, level: 2 }).waitFor();
}
export async function librarySearch(page, name, present = true, recorder) {
  await nav(page, "Paints");
  const mark = recorder?.mark();
  const input = page.getByPlaceholder("Search brand, range, or paint…", { exact: true });
  // Clear first to force a real new search even when revisiting the same filter.
  await input.fill("");
  await input.fill(name);
  if (recorder)
    await recorder.waitFor(
      (entries) =>
        entries.some(
          (e) =>
            e.data?.data?.library &&
            e.body?.variables?.search === name &&
            e.data.data.library.nodes.some((paint) => paint.name === name) === present,
        ),
      mark,
    );
  await page
    .getByRole("list", { name: "Paint library", exact: true })
    .getByText(name, { exact: true })
    .waitFor({ state: present ? "visible" : "hidden" });
}
async function exportHttp(page) {
  const response = await page.request.get(new URL("/api/backup", page.url()).href);
  assert.equal(response.status(), 200);
  assert.match(response.headers()["content-type"], /application\/zip/);
  return Buffer.from(await response.body());
}
// Chromium may evict a successful upload body before CDP reads it. Status and
// persisted/UI assertions establish success; diagnostic body reads belong only
// to failures, and a failed diagnostic read must never hide the bad status.
export async function assertResponseStatus(response, expected) {
  const status = response.status();
  if (status === expected) return;
  let detail;
  try {
    detail = await response.text();
  } catch (error) {
    detail = `Response body unavailable: ${error.stack ?? error}`;
  }
  assert.equal(status, expected, detail);
}
async function restoreUi(page, file, mode) {
  await nav(page, "Data & settings");
  await page.locator('input[type="file"]').setInputFiles(file);
  const dialog = page.getByRole("dialog", { name: "Restore backup", exact: true });
  await dialog.waitFor();
  await dialog
    .getByRole("radio", { name: mode === "replace" ? /^Replace this vault/ : /^Merge into this vault/ })
    .check();
  const response = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/backup" && r.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: mode === "replace" ? "Replace vault" : "Merge into vault", exact: true })
    .click();
  const result = await response;
  await assertResponseStatus(result, 200);
  await dialog.waitFor({ state: "hidden" });
}

// Browser/Docker only: real file downloads/uploads, no desktop dialog hooks.
// Host supplies fresh owner-authenticated page and an independent unauthenticated HTTP base.
export async function runPhase5Scenario({ page, recorder, evidenceDir, label, baseUrl }) {
  const checks = plannedChecks();
  const evidence = {};
  let active;
  const check = async (index, fn) => {
    active = checks[index];
    const detail = await fn();
    Object.assign(active, { status: "PASS", evidence: detail });
    delete active.reason;
  };
  const authBefore = await request(page, "/api/auth/status");
  assert.equal(authBefore.authenticated, true);
  let preservedAuth = authBefore;
  const plugin = await demoPluginZip();
  const pluginFile = path.join(evidenceDir, `${label}-demo-plugin.zip`);
  await writeFile(pluginFile, plugin);
  let baseline, backupFile, baselineBytes, sourceId;
  const seedPaint = async (name) =>
    request(page, "/api/catalog", {
      method: "POST",
      json: { paints: [{ brand: "Phase5 isolated", range: "Roundtrip", name, colorHex: "#123456" }] },
      expected: 201,
    });
  const assertAccount = async () => {
    assert.deepEqual(
      await request(page, "/api/auth/status"),
      preservedAuth,
      "Restore must preserve owner, post-export sign-in policy and live session",
    );
  };
  try {
    await check(0, async () => {
      // Use a separate authenticated HTTP session; probes never pollute renderer no-legacy assertions.
      const login = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fixtureCredentials),
        signal: AbortSignal.timeout(15000),
      });
      assert.equal(login.status, 200);
      const { token } = await login.json();
      assert.ok(token);
      const probes = [];
      for (const route of ["/api/state", "/api/changes", "/api/changes?since=0"]) {
        const response = await fetch(`${baseUrl}${route}`, {
          headers: { authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(15000),
        });
        assert.equal(
          response.status,
          404,
          `${route} must really be absent, not hidden behind authentication`,
        );
        assert.match(response.headers.get("content-type"), /application\/json/);
        assert.deepEqual(await response.json(), { error: "Not found" });
        probes.push({ route, status: response.status });
      }
      return probes;
    });
    await check(1, async () => {
      await seedPaint("Phase5 baseline paint");
      await seedPaint("Phase5 recoverable paint");
      const catalog = await request(page, "/api/catalog?q=Phase5%20baseline%20paint&pageSize=100");
      const customId = catalog.items.find((paint) => paint.name === "Phase5 baseline paint").id;
      await request(page, "/api/paint-state", {
        method: "PUT",
        json: { paintId: customId, state: "OWNED", quantity: 3 },
      });
      const scheme = await request(page, "/api/color-schemes", {
        method: "POST",
        expected: 201,
        json: {
          name: "Phase5 backup scheme",
          category: "BLUE",
          entries: [
            { type: "DIVIDER", label: "BASECOAT", tone: "SECTION", role: null },
            { type: "PAINT", paintId: customId },
          ],
        },
      });
      const template = await request(page, "/api/miniature-templates", {
        method: "POST",
        expected: 201,
        json: {
          name: "Phase5 backup template",
          manufacturer: "Synthetic",
          schemeIds: [scheme.id],
          paints: [{ paintId: customId, step: "BASECOAT", notes: "Roundtrip recipe", sortOrder: 0 }],
        },
      });
      const miniature = await request(page, "/api/miniatures", {
        method: "POST",
        expected: 201,
        json: {
          title: "Phase5 backup miniature",
          templateId: template.id,
          notes: "Preserve relationships",
          status: "OWNED",
        },
      });
      evidence.fixtureRecords = {
        customId,
        schemeId: scheme.id,
        templateId: template.id,
        miniatureId: miniature.id,
      };
      await librarySearch(page, "Harbor Blue", false, recorder);
      await nav(page, "Data & settings");
      await page.getByRole("button", { name: "Manage plugins", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Plugins", exact: true });
      await dialog.waitFor();
      const response = page.waitForResponse(
        (r) => new URL(r.url()).pathname === "/api/catalog-sources" && r.request().method() === "POST",
      );
      await dialog.locator('input[type="file"]').setInputFiles(pluginFile);
      const installed = await response;
      await assertResponseStatus(installed, 200);
      await dialog.getByText("Paint Vault demo plugin", { exact: true }).waitFor();
      const { sources } = await request(page, "/api/catalog-sources");
      const source = sources.find((s) => s.name === "Paint Vault demo plugin");
      assert.deepEqual(source.counts, { paints: 8, schemes: 2, templates: 1 });
      sourceId = source.id;
      await dialog.getByRole("button", { name: "Close", exact: true }).first().click();
      await librarySearch(page, "Harbor Blue", true, recorder);
      return { sourceId, counts: source.counts };
    });
    await check(2, async () => {
      await nav(page, "Data & settings");
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export", exact: true }).click();
      const download = await downloadPromise;
      backupFile = path.join(evidenceDir, `${label}-recovery-backup.zip`);
      await download.saveAs(backupFile);
      assert.equal(await download.failure(), null);
      baselineBytes = await readFile(backupFile);
      baseline = inspectBackup(baselineBytes);
      assert.ok(baseline.manifest.tables.plugins.some((p) => p.id === sourceId));
      assert.ok(Object.keys(baseline.images).length > 0, "Demo images must be included");
      // Change a NON-vault account setting after export: restore must not roll it back.
      await request(page, "/api/auth/settings", {
        method: "POST",
        json: { requireSignIn: !authBefore.requireSignIn, password: fixtureCredentials.password },
      });
      preservedAuth = await request(page, "/api/auth/status");
      assert.equal(preservedAuth.requireSignIn, !authBefore.requireSignIn);
      evidence.backup = {
        path: backupFile,
        sha256: baseline.sha256,
        sections: Object.keys(baseline.manifest.tables),
        images: baseline.images,
        postExportAccountPolicyChanged: true,
      };
      return evidence.backup;
    });
    const baselinePaint = () =>
      baseline.manifest.tables.paints.find((p) => p.name === "Phase5 baseline paint");
    const editAndAdd = async (suffix) => {
      const paint = baselinePaint();
      await request(page, `/api/catalog/${encodeURIComponent(paint.id)}`, {
        method: "PUT",
        json: { ...paint, name: `Phase5 edited ${suffix}` },
      });
      await seedPaint(`Phase5 additional ${suffix}`);
      const recoverable = baseline.manifest.tables.paints.find((p) => p.name === "Phase5 recoverable paint");
      await request(page, `/api/catalog/${encodeURIComponent(recoverable.id)}`, { method: "DELETE" });
      assert.ok(
        !inspectBackup(await exportHttp(page)).manifest.tables.paints.some((p) => p.id === recoverable.id),
      );
    };
    await check(3, async () => {
      await editAndAdd("http");
      await request(page, "/api/backup?mode=merge", { method: "POST", bytes: baselineBytes });
      const after = inspectBackup(await exportHttp(page));
      assert.ok(after.manifest.tables.paints.some((p) => p.name === "Phase5 edited http"));
      assert.ok(after.manifest.tables.paints.some((p) => p.name === "Phase5 additional http"));
      assert.ok(
        after.manifest.tables.paints.some((p) => p.name === "Phase5 recoverable paint"),
        "Merge must actually restore a missing row",
      );
      await assertAccount();
      return { editedExistingKept: true, additionalKept: true, missingRowRecovered: true };
    });
    await check(4, async () => {
      // Delete plugin images through production cleanup before restoring, proving real image recovery.
      await request(page, `/api/catalog-sources?id=${encodeURIComponent(sourceId)}`, { method: "DELETE" });
      const withoutPlugin = inspectBackup(await exportHttp(page));
      assert.ok(!withoutPlugin.manifest.tables.plugins.some((p) => p.id === sourceId));
      assert.equal(Object.keys(withoutPlugin.images).length, 0);
      await request(page, "/api/backup?mode=replace", { method: "POST", bytes: baselineBytes });
      assertRoundtrip(baseline, inspectBackup(await exportHttp(page)));
      await assertAccount();
      await librarySearch(page, "Phase5 baseline paint", true, recorder);
      return { allTablesEqual: true, allImageBytesEqual: true, accountAndSessionKept: true };
    });
    await check(5, async () => {
      await editAndAdd("ui");
      await restoreUi(page, backupFile, "merge");
      const merged = inspectBackup(await exportHttp(page));
      assert.ok(merged.manifest.tables.paints.some((p) => p.name === "Phase5 edited ui"));
      assert.ok(merged.manifest.tables.paints.some((p) => p.name === "Phase5 additional ui"));
      assert.ok(merged.manifest.tables.paints.some((p) => p.name === "Phase5 recoverable paint"));
      await assertAccount();
      await restoreUi(page, backupFile, "replace");
      assertRoundtrip(baseline, inspectBackup(await exportHttp(page)));
      await assertAccount();
      await librarySearch(page, "Phase5 baseline paint", true, recorder);
      return { mergeAndReplaceUi: true, allTablesAndImagesEqual: true };
    });
    await check(6, async () => {
      await librarySearch(page, "Harbor Blue", true, recorder);
      await nav(page, "Data & settings");
      await page.getByRole("button", { name: "Manage plugins", exact: true }).click();
      const plugins = page.getByRole("dialog", { name: "Plugins", exact: true });
      await plugins.getByRole("button", { name: "Remove Paint Vault demo plugin", exact: true }).click();
      const removal = page.getByRole("dialog", { name: "Remove Paint Vault demo plugin?", exact: true });
      const response = page.waitForResponse(
        (r) => new URL(r.url()).pathname === "/api/catalog-sources" && r.request().method() === "DELETE",
      );
      await removal.getByRole("button", { name: "Remove plugin", exact: true }).click();
      const removed = await response;
      await assertResponseStatus(removed, 200);
      await removal.waitFor({ state: "hidden" });
      await plugins.getByText("Paint Vault demo plugin", { exact: true }).waitFor({ state: "hidden" });
      await plugins.getByRole("button", { name: "Close", exact: true }).first().click();
      await librarySearch(page, "Harbor Blue", false, recorder);
      return { uiRemoved: true, cachedLibraryUpdated: true };
    });
    await check(7, async () => {
      // Independent HTTP session mutates while the same Library query stays mounted.
      const login = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fixtureCredentials),
        signal: AbortSignal.timeout(15000),
      });
      assert.equal(login.status, 200);
      const { token } = await login.json();
      const external = async (route, method, bytes) => {
        const r = await fetch(`${baseUrl}${route}`, {
          method,
          headers: { authorization: `Bearer ${token}`, "content-type": "application/zip" },
          body: bytes,
          signal: AbortSignal.timeout(30000),
        });
        assert.equal(r.status, 200, await r.clone().text());
        return r.json();
      };
      const mark = recorder.mark();
      await external("/api/catalog-sources", "POST", plugin);
      await page
        .getByRole("list", { name: "Paint library", exact: true })
        .getByText("Harbor Blue", { exact: true })
        .waitFor();
      await recorder.waitFor(
        (entries) => entries.some((e) => e.data?.data?.library?.nodes.some((p) => p.name === "Harbor Blue")),
        mark,
      );
      const { sources } = await request(page, "/api/catalog-sources");
      const id = sources.find((s) => s.name === "Paint Vault demo plugin").id;
      const removalMark = recorder.mark();
      await external(`/api/catalog-sources?id=${encodeURIComponent(id)}`, "DELETE");
      await recorder.waitFor(
        (entries) =>
          entries.some(
            (entry) =>
              entry.body?.variables?.search === "Harbor Blue" &&
              entry.data?.data?.library &&
              !entry.data.data.library.nodes.some((paint) => paint.name === "Harbor Blue"),
          ),
        removalMark,
      );
      await page
        .getByRole("list", { name: "Paint library", exact: true })
        .getByText("Harbor Blue", { exact: true })
        .waitFor({ state: "hidden" });
      return { externalInstallAndRemove: true, mountedLibraryUpdatedWithoutReload: true };
    });
    await check(8, async () => {
      // The post-export account setting is still off after all restore modes.
      assert.equal(preservedAuth.requireSignIn, false);
      const openRead = await fetch(`${baseUrl}/api/graphql`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "query { library(first: 1) { nodes { id } } }" }),
        signal: AbortSignal.timeout(15000),
      });
      assert.equal(openRead.status, 200, "Sign-in-off must retain anonymous vault access");
      const openData = await openRead.json();
      assert.ok(openData.data?.library);
      assert.ok(!openData.errors?.length);
      await request(page, "/api/auth/settings", {
        method: "POST",
        json: { requireSignIn: true, password: fixtureCredentials.password },
      });
      for (const route of ["/api/backup", "/api/catalog-sources", "/api/graphql"]) {
        const r = await fetch(`${baseUrl}${route}`, {
          method: route === "/api/graphql" ? "POST" : "GET",
          headers: { "content-type": "application/json" },
          body:
            route === "/api/graphql"
              ? JSON.stringify({ query: "query { library(first: 1) { nodes { id } } }" })
              : undefined,
          signal: AbortSignal.timeout(15000),
        });
        assert.equal(r.status, 401, `Anonymous ${route} must be denied`);
      }
      await nav(page, "Data & settings");
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await page.getByRole("button", { name: "Sign in", exact: true }).waitFor();
      await signIn(page);
      await librarySearch(page, "Phase5 baseline paint", true, recorder);
      await request(page, "/api/auth/settings", {
        method: "POST",
        json: { requireSignIn: authBefore.requireSignIn, password: fixtureCredentials.password },
      });
      preservedAuth = authBefore;
      await assertAccount();
      return {
        signInOffAnonymousRead: true,
        anonymousDenied: ["backup", "plugins", "graphql"],
        uiSignIn: true,
        originalPolicyRestored: true,
      };
    });
    await check(9, async () => {
      await recorder.settle();
      assert.deepEqual(
        recorder.requests.filter((e) => /^\/api\/(state|changes)(\/|$)/.test(e.path)),
        [],
      );
      assert.deepEqual(recorder.errors, []);
      assert.deepEqual(
        recorder.requests.filter((e) => e.status >= 400 || e.data?.errors?.length),
        [],
        "No renderer request errors may be masked",
      );
      assert.ok(recorder.requests.some((e) => e.path === "/api/graphql/stream" && e.status === 200));
      return { requests: recorder.requests.length, rendererErrors: 0 };
    });
  } catch (error) {
    Object.assign(active ?? checks[0], { status: "FAIL", detail: error.stack });
    await page
      .screenshot({ path: path.join(evidenceDir, `${label}-failure.png`) })
      .catch((captureError) =>
        checks.push({ name: "Failure screenshot", status: "FAIL", detail: captureError.stack }),
      );
  }
  return { checks, evidence, result: outcome(checks), counts: counts(checks) };
}
