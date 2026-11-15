import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import { buildDemoPlugin } from "../../../scripts/package-demo-plugin.mjs";

const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-install-jobs-"));
process.env.DATA_DIR = directory;
process.env.NODE_ENV = "test";
delete process.env.DATABASE_PATH;
const {
  startPluginInstall,
  currentPluginInstallJob,
  cancelPluginInstall,
  watchPluginInstall,
  pluginInstallRunning,
} = await import("./catalog-install-jobs.ts");
const { routeApi } = await import("../server/api-router.ts");
const { getSqlite } = await import("../db/index.ts");
const database = getSqlite();
const token = "b".repeat(64);
const hash = createHash("sha256").update(token).digest("hex");
database
  .prepare(
    "INSERT INTO vault_account(id,username,password_hash,require_sign_in) VALUES(1,'fixture','not-a-real-password',1)",
  )
  .run();
database
  .prepare("INSERT INTO vault_sessions(token_hash,expires_at) VALUES(?,?)")
  .run(hash, Date.now() + 60_000);
const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
const base = "http://127.0.0.1:3999";
const fields = "id stage done total percent cancellable error errorCode errorParameters{name value}";
const query = `{pluginInstallJob{${fields}}}`;
function api(body: unknown, endpoint = "/api/graphql", signal?: AbortSignal) {
  return routeApi(
    new Request(base + endpoint, { method: "POST", headers, body: JSON.stringify(body), signal }),
  );
}
async function settled() {
  const stream = watchPluginInstall(new AbortController().signal, 10);
  try {
    for await (const job of stream) if (job && !pluginInstallRunning()) return job;
    throw new Error("Missing terminal install snapshot");
  } finally {
    await stream.return();
  }
}
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
test.after(() => {
  database.close();
  rmSync(directory, { recursive: true, force: true });
  rmSync(`${directory}.plugin-uploads`, { recursive: true, force: true });
  rmSync(`${directory}.plugin-staging`, { recursive: true, force: true });
});

test("job reservation, bounded progress, reload snapshots, abort cleanup, and commit cancellation boundary", async () => {
  assert.equal(currentPluginInstallJob(), null);
  const gate = deferred();
  const cleanup = deferred();
  const initial = startPluginInstall(async (context) => {
    context.progress!("images", 2, 4);
    await gate.promise;
    assert.equal(context.signal!.aborted, true);
    await cleanup.promise;
    context.signal!.throwIfAborted();
  });
  assert.equal(initial.stage, "READING");
  await setImmediate();
  assert.throws(() => startPluginInstall(async () => {}), /already running/);
  const first = watchPluginInstall(new AbortController().signal);
  assert.equal((await first.next()).value?.percent, 47.5);
  await first.return();
  const reloaded = await api({ query });
  assert.equal(reloaded.status, 200);
  const body = (await reloaded.json()) as { data: { pluginInstallJob: { id: string; stage: string } } };
  assert.equal(body.data.pluginInstallJob.id, initial.id);
  assert.equal(body.data.pluginInstallJob.stage, "IMAGES");
  assert.equal(cancelPluginInstall("missing"), null);
  assert.equal(cancelPluginInstall(initial.id)?.cancellable, false);
  gate.release();
  await setImmediate();
  assert.equal(pluginInstallRunning(), true, "lock stays held until rollback cleanup completes");
  assert.equal(currentPluginInstallJob()?.stage, "IMAGES", "never announce cancel before cleanup");
  cleanup.release();
  assert.equal((await settled()).stage, "CANCELLED");
  const commit = deferred();
  const job = startPluginInstall(async (context) => {
    context.progress!("committing", 0, 1);
    await commit.promise;
    assert.equal(context.signal!.aborted, false);
  });
  await setImmediate();
  assert.equal(cancelPluginInstall(job.id)?.stage, "COMMITTING");
  commit.release();
  assert.equal((await settled()).stage, "SUCCEEDED");
});

test("failure releases reservation and subscription can reattach to terminal snapshot", async () => {
  const job = startPluginInstall(async () => {
    throw new Error("A plugin install is already running");
  });
  const result = await settled();
  assert.equal(result.stage, "FAILED");
  assert.equal(result.id, job.id);
  assert.equal(result.errorCode, "PLUGIN_INSTALL_ALREADY_RUNNING");
  const abort = new AbortController();
  const response = await routeApi(
    new Request(base + "/api/graphql/stream", {
      method: "POST",
      signal: abort.signal,
      headers: { ...headers, accept: "text/event-stream" },
      body: JSON.stringify({ query: `subscription{pluginInstallProgress{${fields}}}` }),
    }),
  );
  assert.equal(response.status, 200);
  const reader = response.body!.getReader();
  try {
    let frame = "";
    while (!frame.includes("data: ")) frame += new TextDecoder().decode((await reader.read()).value);
    assert.match(frame, /FAILED/);
    assert.match(frame, new RegExp(job.id));
  } finally {
    abort.abort();
    await reader.cancel();
  }
});

test("REST streams ZIP to a job, refuses overlap, and preserves the original deletion API", async () => {
  const zip = buildDemoPlugin();
  const response = await routeApi(
    new Request(base + "/api/catalog-sources", {
      method: "POST",
      headers: { authorization: headers.authorization, "content-type": "application/zip" },
      body: zip,
    }),
  );
  assert.equal(response.status, 202);
  const accepted = (await response.json()) as { job: { id: string } };
  assert.ok(accepted.job.id);
  const overlap = await api({ url: "example/fixture" }, "/api/catalog-sources");
  assert.equal(overlap.status, 409);
  assert.equal((await settled()).stage, "SUCCEEDED");
  assert.equal((database.prepare("SELECT count(*) AS n FROM paint_catalog").get() as { n: number }).n, 8);
  const missing = await routeApi(
    new Request(base + "/api/catalog-sources?job=missing", { method: "DELETE", headers }),
  );
  assert.equal(missing.status, 404);
  const source = database.prepare("SELECT id FROM catalog_sources").get() as { id: string };
  const removed = await routeApi(
    new Request(`${base}/api/catalog-sources?id=${source.id}`, { method: "DELETE", headers }),
  );
  assert.equal(removed.status, 200);
  assert.equal((database.prepare("SELECT count(*) AS n FROM paint_catalog").get() as { n: number }).n, 0);
});

test(
  "progress subscriptions recheck session access on heartbeat and reject foreign origins",
  { timeout: 5_000 },
  async () => {
    const { subscribePluginInstall } = await import("../graphql/install-jobs.ts");
    const stream = subscribePluginInstall(new Request(base + "/api/graphql/stream", { headers }));
    try {
      const first = await stream.next();
      assert.equal(first.done, false);
      database.prepare("DELETE FROM vault_sessions WHERE token_hash=?").run(hash);
      await assert.rejects(stream.next(), /Vault access ended/);
    } finally {
      await stream.return();
      database
        .prepare("INSERT OR REPLACE INTO vault_sessions(token_hash,expires_at) VALUES(?,?)")
        .run(hash, Date.now() + 60_000);
    }
    const foreign = subscribePluginInstall(
      new Request(base + "/api/graphql/stream", {
        headers: { ...headers, origin: "https://foreign.example" },
      }),
    );
    await assert.rejects(foreign.next(), /Vault access ended/);
    await foreign.return();
  },
);
