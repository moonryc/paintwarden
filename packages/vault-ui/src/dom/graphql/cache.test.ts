import assert from "node:assert/strict";
import test from "node:test";
import { gql, type InMemoryCache } from "@apollo/client";

import { createVaultCache } from "./cache.ts";

const query = gql`
  query Library($first: Int!, $after: String, $filter: String) {
    library(first: $first, after: $after, filter: $filter) {
      nodes {
        id
        name
        inventory {
          state
          stockLevel
          quantity
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
      revision {
        epoch
        seq
      }
    }
  }
`;

function paint(id: string, quantity = 1) {
  return {
    __typename: "Paint",
    id,
    name: `Paint ${id}`,
    inventory: { __typename: "Inventory", state: "OWNED", stockLevel: "FULL", quantity },
  };
}

function writePage(
  cache: InMemoryCache,
  ids: string[],
  endCursor: string | null,
  options: {
    after?: string | null;
    first?: number;
    filter?: string;
    seq?: number;
    epoch?: string;
    hasNextPage?: boolean;
  } = {},
) {
  cache.writeQuery({
    query,
    variables: { first: options.first ?? 2, after: options.after, filter: options.filter },
    data: {
      library: {
        __typename: "PaintConnection",
        nodes: ids.map((id) => paint(id)),
        pageInfo: { __typename: "PageInfo", endCursor, hasNextPage: options.hasNextPage ?? true },
        revision: {
          __typename: "VaultRevision",
          epoch: options.epoch ?? "epoch",
          seq: String(options.seq ?? 1),
        },
      },
    },
  });
}

function read(cache: InMemoryCache, filter?: string, first = 2) {
  return cache.readQuery<{
    library: {
      nodes: ReturnType<typeof paint>[];
      pageInfo: { endCursor: string | null; hasNextPage: boolean };
      revision: { epoch: string; seq: string };
    };
  }>({ query, variables: { first, filter } })?.library;
}

function ids(cache: InMemoryCache, filter?: string) {
  return read(cache, filter)?.nodes.map((node) => node.id);
}

test("appends unique Paint ids and keeps the latest tail when older pages repeat", () => {
  const cache = createVaultCache();
  writePage(cache, ["a", "b"], "b");
  writePage(cache, ["b", "c"], "c", { after: "b" });
  writePage(cache, ["d"], "d", { after: "c", hasNextPage: false });
  assert.deepEqual(ids(cache), ["a", "b", "c", "d"]);
  writePage(cache, ["b", "c"], "c", { after: "b" });
  assert.deepEqual(ids(cache), ["a", "b", "c", "d"]);
  assert.deepEqual(read(cache)?.pageInfo, { __typename: "PageInfo", endCursor: "d", hasNextPage: false });
});

test("first is not a cache key, filters are; missing or null after replaces", () => {
  const cache = createVaultCache();
  writePage(cache, ["a", "b"], "b");
  assert.deepEqual(
    read(cache, undefined, 100)?.nodes.map((node) => node.id),
    ["a", "b"],
  );
  writePage(cache, ["c"], "c", { first: 1, after: "b" });
  writePage(cache, ["filtered"], "filtered", { filter: "owned" });
  assert.deepEqual(ids(cache), ["a", "b", "c"]);
  assert.deepEqual(ids(cache, "owned"), ["filtered"]);
  writePage(cache, ["new"], "new", { after: null });
  assert.deepEqual(ids(cache), ["new"]);
  writePage(cache, [], null, { hasNextPage: false });
  assert.deepEqual(ids(cache), []);
  assert.equal(read(cache)?.pageInfo.endCursor, null);
});

test("ignores orphan pages and stale appends after the base snapshot is replaced", () => {
  const cache = createVaultCache();
  writePage(cache, ["orphan"], "orphan", { after: "missing" });
  assert.equal(read(cache), undefined);
  writePage(cache, ["a", "b"], "b");
  writePage(cache, ["c"], "c", { after: "b" });
  writePage(cache, ["new"], "new", { seq: 2 });
  writePage(cache, ["d"], "d", { after: "c" });
  assert.deepEqual(ids(cache), ["new"]);
  // A refresh can preserve the same sort cursor while advancing the revision.
  writePage(cache, ["a", "b"], "b", { seq: 2 });
  writePage(cache, ["stale"], "stale", { after: "b" });
  writePage(cache, ["wrong-epoch"], "wrong", { after: "b", seq: 2, epoch: "old" });
  assert.deepEqual(ids(cache), ["a", "b"]);
  writePage(cache, ["fresh"], "fresh", { after: "b", seq: 2 });
  assert.deepEqual(ids(cache), ["a", "b", "fresh"]);
});

test("normalizes Paint by id across lists and replaces embedded inventory, including null", () => {
  const cache = createVaultCache();
  writePage(cache, ["a"], "a");
  writePage(cache, ["a"], "a", { filter: "owned" });
  const id = cache.identify({ __typename: "Paint", id: "a" });
  assert.ok(id);
  cache.writeFragment({
    id,
    fragment: gql`
      fragment UpdatePaint on Paint {
        name
        inventory {
          state
          stockLevel
          quantity
        }
      }
    `,
    data: { __typename: "Paint", name: "Updated", inventory: { ...paint("a", 3).inventory } },
  });
  assert.equal(read(cache)?.nodes[0].name, "Updated");
  assert.equal(read(cache, "owned")?.nodes[0].inventory?.quantity, 3);

  cache.writeFragment({
    id,
    fragment: gql`
      fragment PartialInventory on Paint {
        inventory {
          state
        }
      }
    `,
    data: { __typename: "Paint", inventory: { __typename: "Inventory", state: "WISHLIST" } },
  });
  assert.deepEqual(cache.extract()[id]?.inventory, { __typename: "Inventory", state: "WISHLIST" });
  cache.writeFragment({
    id,
    fragment: gql`
      fragment ClearInventory on Paint {
        inventory {
          state
          stockLevel
          quantity
        }
      }
    `,
    data: { __typename: "Paint", inventory: null },
  });
  assert.equal(read(cache)?.nodes[0].inventory, null);
  assert.equal(read(cache, "owned")?.nodes[0].inventory, null);
  assert.deepEqual(Object.keys(cache.extract()).sort(), [id, "ROOT_QUERY", "__META"].sort());
});

test("cache instances do not share state", () => {
  const cache = createVaultCache();
  writePage(cache, ["a"], "a");
  assert.equal(read(createVaultCache()), undefined);
});

const miniatureQuery = gql`
  query MiniatureList($first: Int!, $after: String, $stage: String) {
    home(first: $first, after: $after, stage: $stage) {
      miniatures {
        nodes {
          id
          title
          readiness {
            ready
            missing
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
      revision {
        epoch
        seq
      }
    }
  }
`;
test("miniature atomic windows share pagination slot but not filters and normalize IDs", () => {
  const cache = createVaultCache();
  const write = (ids: string[], stage?: string, first = 48) =>
    cache.writeQuery({
      query: miniatureQuery,
      variables: { first, stage },
      data: {
        home: {
          __typename: "HomeView",
          revision: { __typename: "VaultRevision", epoch: "e", seq: "1" },
          miniatures: {
            __typename: "MiniatureConnection",
            nodes: ids.map((id) => ({
              __typename: "Miniature",
              id,
              title: id,
              readiness: { __typename: "MiniatureReadiness", ready: true, missing: 0 },
            })),
            pageInfo: { __typename: "PageInfo", endCursor: null, hasNextPage: false },
          },
        },
      },
    });
  const readIds = (stage?: string) =>
    cache
      .readQuery<{ home: { miniatures: { nodes: { id: string }[] } } }>({
        query: miniatureQuery,
        variables: { first: 48, stage },
      })
      ?.home.miniatures.nodes.map((node) => node.id);
  write(["a", "b"]);
  write(["a", "b", "c"], undefined, 96);
  write(["done"], "COMPLETE");
  assert.deepEqual(readIds(), ["a", "b", "c"]);
  assert.deepEqual(readIds("COMPLETE"), ["done"]);
  write(["b"]);
  assert.deepEqual(readIds(), ["b"]);
  assert.ok(cache.identify({ __typename: "Miniature", id: "b" }));
});

void test("batched attached entries retain scheme-scoped duplicate IDs after atomic cache publication", () => {
  const cache = createVaultCache();
  const query = gql`
    query AttachedEntries {
      miniature(id: "miniature") {
        attachedSchemeEntries(first: 40) {
          nodes {
            id
            schemeId
            kind
            label
          }
        }
      }
    }
  `;
  const nodes = ["scheme-a", "scheme-b"].map((schemeId) => ({
    __typename: "MiniatureSchemeEntry",
    id: "shared-divider-id",
    schemeId,
    kind: "DIVIDER",
    label: schemeId,
  }));
  cache.writeQuery({
    query,
    data: {
      miniature: {
        __typename: "MiniatureView",
        attachedSchemeEntries: {
          __typename: "MiniatureSchemeEntryConnection",
          nodes,
        },
      },
    },
  });
  assert.deepEqual(
    cache.readQuery<{ miniature: { attachedSchemeEntries: { nodes: unknown[] } } }>({ query })?.miniature
      .attachedSchemeEntries.nodes,
    nodes,
  );
  assert.equal(
    Object.keys(cache.extract()).some((key) => key.startsWith("MiniatureSchemeEntry:")),
    false,
  );
});
