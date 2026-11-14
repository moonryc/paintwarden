import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { unzipSync, zipSync, strFromU8 } from "fflate";
import {
  assertResponseStatus,
  canonicalTables,
  inspectBackup,
  assertRoundtrip,
  demoPluginZip,
  plannedChecks,
  redact,
} from "./graphql-phase5-support.mjs";
import { parseOptions as runtimeOptions } from "./graphql-phase5-runtime.mjs";
import { parseOptions as nativeOptions, nativeCheckNames } from "./graphql-phase5-native.mjs";

const backup = (tables, image = [1, 2, 3]) =>
  Buffer.from(
    zipSync({
      "backup.json": Buffer.from(JSON.stringify({ format: "paintwarden-backup", tables })),
      "images/fixture.png": new Uint8Array(image),
    }),
  );
test("successful UI status assertions never eagerly read CDP bodies; bad statuses remain failures", async () => {
  let reads = 0;
  const response = (status, unavailable = false) => ({
    status: () => status,
    text: async () => {
      reads++;
      if (unavailable) throw new Error("inspector-cache-eviction");
      return "production failure detail";
    },
  });
  await assertResponseStatus(response(200, true), 200);
  assert.equal(reads, 0);
  await assert.rejects(assertResponseStatus(response(500), 200), /production failure detail/);
  await assert.rejects(assertResponseStatus(response(500, true), 200), /inspector-cache-eviction/);
  assert.equal(reads, 2);
});
test("Phase5 plans are explicit NOT RUN rather than manufactured acceptance", () => {
  assert.equal(plannedChecks().length, 10);
  assert.ok(plannedChecks().every((check) => check.status === "NOT RUN"));
  assert.equal(nativeCheckNames.length, 7);
  assert.equal(runtimeOptions(["/tmp/phase5-plan"], "browser").run, false);
  assert.equal(nativeOptions(["/tmp/phase5-plan", "--plan"]).run, false);
  assert.throws(() => runtimeOptions(["/tmp/plan", "--run", "--plan"], "browser"));
  assert.throws(() => nativeOptions(["/tmp/plan", "--run", "--plan"]));
  assert.throws(() => runtimeOptions(["/tmp/plan", "--run"], "docker"));
  assert.throws(() => runtimeOptions(["/tmp/plan", "--image"], "docker"));
  assert.throws(() => runtimeOptions(["/tmp/plan", "--unknown"], "browser"));
});
test("backup verifier accepts row/key order changes but rejects lost/changed data or image bytes", () => {
  const a = {
    paints: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ],
    miniatures: [],
  };
  const b = {
    miniatures: [],
    paints: [
      { name: "B", id: "b" },
      { name: "A", id: "a" },
    ],
  };
  assert.deepEqual(canonicalTables(a), canonicalTables(b));
  assertRoundtrip(inspectBackup(backup(a)), inspectBackup(backup(b)));
  assert.throws(() =>
    assertRoundtrip(inspectBackup(backup(a)), inspectBackup(backup({ ...a, paints: [a.paints[0]] }))),
  );
  assert.throws(() => assertRoundtrip(inspectBackup(backup(a)), inspectBackup(backup(a, [3, 2, 1]))));
  assert.throws(() => inspectBackup(Buffer.from("not a zip")));
  assert.throws(() => inspectBackup(backup({ ...a, accounts: [] })));
});
test("actual demo ZIP contains the manifest, catalog, logo and every declared asset", async () => {
  const files = unzipSync(await demoPluginZip());
  const json = (name) => JSON.parse(strFromU8(files[`demo-plugin/${name}`]));
  assert.equal(json("source.json").name, "Paintwarden demo plugin");
  const catalog = json("catalog.json");
  assert.equal(catalog.paints.length, 8);
  assert.equal(catalog.schemes.length, 2);
  assert.equal(catalog.templates.length, 1);
  assert.ok(files["demo-plugin/logo.svg"]);
  for (const name of Object.keys(json("assets.json"))) assert.ok(files[`demo-plugin/${name}`], name);
});
test("evidence redaction keeps failures and statuses, removes credentials recursively", () => {
  const raw = {
    status: 401,
    body: { password: "secret", token: "abc", error: "Sign in required" },
    authorization: "Bearer xyz",
    requests: [{ cookie: "x", nested: { setupCode: "setup" } }],
  };
  const clean = redact(raw);
  assert.equal(clean.status, 401);
  assert.equal(clean.body.error, "Sign in required");
  for (const word of ["secret", "abc", "xyz", 'setup"']) assert.ok(!JSON.stringify(clean).includes(word));
  assert.equal(raw.body.password, "secret", "Redaction must not alter live assertions");
});
test("native switch actions use real UI controls; production bridge is read-only observation", async () => {
  const source = await readFile(new URL("./graphql-phase5-native.mjs", import.meta.url), "utf8");
  assert.match(source, /name: "Change server"/);
  assert.match(source, /name: "Use this computer"/);
  assert.match(source, /name: "Connect to server"/);
  assert.match(source, /window\.paintwardenDesktop\.getConnection\(\)/);
  assert.doesNotMatch(
    source,
    /paintwardenDesktop\.setConnection|localStorage\.setItem|addInitScript|executeJavaScript/,
  );
  assert.match(source, /profileCount: 1/);
  assert.match(source, /relaunch\("remote"/);
  assert.match(source, /relaunch\("local", "final-local"/);
});
