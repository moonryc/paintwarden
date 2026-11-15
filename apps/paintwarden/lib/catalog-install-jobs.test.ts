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

void test("automatic refresh with no sources never creates the first install job", async () => {
  assert.equal(currentPluginInstallJob(), null);
  const response = await routeApi(
    new Request(base + "/api/catalog-sources?automatic=1", { method: "PUT", headers }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { job: null, versions: [] });
  assert.equal(currentPluginInstallJob(), null);
  assert.equal(pluginInstallRunning(), false);
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

void test("automatic refresh skips no-ops, reuses manifest probes, and cannot replace racing jobs", async (t) => {
  const {
    addCatalogSource,
    addUploadedCatalogSource,
    cachedCatalogSourceVersions,
    listCatalogSources,
    removeCatalogSource,
  } = await import("./catalog-sources.ts");
  const originalFetch = globalThis.fetch;
  let version = "1.0.0";
  let offline = false;
  let probeGate: ReturnType<typeof deferred> | undefined;
  let probeStarted: ReturnType<typeof deferred> | undefined;
  let catalogGate: ReturnType<typeof deferred> | undefined;
  const requests: string[] = [];
  const refresh = () =>
    routeApi(new Request(base + "/api/catalog-sources?automatic=1", { method: "PUT", headers }));
  const rows = () => database.prepare("SELECT * FROM catalog_sources ORDER BY id").all();
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push(url.href);
    if (offline) throw new Error("Offline test");
    const repo = url.hostname === "api.github.com" ? url.pathname.split("/")[3] : url.pathname.split("/")[2];
    if (url.pathname.endsWith(`/repos/automatic/${repo}`)) return Response.json({ default_branch: "main" });
    if (url.pathname.endsWith("/commits/main")) {
      probeStarted?.release();
      await probeGate?.promise;
      return Response.json({ sha: "a".repeat(40) });
    }
    if (url.pathname.endsWith("/contents/source.json"))
      return Response.json({
        encoding: "base64",
        content: Buffer.from(
          JSON.stringify({
            formatVersion: 1,
            name: repo,
            version: repo === "root" ? version : "1.0.0",
            dependencies: repo === "root" ? [{ repository: "automatic/dependency" }] : [],
            catalog: "catalog.json",
            assets: "assets.json",
          }),
        ).toString("base64"),
      });
    if (url.pathname.endsWith("/catalog.json")) {
      await catalogGate?.promise;
      return Response.json({ paints: [], schemes: [], templates: [] });
    }
    if (url.pathname.endsWith("/assets.json")) return Response.json({});
    return new Response(null, { status: 404 });
  };
  try {
    await t.test("uploaded-only sources have no automatic work", async () => {
      await addUploadedCatalogSource(buildDemoPlugin());
      const before = rows();
      const latest = currentPluginInstallJob();
      const response = await refresh();
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.job, null);
      assert.deepEqual(result.versions, cachedCatalogSourceVersions());
      assert.deepEqual(rows(), before);
      assert.deepEqual(currentPluginInstallJob(), latest);
      assert.equal(requests.length, 0);
      await removeCatalogSource(listCatalogSources()[0].id);
    });
    await addCatalogSource("automatic/root");
    await t.test("current, older, and unreachable sources create no job and do not write", async () => {
      for (const state of ["current", "older", "offline"]) {
        version = state === "older" ? "0.9.0" : "1.0.0";
        offline = state === "offline";
        requests.length = 0;
        const before = rows();
        const latest = currentPluginInstallJob();
        const response = await refresh();
        assert.equal(response.status, 200, state);
        const result = await response.json();
        assert.equal(result.job, null, state);
        assert.deepEqual(result.versions, cachedCatalogSourceVersions());
        assert.deepEqual(rows(), before);
        assert.deepEqual(currentPluginInstallJob(), latest);
        assert.equal(pluginInstallRunning(), false);
        assert.ok(requests.every((url) => url.startsWith("https://api.github.com/")));
        if (offline) assert.ok(result.versions.every((row: { error?: string }) => row.error));
        else
          assert.ok(
            result.versions.every((row: { updateAvailable?: boolean }) => row.updateAvailable === false),
          );
      }
      offline = false;
    });
    await t.test("concurrent automatic updates share one observable job and pinned manifests", async () => {
      version = "1.1.0";
      requests.length = 0;
      probeGate = deferred();
      probeStarted = deferred();
      catalogGate = deferred();
      const first = refresh();
      await probeStarted.promise;
      const second = refresh();
      await setImmediate();
      probeGate.release();
      const [response, overlap] = await Promise.all([first, second]);
      assert.equal(response.status, 202);
      assert.equal(overlap.status, 202);
      const accepted = await response.json();
      assert.equal((await overlap.json()).job.id, accepted.job.id);
      assert.equal(currentPluginInstallJob()?.id, accepted.job.id);
      assert.equal(pluginInstallRunning(), true);
      const snapshot = await api({ query });
      assert.equal((await snapshot.json()).data.pluginInstallJob.id, accepted.job.id);
      const before = requests.length;
      assert.equal((await refresh()).status, 409);
      assert.equal(requests.length, before, "running install skips automatic network probes");
      catalogGate.release();
      assert.equal((await settled()).stage, "SUCCEEDED");
      assert.equal(currentPluginInstallJob()?.id, accepted.job.id);
      assert.equal(
        listCatalogSources().find((source) => source.repository === "automatic/root")?.version,
        "1.1.0",
      );
      assert.equal(requests.filter((url) => url.includes("/contents/source.json")).length, 2);
      assert.equal(requests.filter((url) => url.includes("/commits/")).length, 2);
      assert.equal(requests.filter((url) => url.endsWith("/catalog.json")).length, 1);
      probeGate = probeStarted = catalogGate = undefined;
    });
    for (const finishBeforeProbe of [false, true]) {
      await t.test(
        `manual job ${finishBeforeProbe ? "completed" : "running"} during preflight is never replaced`,
        async () => {
          version = "1.2.0";
          probeGate = deferred();
          probeStarted = deferred();
          const response = refresh();
          await probeStarted.promise;
          const manualGate = deferred();
          const manual = startPluginInstall(() => manualGate.promise);
          if (finishBeforeProbe) {
            manualGate.release();
            await settled();
          }
          probeGate.release();
          assert.equal((await response).status, 409);
          assert.equal(currentPluginInstallJob()?.id, manual.id);
          if (!finishBeforeProbe) {
            manualGate.release();
            await settled();
          }
          probeGate = probeStarted = undefined;
        },
      );
    }
    await t.test("manual update-all and single-source requests remain supported", async () => {
      for (const suffix of [
        "",
        `?id=${listCatalogSources().find((source) => source.repository === "automatic/root")!.id}`,
      ]) {
        const response = await routeApi(
          new Request(base + "/api/catalog-sources" + suffix, { method: "PUT", headers }),
        );
        assert.equal(response.status, 202);
        const accepted = await response.json();
        assert.equal((await settled()).stage, "SUCCEEDED");
        assert.equal(currentPluginInstallJob()?.id, accepted.job.id);
      }
    });
  } finally {
    probeGate?.release();
    catalogGate?.release();
    globalThis.fetch = originalFetch;
  }
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
