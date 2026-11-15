import assert from "node:assert/strict";
import test from "node:test";

import { createVaultGraphQLClient } from "./client.ts";
import { VaultInvalidationController } from "./invalidation.ts";
import {
  invalidateMiniatureDetail,
  loadMiniatureDetail,
  peekMiniatureDetail,
} from "./miniature-detail-resource.ts";

const connection = { nodes: [], totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null } };
function fixture() {
  let calls = 0;
  let seq = "1";
  let fail = false;
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () => {
      calls++;
      if (fail) throw new Error("Synthetic failure");
      return Response.json({
        data: {
          miniature: {
            revision: { epoch: "vault", seq },
            miniature: {
              id: "mini",
              title: "Mini",
              folderId: null,
              status: "OWNED",
              paintingStatus: "NOT_STARTED",
              imageUrl: null,
              createdAt: 1,
              notes: "",
              manufacturer: "",
              faction: "",
              scale: "",
            },
            recipeSteps: [],
            recipe: connection,
            schemes: connection,
            attachedSchemeEntries: connection,
            required: connection,
            missing: connection,
          },
        },
      });
    },
  });
  const scope = { client: transport.client, controller: new VaultInvalidationController() };
  return {
    scope,
    calls: () => calls,
    revision: (value: string) => {
      seq = value;
    },
    fail: (value: boolean) => {
      fail = value;
    },
    dispose: transport.dispose,
  };
}

void test("hover, pointerdown, hook and reopen share one complete aggregate", async () => {
  const f = fixture();
  try {
    const first = loadMiniatureDetail(f.scope, "mini");
    assert.equal(loadMiniatureDetail(f.scope, "mini"), first);
    const data = await first;
    assert.equal(peekMiniatureDetail(f.scope, "mini"), data);
    assert.equal(await loadMiniatureDetail(f.scope, "mini"), data);
    assert.equal(f.calls(), 1);
    invalidateMiniatureDetail(f.scope, "mini");
    await loadMiniatureDetail(f.scope, "mini");
    assert.equal(f.calls(), 2);
  } finally {
    f.dispose();
  }
});

void test("SSE invalidation and vault scopes never reuse stale complete detail", async () => {
  const a = fixture(),
    b = fixture();
  try {
    await loadMiniatureDetail(a.scope, "mini");
    assert.equal(peekMiniatureDetail(b.scope, "mini"), null);
    a.revision("2");
    a.scope.controller.event({ epoch: "vault", seq: "2", families: ["SCHEMES"], reset: false });
    assert.equal(peekMiniatureDetail(a.scope, "mini"), null);
    assert.equal((await loadMiniatureDetail(a.scope, "mini")).revision.seq, "2");
    assert.equal(a.calls(), 2);
    await loadMiniatureDetail(b.scope, "mini");
    assert.equal(b.calls(), 1);
  } finally {
    a.dispose();
    b.dispose();
  }
});

void test("failed speculative reads are retryable, not retained rejected promises", async () => {
  const f = fixture();
  try {
    f.fail(true);
    await assert.rejects(loadMiniatureDetail(f.scope, "mini"));
    f.fail(false);
    await loadMiniatureDetail(f.scope, "mini");
    assert.equal(f.calls(), 2);
  } finally {
    f.dispose();
  }
});

void test("complete aggregates are bounded by an LRU", async () => {
  const f = fixture();
  try {
    for (let i = 0; i < 13; i++) await loadMiniatureDetail(f.scope, `mini-${i}`);
    assert.equal(peekMiniatureDetail(f.scope, "mini-0"), null);
    assert.ok(peekMiniatureDetail(f.scope, "mini-12"));
  } finally {
    f.dispose();
  }
});

void test("a newer accepted paint projection invalidates detail even before SSE arrives", async () => {
  const f = fixture();
  try {
    await loadMiniatureDetail(f.scope, "mini");
    assert.ok(
      f.scope.controller.accepts(f.scope.controller.capture(), { epoch: "vault", seq: "2" }, ["PAINT"]),
    );
    assert.equal(peekMiniatureDetail(f.scope, "mini"), null);
    f.revision("2");
    assert.equal((await loadMiniatureDetail(f.scope, "mini")).revision.seq, "2");
    assert.equal(f.calls(), 2);
  } finally {
    f.dispose();
  }
});
