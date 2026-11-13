import assert from "node:assert/strict";
import test from "node:test";

import { createVaultGraphQLClient } from "./client";
import { readSchemes } from "./schemes-loader";

const filters = {
  search: "bronz",
  category: "BROWN",
  sourceId: "source",
  noSource: false,
  readiness: "READY" as const,
  usesPaintIds: ["target-a", "target-b"],
};
const node = (id: string) => ({
  __typename: "MiniatureScheme",
  id,
  name: `Bronze ${id}`,
  category: "BROWN",
  isSystem: true,
  sourceId: "source",
  sourceName: "Source",
  sourceLogoUrl: null,
  paintCount: 2,
  availableCount: 2,
  previewSwatches: [],
  previewSwatchesTruncated: true,
  imageUrl: "/api/images/last-thumb",
  gradient: "linear-gradient(135deg, #123456 0%, #abcdef 100%)",
  paintNames: "Target A · Target B",
  usageCount: 3,
});
function page(id: string, seq: string, endCursor: string | null) {
  return Response.json({
    data: {
      schemes: {
        revision: { epoch: "vault", seq },
        nodes: [node(id)],
        totalCount: 2,
        pageInfo: { endCursor, hasNextPage: endCursor !== null },
        facets: {
          categories: [{ key: "BROWN", label: "Brown", count: 5 }],
          sources: [{ key: "source", label: "Source", count: 3 }],
          readiness: [{ key: "READY", label: "Ready to paint", count: 2 }],
        },
      },
    },
  });
}
void test("scheme loaded windows preserve all filters/facets/card summary and never write in-flight pages", async () => {
  const calls: unknown[] = [];
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      const { variables, operationName } = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
        variables: { after: string | null };
        operationName: string;
      };
      assert.equal(operationName, "SchemesPage");
      calls.push(variables);
      return page(variables.after ? "second" : "first", "1", variables.after ? null : "next");
    },
  });
  const result = await readSchemes(transport.client, filters, 2);
  assert.deepEqual(calls, [
    { ...filters, after: null },
    { ...filters, after: "next" },
  ]);
  assert.deepEqual(
    result.nodes.map((item) => item.name),
    ["Bronze first", "Bronze second"],
  );
  assert.equal(result.nodes[1].paintNames, "Target A · Target B");
  assert.equal(result.nodes[1].usageCount, 3);
  assert.equal(result.nodes[1].imageUrl, "/api/images/last-thumb");
  assert.match(result.nodes[1].gradient, /#abcdef/);
  assert.equal(result.facets.categories[0].count, 5);
  assert.equal(result.totalCount, 2);
  assert.equal(result.pageInfo.hasNextPage, false);
  assert.deepEqual(transport.client.cache.extract(), {});
  transport.dispose();
});
void test("revision changes restart loaded scheme window from page one without mixing rows", async () => {
  let calls = 0;
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      const { variables } = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
        variables: { after: string | null };
      };
      calls++;
      return page(`${calls}`, calls === 1 ? "1" : "2", variables.after ? null : "next");
    },
  });
  const result = await readSchemes(transport.client, filters, 2);
  assert.equal(calls, 4);
  assert.deepEqual(
    result.nodes.map((item) => item.id),
    ["3", "4"],
  );
  assert.equal(result.revision.seq, "2");
  assert.deepEqual(transport.client.cache.extract(), {});
  transport.dispose();
});
void test("STALE_CURSOR retries while malformed cursors and network failures surface", async () => {
  let calls = 0;
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () => {
      calls++;
      if (calls === 1)
        return Response.json({ errors: [{ message: "changed", extensions: { code: "STALE_CURSOR" } }] });
      return page("fresh", "2", null);
    },
  });
  assert.equal((await readSchemes(transport.client, filters)).nodes[0].id, "fresh");
  assert.equal(calls, 2);
  transport.dispose();
  const broken = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () => page("bad", "1", "repeat"),
  });
  await assert.rejects(readSchemes(broken.client, filters, 3), /invalid page cursor/);
  broken.dispose();
});
void test("continuously changing scheme revisions fail explicitly after bounded retries", async () => {
  let calls = 0;
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      const { variables } = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
        variables: { after: string | null };
      };
      calls++;
      return page("unstable", String(calls), variables.after ? null : "next");
    },
  });
  await assert.rejects(readSchemes(transport.client, filters, 2), /changed while refreshing/);
  assert.equal(calls, 6);
  transport.dispose();
});
