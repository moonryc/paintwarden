// Run only after npm run build. Owns its production server, temp vault and browser.
// node e2e/plugin-install-smoke.mjs --width=1440 --zip=/absolute/synthetic-large.zip --artifacts=/absolute/evidence
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import Database from "better-sqlite3";
import { chromium } from "playwright";
import {
  authenticatePluginFixture,
  observePluginStreams,
  runPluginInstallFlow,
} from "./plugin-install-flow.mjs";
const { values } = parseArgs({
  options: {
    width: { type: "string", default: "1440" },
    zip: { type: "string" },
    artifacts: { type: "string" },
  },
});
const width = Number(values.width);
assert.ok([390, 1440].includes(width));
assert.ok(values.zip, "--zip is required");
const repo = path.resolve(import.meta.dirname, "..");
const artifacts = path.resolve(values.artifacts ?? `outputs/plugin-install-${width}`);
const dataDir = await mkdtemp(path.join(os.tmpdir(), `paintwarden-plugin-${width}-`));
await mkdir(artifacts, { recursive: true });
await access(values.zip);
const socket = net.createServer();
await new Promise((resolve, reject) => {
  socket.once("error", reject);
  socket.listen(0, "127.0.0.1", resolve);
});
const { port } = socket.address();
await new Promise((resolve) => socket.close(resolve));
assert.ok(port !== 3000 && port !== 3175, "Must not touch personal or reserved servers");
const env = {
  ...process.env,
  NODE_ENV: "production",
  HOST: "127.0.0.1",
  PORT: String(port),
  DATA_DIR: dataDir,
};
for (const name of [
  "DATABASE_PATH",
  "PAINTWARDEN_DESKTOP",
  "PAINTWARDEN_TRUST_PROXY",
  "PAINTWARDEN_ALLOWED_HOSTS",
  "WEB_DIST",
])
  delete env[name];
const child = spawn(process.execPath, ["server.mjs"], {
  cwd: path.join(repo, "apps/paintwarden/dist"),
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "",
  browser;
const results = {
  width,
  startedAt: new Date().toISOString(),
  origin: `http://127.0.0.1:${port}`,
  dataDir,
  checks: [],
  errors: [],
};
child.stdout.on("data", (data) => {
  log += data;
});
child.stderr.on("data", (data) => {
  log += data;
});
const interrupt = () => {
  child.kill("SIGTERM");
  void browser?.close();
};
process.once("SIGINT", interrupt);
process.once("SIGTERM", interrupt);
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(Error("Owned production server readiness timed out")), 30_000);
    const onData = () => {
      if (log.includes('"phase":"ready"')) finish();
    };
    const onExit = (code) => finish(Error(`Owned server exited ${code}: ${log}`));
    const finish = (error) => {
      clearTimeout(timeout);
      child.stdout.off("data", onData);
      child.off("exit", onExit);
      error ? reject(error) : resolve();
    };
    child.stdout.on("data", onData);
    child.once("exit", onExit);
    child.once("error", finish);
    onData();
  });
  browser = await chromium.launch({ headless: true });
  const pages = [];
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({
      baseURL: results.origin,
      viewport: { width, height: width === 390 ? 844 : 1050 },
      locale: "en-US",
      reducedMotion: "reduce",
      colorScheme: "light",
    });
    context.setDefaultTimeout(20_000);
    await context.addInitScript(observePluginStreams);
    const page = await context.newPage();
    page.on("pageerror", (error) => results.errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") console.error("BROWSER", message.text());
    });
    page.on("response", (response) => {
      if (response.url().endsWith("/api/graphql"))
        void response
          .json()
          .then((body) => {
            if (body.errors) console.error("GRAPHQL", JSON.stringify(body));
          })
          .catch(() => {});
    });
    await authenticatePluginFixture(page, { setup: i === 0 });
    pages.push(page);
  }
  const firstSession = (await pages[0].context().cookies()).find((cookie) => cookie.name === "pv_session");
  const secondSession = (await pages[1].context().cookies()).find((cookie) => cookie.name === "pv_session");
  assert.ok(
    firstSession && secondSession && firstSession.value !== secondSession.value,
    "Clients must have independently authenticated sessions",
  );
  async function inspectDisk(cancelled) {
    const db = new Database(path.join(dataDir, "paintwarden.sqlite"), { readonly: true });
    try {
      const count = db.prepare("select count(*) as n from catalog_source_items").get().n;
      assert.equal(count, cancelled ? 0 : 3800);
    } finally {
      db.close();
    }
    const images = await readdir(path.join(dataDir, "images")).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    assert.equal(
      images.filter((name) => !name.includes(".thumb-v1-") && !name.startsWith(".")).length,
      cancelled ? 0 : 800,
      "Cancellation leaves no final images; success promotes all images",
    );
    const stages = await readdir(path.join(dataDir, ".plugin-staging")).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    assert.deepEqual(stages, [], "Terminal jobs leave no private staging directories");
    results[cancelled ? "cancelledDisk" : "completedDisk"] = {
      sourceItems: cancelled ? 0 : 3800,
      finalImages: images.filter((name) => !name.includes(".thumb-v1-") && !name.startsWith(".")).length,
      thumbnailFiles: images.filter((name) => name.includes(".thumb-v1-")).length,
    };
  }
  await runPluginInstallFlow({
    page: pages[0],
    observerPage: pages[1],
    width,
    artifacts,
    zipPath: path.resolve(values.zip),
    results,
    verifyCancelled: () => inspectDisk(true),
    verifyComplete: () => inspectDisk(false),
  });
  assert.deepEqual(results.errors, []);
  results.status = "PASS";
} catch (error) {
  results.status = "FAIL";
  results.errors.push(error.stack ?? String(error));
  console.error(error);
  for (const context of browser?.contexts() ?? [])
    for (const page of context.pages())
      await page
        .screenshot({
          path: path.join(artifacts, `${width}-failure-${browser.contexts().indexOf(context)}.png`),
          fullPage: true,
        })
        .catch(() => {});
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
  }
  results.finishedAt = new Date().toISOString();
  await writeFile(path.join(artifacts, `${width}-results.json`), JSON.stringify(results, null, 2));
  await writeFile(path.join(artifacts, `${width}-server.log`), log);
  console.log(
    JSON.stringify({ status: results.status, width, artifacts, dataDir, errors: results.errors }, null, 2),
  );
}
