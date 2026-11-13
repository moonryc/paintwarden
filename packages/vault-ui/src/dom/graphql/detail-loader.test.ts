import assert from "node:assert/strict";
import test from "node:test";

import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { Observable } from "rxjs";

import { readPaintDetail } from "./detail-loader";

const paint = {
  __typename: "Paint",
  id: "a",
  brand: "Test",
  range: "Test",
  name: "Original",
  colorHex: null,
  sourceUrl: null,
  isCustom: true,
  sourceName: null,
  sourceLogoUrl: null,
  inventory: null,
  available: false,
  hasActiveSubstitution: false,
  brokenReason: null,
  missingStock: true,
  brokenSubstitution: false,
  activeSubstitution: null,
};
const info = (cursor: string | null = null) => ({ hasNextPage: !!cursor, endCursor: cursor });
function page(seq: string, next = false, id = "first") {
  return {
    paint: {
      revision: { epoch: "epoch", seq },
      paint,
      substitutions: {
        nodes: [
          {
            id,
            targetPaintId: "a",
            name: id,
            isDefault: false,
            available: false,
            brokenReason: null,
            ingredients: {
              nodes: [{ paint, parts: 1, sortOrder: 0 }],
              totalCount: 2,
              pageInfo: info("ingredient"),
            },
          },
        ],
        totalCount: 2,
        pageInfo: info(next ? "substitution" : null),
      },
      usedBy: { nodes: [{ id, title: id }], totalCount: 2, pageInfo: info(next ? "usage" : null) },
    },
  };
}
function mockClient(reply: (name: string, variables: Record<string, unknown>) => unknown) {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(
      (operation) =>
        new Observable((observer) => {
          const response = reply(operation.operationName ?? "", operation.variables);
          observer.next(response as { data: never });
          observer.complete();
        }),
    ),
  });
}

test("detail loader rebuilds all explicitly loaded windows without writing partial data to cache", async () => {
  const calls: string[] = [];
  const client = mockClient((name, variables) => {
    calls.push(name);
    if (name === "PaintSubstitutionIngredients")
      return {
        data: {
          substitution: {
            revision: { epoch: "epoch", seq: "1" },
            substitution: {
              id: variables.id,
              ingredients: {
                nodes: [{ paint: { ...paint, id: "b", name: "Second" }, parts: 2, sortOrder: 1 }],
                totalCount: 2,
                pageInfo: info(),
              },
            },
          },
        },
      };
    return { data: variables.substitutionsAfter ? page("1", false, "second") : page("1", true) };
  });
  const detail = await readPaintDetail(client, "a", {
    substitutions: 2,
    usedBy: 2,
    ingredients: { first: 1 },
  });
  assert.deepEqual(
    detail.substitutions.nodes.map((mix) => mix.id),
    ["first", "second"],
  );
  assert.deepEqual(
    detail.usedBy.nodes.map((mini) => mini.id),
    ["first", "second"],
  );
  assert.deepEqual(
    detail.substitutions.nodes[0].ingredients.nodes.map((row) => row.paint.id),
    ["a", "b"],
  );
  assert.equal(detail.substitutions.nodes[0].ingredients.pageInfo.hasNextPage, false);
  assert.deepEqual(calls, ["PaintDetails", "PaintDetails", "PaintSubstitutionIngredients"]);
  assert.deepEqual(client.cache.extract(), {});
  client.stop();
});

test("detail loader retries a revision mismatch atomically", async () => {
  let calls = 0;
  const client = mockClient((_name, variables) => {
    calls += 1;
    return {
      data: variables.substitutionsAfter ? page("2", false, "second") : page(calls === 1 ? "1" : "2", true),
    };
  });
  const detail = await readPaintDetail(client, "a", { substitutions: 2, usedBy: 1, ingredients: {} });
  assert.equal(calls, 4);
  assert.equal(detail.revision.seq, "2");
  assert.equal(detail.substitutions.nodes.length, 2);
  assert.equal(detail.usedBy.nodes.length, 1);
  client.stop();
});

test("detail loader retries STALE_CURSOR but surfaces real failures", async () => {
  let calls = 0;
  const client = mockClient((_name, variables) => {
    calls += 1;
    if (calls === 2) return { errors: [{ message: "Old cursor", extensions: { code: "STALE_CURSOR" } }] };
    return {
      data: variables.substitutionsAfter ? page("2", false, "second") : page(calls === 1 ? "1" : "2", true),
    };
  });
  const detail = await readPaintDetail(client, "a", { substitutions: 2, usedBy: 1, ingredients: {} });
  assert.equal(detail.revision.seq, "2");
  assert.equal(calls, 4);
  client.stop();
  const denied = mockClient(() => ({
    errors: [{ message: "Access denied", extensions: { code: "FORBIDDEN" } }],
  }));
  await assert.rejects(
    readPaintDetail(denied, "a", { substitutions: 1, usedBy: 1, ingredients: {} }),
    /Access denied/,
  );
  denied.stop();
});

test("detail loader never publishes repeatedly changing pages", async () => {
  let seq = 0;
  const client = mockClient((_name, variables) => ({
    data: page(String(++seq), !variables.substitutionsAfter),
  }));
  await assert.rejects(
    readPaintDetail(client, "a", { substitutions: 2, usedBy: 2, ingredients: {} }),
    /changed while refreshing/,
  );
  assert.deepEqual(client.cache.extract(), {});
  client.stop();
});
