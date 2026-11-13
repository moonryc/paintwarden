import assert from "node:assert/strict";
import test from "node:test";

import { QueryClient } from "@tanstack/react-query";

import { createVaultStore } from "../store/vault-store.ts";
import { emptyState } from "../utils/constants.ts";
import { AUTH_QUERY, VAULT_QUERY } from "../utils/vault-query.ts";

test("migrated-only saves never initialize the legacy snapshot; cached snapshots still merge deltas", async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (url) => {
    requests.push(url instanceof Request ? url.url : typeof url === "string" ? url : url.href);
    return Response.json({ epoch: "vault", seq: 2, changes: [], reload: false });
  };
  const client = new QueryClient();
  try {
    const store = createVaultStore(client);
    await store.getState().syncChanges();
    assert.deepEqual(requests, []);
    client.setQueryData(VAULT_QUERY, { ...emptyState, cursor: { epoch: "vault", seq: 1 } });
    await store.getState().syncChanges();
    assert.deepEqual(requests, ["/api/changes?epoch=vault&since=1"]);
    assert.equal(client.getQueryData<typeof emptyState>(VAULT_QUERY)?.cursor?.seq, 2);
  } finally {
    globalThis.fetch = original;
    client.clear();
  }
});
test("cookie-only account transitions cancel/remove sensitive cached snapshots", () => {
  const client = new QueryClient();
  try {
    client.setQueryData(VAULT_QUERY, { ...emptyState, cursor: { epoch: "vault", seq: 1 } });
    client.setQueryData(AUTH_QUERY, { requireSignIn: false });
    const store = createVaultStore(client);
    store.getState().setToken("");
    assert.equal(store.getState().authGeneration, 1);
    assert.equal(client.getQueryData(VAULT_QUERY), undefined);
  } finally {
    client.clear();
  }
});
