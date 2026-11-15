import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";

import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { Observable, type Subscriber } from "rxjs";

import { createVaultGraphQLClient } from "./client";
import type { PluginInstallStage } from "./generated/graphql";
import { observePluginInstall, type PluginInstallJob } from "./plugin-install-observer";

function job(stage: PluginInstallStage = "READING", id = "install-1"): PluginInstallJob {
  return {
    id,
    stage,
    done: stage === "SUCCEEDED" ? 10 : 2,
    total: 10,
    percent: stage === "SUCCEEDED" ? 100 : 20,
    cancellable: stage === "READING",
    error: stage === "FAILED" ? "installation failed" : null,
    errorCode: null,
    errorParameters: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Drain Apollo's promise delivery, not a wall-clock delay or a network retry timer.
async function settled() {
  await setImmediate();
  await setImmediate();
}

function harness() {
  let stream!: Subscriber<ApolloLink.Result>;
  let unsubscribed = 0;
  const operations: string[] = [];
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(
      (operation) =>
        new Observable((observer) => {
          operations.push(operation.operationName ?? "");
          assert.deepEqual(operation.variables, {});
          assert.equal(operation.operationName, "PluginInstallProgress", "No duplicate recovery HTTP query");
          stream = observer;
          return () => {
            unsubscribed += 1;
          };
        }),
    ),
  });
  return {
    client,
    operations,
    stream(value: PluginInstallJob | null) {
      stream.next({ data: { pluginInstallProgress: value } });
    },
    disconnect() {
      stream.complete();
    },
    get unsubscribed() {
      return unsubscribed;
    },
  };
}

for (const stage of ["READING", "SUCCEEDED", "FAILED", "CANCELLED"] satisfies PluginInstallStage[]) {
  void test(`initial stream replay restores ${stage} without an open dialog`, async (t) => {
    const source = harness();
    const seen: (PluginInstallJob | null)[] = [];
    let disconnects = 0;
    const observation = observePluginInstall(
      source.client,
      (value) => seen.push(value),
      () => disconnects++,
    );
    t.after(() => {
      observation.dispose();
      source.client.stop();
    });
    source.stream(job(stage));
    await settled();
    assert.deepEqual(seen, [job(stage)]);
    assert.deepEqual(source.operations, ["PluginInstallProgress"]);
    assert.equal(disconnects, 0);
    assert.deepEqual(source.client.cache.extract(), {}, "progress is never retained in the vault cache");
  });
}

void test("nullable initial subscription before the first job do not disconnect or block later progress", async (t) => {
  const source = harness();
  const seen: (PluginInstallJob | null)[] = [];
  let disconnects = 0;
  const observation = observePluginInstall(
    source.client,
    (value) => seen.push(value),
    () => disconnects++,
  );
  t.after(() => {
    observation.dispose();
    source.client.stop();
  });
  source.stream(null);
  await settled();
  assert.deepEqual(seen, [null]);
  source.stream(null);
  assert.deepEqual(seen, [null, null]);
  source.stream(job("PREPARING"));
  source.stream(job("READING"));
  assert.deepEqual(seen, [null, null, job("PREPARING"), job("READING")]);
  assert.equal(disconnects, 0);
});

void test("an initial null replay does not block a new job", async (t) => {
  const source = harness();
  const seen: (PluginInstallJob | null)[] = [];
  const observation = observePluginInstall(source.client, (value) => seen.push(value), assert.fail);
  t.after(() => {
    observation.dispose();
    source.client.stop();
  });
  source.stream(null);
  assert.deepEqual(seen, [null]);
  await settled();
  assert.deepEqual(seen, [null]);
  source.stream(job("PREPARING", "new-job"));
  assert.deepEqual(seen, [null, job("PREPARING", "new-job")]);
});

void test("subscription stages arrive without awaiting a separate query", async (t) => {
  const source = harness();
  const seen: (PluginInstallJob | null)[] = [];
  const observation = observePluginInstall(source.client, (value) => seen.push(value), assert.fail);
  t.after(() => {
    observation.dispose();
    source.client.stop();
  });
  source.stream(job("IMAGES"));
  assert.deepEqual(seen, [job("IMAGES")], "stream updates must not await latest-query completion");
  await settled();
  source.stream(job("SUCCEEDED"));
  assert.deepEqual(seen, [job("IMAGES"), job("SUCCEEDED")]);
});

void test("REST acceptance delivers immediately while subsequent stream stages still arrive", async (t) => {
  const source = harness();
  const seen: (PluginInstallJob | null)[] = [];
  const observation = observePluginInstall(source.client, (value) => seen.push(value), assert.fail);
  t.after(() => {
    observation.dispose();
    source.client.stop();
  });
  observation.accept(job("PREPARING", "new-job"));
  assert.deepEqual(seen, [job("PREPARING", "new-job")]);
  await settled();
  source.stream(job("COMMITTING", "new-job"));
  assert.deepEqual(seen, [job("PREPARING", "new-job"), job("COMMITTING", "new-job")]);
});

void test("dispose unsubscribes once and ignores late stream, REST acceptance, and disconnect", async () => {
  const source = harness();
  const seen: (PluginInstallJob | null)[] = [];
  let disconnects = 0;
  const observation = observePluginInstall(
    source.client,
    (value) => seen.push(value),
    () => disconnects++,
  );
  observation.dispose();
  observation.dispose();
  assert.equal(source.unsubscribed, 1);
  source.stream(job("SUCCEEDED"));
  source.disconnect();
  observation.accept(job("PREPARING"));
  await settled();
  assert.deepEqual(seen, []);
  assert.equal(disconnects, 0);
  source.client.stop();
});

void test("distinct Apollo scopes cannot deliver an old account's late stream into a new observer", async () => {
  const old = harness();
  const current = harness();
  const oldSeen: (PluginInstallJob | null)[] = [];
  const currentSeen: (PluginInstallJob | null)[] = [];
  const previous = observePluginInstall(old.client, (value) => oldSeen.push(value), assert.fail);
  old.stream(job("READING", "old-account"));
  previous.dispose();
  const active = observePluginInstall(current.client, (value) => currentSeen.push(value), assert.fail);
  try {
    old.stream(job("SUCCEEDED", "old-account"));
    current.stream(null);
    await settled();
    current.stream(job("PREPARING", "new-account"));
    assert.deepEqual(oldSeen, [job("READING", "old-account")]);
    assert.deepEqual(currentSeen, [null, job("PREPARING", "new-account")]);
    assert.deepEqual(current.client.cache.extract(), {});
  } finally {
    active.dispose();
    old.client.stop();
    current.client.stop();
  }
});

void test(
  "real HTTP and generic SSE carry job stages across retry without vault revision variables",
  { timeout: 5000 },
  async (t) => {
    const first = deferred<void>();
    const last = deferred<void>();
    const aborted = deferred<void>();
    const encoder = new TextEncoder();
    const requests: { operationName: string; variables: Record<string, unknown>; auth: string | null }[] = [];
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    let connections = 0;
    let token = "first-account";
    const scope = createVaultGraphQLClient({
      authHeaders: () => ({ authorization: token }),
      sseRetry: async () => {},
      fetch: async (url, init) => {
        assert.equal(typeof init?.body, "string");
        const request = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
          operationName: string;
          variables: Record<string, unknown>;
        };
        requests.push({ ...request, auth: new Headers(init?.headers).get("authorization") });
        assert.equal(init?.method, "POST");
        assert.equal(init?.credentials, "same-origin");
        assert.deepEqual(request.variables, {}, "job streams must not acquire epoch/since on reconnect");
        assert.equal(url, "/api/graphql/stream");
        assert.equal(request.operationName, "PluginInstallProgress");
        connections += 1;
        const connection = connections;
        const stream = new ReadableStream<Uint8Array>({
          start(current) {
            controller = current;
            current.enqueue(
              encoder.encode(
                `event: next\ndata: ${JSON.stringify({ data: { pluginInstallProgress: job(connection === 1 ? "READING" : "SUCCEEDED") } })}\n\n`,
              ),
            );
            init?.signal?.addEventListener(
              "abort",
              () => {
                if (connection === 2) {
                  current.close();
                  aborted.resolve();
                }
              },
              { once: true },
            );
          },
        });
        return new Response(stream, { headers: { "content-type": "text/event-stream" } });
      },
    });
    const seen: (PluginInstallJob | null)[] = [];
    let disconnects = 0;
    const observation = observePluginInstall(
      scope.client,
      (value) => {
        seen.push(value);
        if (value?.stage === "READING") first.resolve();
        if (value?.stage === "SUCCEEDED") last.resolve();
      },
      () => disconnects++,
    );
    t.after(() => {
      observation.dispose();
      scope.dispose();
    });
    await first.promise;
    token = "refreshed-account-token";
    controller.error(new Error("temporary network loss"));
    await last.promise;
    await settled();
    assert.deepEqual(seen, [job("READING"), job("SUCCEEDED")]);
    assert.equal(connections, 2);
    assert.equal(disconnects, 0, "a recovered transport failure must not disconnect the observer");
    assert.deepEqual(
      requests
        .filter((request) => request.operationName === "PluginInstallProgress")
        .map((request) => request.auth),
      ["first-account", "refreshed-account-token"],
    );
    observation.dispose();
    await aborted.promise;
    assert.deepEqual(scope.client.cache.extract(), {});
  },
);

for (const stale of [null, job("SUCCEEDED", "previous-job"), job("READING", "previous-job")]) {
  void test(`REST acceptance supersedes an in-flight initial ${stale?.stage ?? "null"} snapshot`, (t) => {
    const source = harness();
    const seen: (PluginInstallJob | null)[] = [];
    const observation = observePluginInstall(source.client, (value) => seen.push(value), assert.fail);
    t.after(() => {
      observation.dispose();
      source.client.stop();
    });
    observation.accept(job("READING", "new-job"));
    source.stream(stale);
    assert.deepEqual(seen, [job("READING", "new-job")]);
    source.stream(job("IMAGES", "new-job"));
    source.stream(null); // A later authoritative null (e.g. server restart) still clears state.
    assert.deepEqual(seen, [job("READING", "new-job"), job("IMAGES", "new-job"), null]);
  });
}
