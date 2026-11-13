import assert from "node:assert/strict";
import { test } from "node:test";

import { createVaultGraphQLClient } from "./client";
import { getFragmentData } from "./generated/fragment-masking";
import { MiniatureTileFragmentDoc } from "./generated/graphql";
import { miniatureListEnvelope, MINIATURE_PAGE_SIZE, readMiniatureWindow } from "./miniature-list-loader";
import { miniatureTileProjection } from "./miniature-list-model";

function tile(index: number) {
  return {
    __typename: "Miniature",
    id: `mini-${index}`,
    title: `Miniature ${index}`,
    status: "OWNED",
    imageUrl: null,
    readiness: { __typename: "Readiness", total: 4, missing: 2 },
    previewSwatches: [{ __typename: "MiniatureSwatch", colorHex: "#112233" }],
  };
}
function page(index: number, seq = "1", hasNextPage = true, workbench = true) {
  const miniatures = {
    __typename: "MiniatureConnection",
    nodes: [tile(index)],
    totalCount: 600,
    pageInfo: { __typename: "PageInfo", hasNextPage, endCursor: `page-${index}` },
  };
  const revision = { __typename: "VaultRevision", epoch: "fixture", seq };
  return workbench
    ? {
        home: {
          __typename: "HomeView",
          revision,
          miniatures,
          counts: {
            __typename: "HomeCounts",
            catalogCount: 2000,
            owned: 600,
            ready: 250,
            distinctMissingPaints: 77,
            wishlistedMissingPaints: 30,
            stages: [{ __typename: "FacetCount", key: "ALL", label: "All", count: 600 }],
          },
        },
      }
    : {
        miniatures: {
          __typename: "MiniaturesView",
          revision,
          miniatures,
          ownershipCounts: [{ __typename: "FacetCount", key: "ALL", label: "All", count: 900 }],
          stageCounts: [],
        },
      };
}
function json(data: unknown) {
  return new Response(JSON.stringify({ data }), { headers: { "content-type": "application/json" } });
}
function stale() {
  return new Response(
    JSON.stringify({ errors: [{ message: "changed", extensions: { code: "STALE_CURSOR" } }] }),
    { headers: { "content-type": "application/json" } },
  );
}

for (const workbench of [true, false]) {
  void test(`${workbench ? "Home" : "Miniatures"} windows reach the final item beyond five pages without cache writes`, async () => {
    const requests: Record<string, unknown>[] = [];
    const scope = createVaultGraphQLClient({
      authHeaders: () => ({}),
      fetch: async (_url, init) => {
        assert.equal(typeof init?.body, "string");
        requests.push(JSON.parse(init?.body as string).variables as Record<string, unknown>);
        return json(page(requests.length, "1", requests.length < 13, workbench));
      },
    });
    try {
      const result = await readMiniatureWindow(scope.client, 100, {
        workbench,
        ownership: "OWNED",
        stage: "PRIMED",
        search: "dragon",
      });
      const envelope = miniatureListEnvelope(result);
      assert.equal(requests.length, 13);
      assert.equal(envelope.miniatures.nodes.length, 13);
      assert.equal(
        getFragmentData(MiniatureTileFragmentDoc, envelope.miniatures.nodes.at(-1))?.id,
        "mini-13",
      );
      assert.equal(envelope.miniatures.totalCount, 600, "global counts are not loaded window length");
      assert.equal(envelope.miniatures.pageInfo.hasNextPage, false);
      assert.ok(
        requests.every(
          (request) =>
            request.first === MINIATURE_PAGE_SIZE &&
            request.workbench === workbench &&
            request.ownership === "OWNED" &&
            request.stage === "PRIMED" &&
            request.search === "dragon",
        ),
      );
      assert.equal(requests[0].after, null);
      assert.equal(requests[12].after, "page-12");
      assert.deepEqual(scope.client.cache.extract(), {}, "only the caller's revision guard may commit");
    } finally {
      scope.dispose();
    }
  });
}

void test("a mixed-revision miniature window is discarded and restarted atomically", async () => {
  let requests = 0;
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () => {
      requests++;
      return json(page(requests, requests === 1 ? "1" : "2", requests !== 4));
    },
  });
  try {
    const result = await readMiniatureWindow(scope.client, 2, { workbench: true });
    assert.equal(requests, 4);
    assert.deepEqual(
      getFragmentData(MiniatureTileFragmentDoc, miniatureListEnvelope(result).miniatures.nodes).map(
        (node) => node.id,
      ),
      ["mini-3", "mini-4"],
    );
    assert.equal(miniatureListEnvelope(result).revision.seq, "2");
  } finally {
    scope.dispose();
  }
});

void test("STALE_CURSOR restarts the full loaded miniature chain, without a partial commit", async () => {
  let requests = 0;
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () => {
      requests++;
      if (requests === 2) return stale();
      return json(page(requests, "1", requests !== 4));
    },
  });
  try {
    const result = await readMiniatureWindow(scope.client, 2, { workbench: true });
    assert.deepEqual(
      getFragmentData(MiniatureTileFragmentDoc, miniatureListEnvelope(result).miniatures.nodes).map(
        (node) => node.id,
      ),
      ["mini-3", "mini-4"],
    );
    assert.deepEqual(scope.client.cache.extract(), {});
  } finally {
    scope.dispose();
  }
});

void test("repeated stale cursors are bounded and preserve previously authorized cached data", async () => {
  let requests = 0;
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () => {
      requests++;
      return stale();
    },
  });
  try {
    scope.client.cache.restore({ marker: { __typename: "Marker", value: "retained" } });
    const before = scope.client.cache.extract();
    await assert.rejects(readMiniatureWindow(scope.client, 20, { workbench: true }), /changed repeatedly/);
    assert.equal(requests, 3);
    assert.deepEqual(scope.client.cache.extract(), before);
  } finally {
    scope.dispose();
  }
});

void test("missing continuation cursors never publish a partial window", async () => {
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () => {
      const data = page(1);
      data.home!.miniatures.pageInfo.endCursor = null as unknown as string;
      return json(data);
    },
  });
  try {
    await assert.rejects(readMiniatureWindow(scope.client, 2, { workbench: true }), /invalid page cursor/);
    assert.deepEqual(scope.client.cache.extract(), {});
  } finally {
    scope.dispose();
  }
});

void test("tile projections keep server counts and colors, without synthetic Paint or State objects", () => {
  const projection = miniatureTileProjection({
    id: "mini",
    title: "Dragon",
    status: "OWNED",
    imageUrl: null,
    readiness: { total: 120, missing: 80 },
    previewSwatches: [{ colorHex: "#112233" }, { colorHex: "#445566" }],
  });
  assert.deepEqual(projection, {
    mini: { id: "mini", title: "Dragon", status: "OWNED", imageUrl: null },
    total: 120,
    missing: 80,
    swatches: [{ colorHex: "#112233" }, { colorHex: "#445566" }],
  });
});
