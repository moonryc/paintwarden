import assert from "node:assert/strict";
import { test } from "node:test";

import { createVaultGraphQLClient } from "./client";
import { getFragmentData } from "./generated/fragment-masking";
import { LibraryPaintFragmentDoc } from "./generated/graphql";
import { LIBRARY_PAGE_SIZE, readLibraryWindow } from "./library-loader";

function page(index: number, seq = "1", hasNextPage = true) {
  return {
    library: {
      __typename: "PaintConnection",
      nodes: [
        {
          __typename: "Paint",
          id: `paint-${index}`,
          name: `Paint ${index}`,
          brand: "Brand",
          range: "Range",
          colorHex: null,
          sourceUrl: null,
          isCustom: false,
          sourceName: null,
          sourceLogoUrl: null,
          type: null,
          discontinued: false,
          inventory: null,
          available: false,
          activeSubstitution: null,
          brokenReason: null,
          brokenSubstitution: false,
          missingStock: true,
        },
      ],
      pageInfo: { __typename: "PageInfo", hasNextPage, endCursor: `page-${index}` },
      revision: { __typename: "VaultRevision", epoch: "fixture", seq },
      totalCount: 9,
      catalogCount: 9,
      availableCount: 0,
      explicitWishlistCount: 0,
      facets: { __typename: "LibraryFacets", brands: [], sources: [], inventory: [] },
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

void test("Library windows have no debug page cap and carry all filters on every bounded request", async () => {
  const requests: Record<string, unknown>[] = [];
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      assert.ok(typeof init?.body === "string");
      const { variables } = JSON.parse(init.body) as { variables: Record<string, unknown> };
      requests.push(variables);
      return json(page(requests.length, "1", requests.length < 9));
    },
  });
  try {
    const result = await readLibraryWindow(scope.client, 20, {
      search: "blue",
      brand: "Custom",
      noSource: true,
      filter: "ALL",
    });
    assert.equal(requests.length, 9);
    assert.equal(result.library.nodes.length, 9);
    assert.equal(getFragmentData(LibraryPaintFragmentDoc, result.library.nodes.at(-1))?.id, "paint-9");
    assert.equal(result.library.pageInfo.hasNextPage, false);
    assert.ok(
      requests.every(
        (request) =>
          request.first === LIBRARY_PAGE_SIZE &&
          request.search === "blue" &&
          request.brand === "Custom" &&
          request.noSource === true &&
          request.filter === "ALL",
      ),
    );
    assert.equal(requests[0].after, null);
    assert.equal(requests[8].after, "page-8");
    assert.deepEqual(
      scope.client.cache.extract(),
      {},
      "No partial page is committed before the caller accepts the envelope",
    );
  } finally {
    scope.dispose();
  }
});

void test("revision changes restart all loaded pages rather than exposing a mixed window", async () => {
  let requests = 0;
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () => {
      requests += 1;
      if (requests === 1) return json(page(1, "1"));
      return json(page(requests, "2", requests !== 4));
    },
  });
  try {
    const result = await readLibraryWindow(scope.client, 2);
    assert.equal(requests, 4);
    assert.deepEqual(
      getFragmentData(LibraryPaintFragmentDoc, result.library.nodes).map((paint) => paint.id),
      ["paint-3", "paint-4"],
    );
    assert.equal(result.library.revision.seq, "2");
  } finally {
    scope.dispose();
  }
});

void test("failed atomic refresh leaves existing cache untouched and repeated stale cursors are bounded", async () => {
  let requests = 0;
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () => {
      requests += 1;
      return stale();
    },
  });
  try {
    scope.client.cache.restore({ marker: { __typename: "Marker", value: "unchanged" } });
    const before = scope.client.cache.extract();
    await assert.rejects(readLibraryWindow(scope.client, 12), /changed repeatedly/);
    assert.equal(requests, 3);
    assert.deepEqual(scope.client.cache.extract(), before);
  } finally {
    scope.dispose();
  }
});
