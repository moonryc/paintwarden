import assert from "node:assert/strict";
import test from "node:test";

import { createVaultGraphQLClient } from "./client";
import { readSchemeOptions } from "./miniature-scheme-loader";
import { readTemplateSummaries } from "./template-loader";

for (const kind of ["template", "scheme"] as const) {
  void test(`${kind} picker cancellation reaches fetch and does not notify a global error`, async () => {
    const errors: unknown[] = [];
    let started = () => {};
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const abort = new AbortController();
    const { client, dispose } = createVaultGraphQLClient({
      authHeaders: () => ({}),
      onError: (error) => errors.push(error),
      fetch: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          assert.ok(signal);
          signal?.addEventListener("abort", () => reject(new DOMException("Superseded", "AbortError")), {
            once: true,
          });
          started();
        }),
    });
    const pending =
      kind === "template"
        ? readTemplateSummaries(client, { search: "model" }, 1, abort.signal)
        : readSchemeOptions(client, { search: "scheme", category: null, excludeIds: [] }, 1, abort.signal);
    const rejected = assert.rejects(pending);
    await ready;
    abort.abort();
    await rejected;
    assert.deepEqual(errors, []);
    assert.deepEqual(client.cache.extract(), {});
    dispose();
  });
}
