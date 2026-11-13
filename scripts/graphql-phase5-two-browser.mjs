#!/usr/bin/env node
// Two actual independently authenticated Chromium contexts, ordinary stock controls.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createLibraryFixture } from "./library-fixture.mjs";
import { attachLibraryRecorder } from "./library-smoke-support.mjs";
import { root, sourceManifest } from "./graphql-phase4-support.mjs";
import {
  freePort,
  launchOwned,
  waitForOutput,
  stopOwned,
  fixtureCredentials,
  identity,
} from "./smoke-library-native.mjs";

assert.equal(process.version, "v22.22.2");
const [profile, output, approval] = process.argv.slice(2);
assert.ok(
  ["large", "stress"].includes(profile) && output && approval === "--run",
  "large|stress EVIDENCE --run",
);
const dir = path.resolve(output),
  dist = path.join(root, "apps/paint-vault/dist");
await mkdir(dir, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  profile,
  checks: [],
  scope:
    "Two real browser contexts, separate owner sessions. Bidirectional user stock edits, mounted Library and live subscription, no reload/navigation between edits. Exact Phase0 base fixture; performance not measured.",
};
let server, browser;
const recordings = [];
try {
  report.source = await sourceManifest();
  report.artifacts = await Promise.all([
    identity(path.join(dist, "server.mjs")),
    identity(path.join(dist, "schema.graphql")),
  ]);
  report.fixture = await createLibraryFixture(root, profile);
  const port = await freePort(),
    host = `phase5-two-${profile}.localhost`,
    base = `http://${host}:${port}`;
  server = launchOwned(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'process.env.NODE_ENV="test";const {startServer}=await import("./server.mjs");process.env.NODE_ENV="production";await startServer();console.log("TWO_BROWSER_READY");',
    ],
    {
      cwd: dist,
      env: {
        ...process.env,
        NODE_ENV: "production",
        DATA_DIR: report.fixture.dataDir,
        DATABASE_PATH: "",
        HOST: "127.0.0.1",
        PORT: String(port),
        PAINT_VAULT_ALLOWED_HOSTS: host,
      },
    },
    path.join(dir, "server.log"),
  );
  await waitForOutput(server, /TWO_BROWSER_READY/, "two-browser server");
  const authenticate = async (route) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/auth/${route}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fixtureCredentials),
    });
    assert.equal(response.status, 200);
    const { token } = await response.json();
    assert.ok(token);
    return token;
  };
  const tokens = [await authenticate("setup"), await authenticate("login")];
  assert.notEqual(tokens[0], tokens[1], "Independent sessions, not the same injected bearer");
  browser = await chromium.launch({ headless: true, args: [`--host-resolver-rules=MAP ${host} 127.0.0.1`] });
  const clients = [];
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([
      { name: "pv_session", value: tokens[i], url: base, httpOnly: true, sameSite: "Strict" },
    ]);
    const page = await context.newPage(),
      recorder = attachLibraryRecorder(page);
    recordings.push({ client: i + 1, recorder });
    await page.goto(`${base}/#paints`);
    await page.getByRole("heading", { name: "Paints", exact: true, level: 2 }).waitFor();
    await page.getByPlaceholder("Search brand, range, or paint…", { exact: true }).fill("Paint 00001");
    const quantity = page.getByRole("textbox", { name: "Paint 00001 quantity", exact: true });
    await quantity.waitFor();
    await recorder.waitFor((entries) => entries.some((e) => e.path === "/api/graphql/stream"));
    assert.equal(await quantity.inputValue(), "2");
    clients.push({ page, recorder, quantity });
  }
  for (const [writer, reader, value] of [
    [0, 1, "7"],
    [1, 0, "9"],
  ]) {
    const mark = clients[reader].recorder.mark();
    await clients[writer].quantity.fill(value);
    await clients[writer].quantity.blur();
    await clients[writer].page.waitForFunction(
      (value) => document.querySelector('input[aria-label="Paint 00001 quantity"]')?.value === value,
      value,
    );
    await clients[reader].recorder.waitFor(
      (entries) =>
        entries.some((e) =>
          e.data?.data?.library?.nodes.some(
            (p) => p.name === "Paint 00001" && p.inventory?.quantity === Number(value),
          ),
        ),
      mark,
    );
    assert.equal(await clients[reader].quantity.inputValue(), value);
    report.checks.push({
      status: "PASS",
      name: `Browser${writer + 1} stock${value} visibly reaches mounted Browser${reader + 1} by SSE`,
    });
  }
  for (let i = 0; i < clients.length; i++) {
    await clients[i].recorder.settle();
    const { requests, errors } = clients[i].recorder;
    assert.deepEqual(errors, []);
    assert.deepEqual(
      requests.filter(
        (e) =>
          /^\/api\/(state|changes)(?:\/|$)/.test(e.path) ||
          e.status >= 400 ||
          e.readError ||
          e.data?.errors?.length,
      ),
      [],
    );
    await clients[i].page.screenshot({
      path: path.join(dir, `client-${i + 1}-stock9.png`),
      animations: "disabled",
    });
  }
  report.checks.push({
    status: "PASS",
    name: "Both complete recordings have zero retired requests, HTTP/GraphQL/renderer errors",
  });
  assert.equal((await sourceManifest()).manifestSha256, report.source.manifestSha256);
  for (const item of report.artifacts) assert.equal((await identity(item.path)).sha256, item.sha256);
  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) {
    await stopOwned(server.child);
    await server.save();
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(dir, "results.json"), JSON.stringify(report, null, 2) + "\n");
  await writeFile(
    path.join(dir, "raw-evidence.json"),
    JSON.stringify(
      recordings.map(({ client, recorder }) => ({
        client,
        requests: recorder.requests,
        errors: recorder.errors,
      })),
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ result: report.result, checks: report.checks, error: report.error }, null, 2));
}
