import assert from "node:assert/strict";
import { test } from "node:test";

import { createVaultGraphQLClient } from "./client";
import { getFragmentData } from "./generated/fragment-masking";
import { WishlistRowFragmentDoc } from "./generated/graphql";
import { readWishlistWindow, WISHLIST_PAGE_SIZE } from "./wishlist-loader";

function row(id: string) {
  return {
    __typename: "WishlistRow",
    id,
    brandGroup: "Brand",
    restock: false,
    missingStock: true,
    brokenSubstitution: false,
    projectCount: 1,
    relatedProjectsPreview: [{ __typename: "WishlistProject", id: "mini", title: "Miniature" }],
    relatedProjectsTruncated: false,
    paint: {
      __typename: "Paint",
      id,
      brand: "Brand",
      range: "Range",
      name: id,
      colorHex: null,
      sourceUrl: null,
      isCustom: false,
      sourceName: null,
      sourceLogoUrl: null,
      type: "opaque",
      discontinued: false,
      inventory: { __typename: "Inventory", state: "WISHLIST", stockLevel: "FULL", quantity: 0 },
      available: false,
      activeSubstitution: null,
      brokenSubstitution: false,
      brokenReason: null,
      missingStock: true,
    },
  };
}
function response(shopping: number, missing: number, seq = "1", shoppingNext = true, missingNext = true) {
  return new Response(
    JSON.stringify({
      data: {
        wishlist: {
          __typename: "WishlistView",
          revision: { __typename: "VaultRevision", epoch: "fixture", seq },
          counts: {
            __typename: "WishlistCounts",
            shoppingPaints: 600,
            restockPaints: 10,
            missingPaints: 800,
            missingStock: 799,
            brokenSubstitution: 1,
            listedMissingStock: 500,
            projectCount: 900,
          },
          shopping: {
            __typename: "WishlistConnection",
            nodes: [row(`shopping-${shopping}`)],
            totalCount: 600,
            pageInfo: {
              __typename: "PageInfo",
              hasNextPage: shoppingNext,
              endCursor: shoppingNext ? `s${shopping}` : null,
            },
          },
          missing: {
            __typename: "WishlistConnection",
            nodes: [row(`missing-${missing}`)],
            totalCount: 800,
            pageInfo: {
              __typename: "PageInfo",
              hasNextPage: missingNext,
              endCursor: missingNext ? `m${missing}` : null,
            },
          },
        },
      },
    }),
    { headers: { "content-type": "application/json" } },
  );
}
function stale() {
  return new Response(
    JSON.stringify({ errors: [{ message: "changed", extensions: { code: "STALE_CURSOR" } }] }),
    { headers: { "content-type": "application/json" } },
  );
}
void test("Wishlist reaches last shopping/missing pages independently, preserves global counts and does not normalize before acceptance", async () => {
  const requests: Record<string, unknown>[] = [];
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      const variables = JSON.parse(init?.body as string).variables as Record<string, unknown>;
      requests.push(variables);
      const shopping = typeof variables.after === "string" ? Number(variables.after.slice(1)) + 1 : 1;
      const missing =
        typeof variables.missingAfter === "string" ? Number(variables.missingAfter.slice(1)) + 1 : 1;
      return response(shopping, missing, "1", shopping < 13, missing < 4);
    },
  });
  try {
    const result = await readWishlistWindow(scope.client, "selected-model", { shopping: 100, missing: 2 });
    assert.equal(requests.length, 13);
    assert.equal(result.wishlist.shopping.nodes.length, 13);
    assert.equal(
      result.wishlist.missing.nodes.length,
      2,
      "stop missing at its loaded depth even as shopping continues",
    );
    assert.equal(
      getFragmentData(WishlistRowFragmentDoc, result.wishlist.shopping.nodes.at(-1))?.id,
      "shopping-13",
    );
    assert.equal(
      getFragmentData(WishlistRowFragmentDoc, result.wishlist.missing.nodes.at(-1))?.id,
      "missing-2",
    );
    assert.equal(result.wishlist.missing.pageInfo.hasNextPage, true);
    assert.equal(result.wishlist.shopping.pageInfo.hasNextPage, false);
    assert.equal(result.wishlist.counts.projectCount, 900);
    assert.equal(result.wishlist.shopping.totalCount, 600);
    assert.ok(
      requests.every(
        (request) =>
          request.first === WISHLIST_PAGE_SIZE &&
          request.missingFirst === WISHLIST_PAGE_SIZE &&
          request.miniatureId === "selected-model",
      ),
    );
    assert.deepEqual(scope.client.cache.extract(), {});
  } finally {
    scope.dispose();
  }
});
void test("Wishlist stale cursor discards both partial connections and restarts at page one", async () => {
  const requests: Record<string, unknown>[] = [];
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      requests.push(JSON.parse(init?.body as string).variables as Record<string, unknown>);
      if (requests.length === 1) return response(1, 1);
      if (requests.length === 2) return stale();
      return response(requests.length - 2, requests.length - 2, "2");
    },
  });
  try {
    const result = await readWishlistWindow(scope.client, null, { shopping: 2, missing: 2 });
    assert.equal(requests.length, 4);
    assert.equal(requests[2].after, null);
    assert.equal(requests[2].missingAfter, null);
    assert.equal(result.wishlist.revision.seq, "2");
    assert.equal(result.wishlist.shopping.nodes.length, 2);
    assert.equal(result.wishlist.missing.nodes.length, 2);
  } finally {
    scope.dispose();
  }
});
void test("Wishlist mixed revisions never combine rows, and repeated changes give an explicit retry error", async () => {
  let count = 0;
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () => response(++count, count, String(count)),
  });
  try {
    await assert.rejects(
      readWishlistWindow(scope.client, null, { shopping: 2, missing: 2 }),
      /changed repeatedly/,
    );
    assert.equal(count, 6);
    assert.deepEqual(scope.client.cache.extract(), {});
  } finally {
    scope.dispose();
  }
});
void test("Wishlist rejects malformed continuations and propagates ordinary transport errors", async () => {
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () => {
      const payload = await response(1, 1).json();
      payload.data.wishlist.missing.pageInfo.endCursor = null;
      return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });
    },
  });
  try {
    await assert.rejects(
      readWishlistWindow(scope.client, null, { shopping: 1, missing: 2 }),
      /invalid page cursor/,
    );
  } finally {
    scope.dispose();
  }
});
