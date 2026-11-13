import assert from "node:assert/strict";
import test from "node:test";

import { createVaultGraphQLClient } from "./client.ts";
import { readMiniatureDetail } from "./miniature-detail-loader.ts";

const paint = (id: string) => ({
  __typename: "Paint",
  id,
  brand: "Test",
  range: "Range",
  name: id,
  colorHex: "#123456",
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
});
const connection = <T>(nodes: T[], more = false) => ({
  nodes,
  totalCount: more ? 2 : nodes.length,
  pageInfo: { hasNextPage: more, endCursor: more ? "next" : null },
});
function detail(seq: string, page: number, scheme = false) {
  return {
    revision: { epoch: "vault", seq },
    miniature: {
      id: "miniature",
      title: "Project",
      status: "OWNED",
      paintingStatus: "NOT_STARTED",
      imageUrl: null,
      createdAt: 1,
      notes: "",
      manufacturer: "",
      faction: "",
      scale: "",
    },
    recipeSteps: ["BASECOAT"],
    recipe: connection(
      [{ id: `entry${page}`, paint: paint(`paint${page}`), step: "BASECOAT", notes: "", sortOrder: page }],
      page === 0,
    ),
    schemes: connection(
      scheme
        ? [
            {
              id: "link",
              sortOrder: 0,
              scheme: {
                id: "scheme",
                name: "Scheme",
                category: null,
                isSystem: false,
                sourceName: null,
                sourceLogoUrl: null,
              },
            },
          ]
        : [],
    ),
    missing: connection([
      { id: "paint0", paint: paint("paint0"), missingStock: true, brokenSubstitution: true },
    ]),
    required: connection([paint("paint0")]),
  };
}

void test("miniature detail completes bounded recipe pages without duplicating finished connections", async () => {
  const variables: Array<{ recipeAfter?: string | null }> = [];
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
        variables: { recipeAfter?: string | null };
      };
      variables.push(body.variables);
      return Response.json({ data: { miniature: detail("1", body.variables.recipeAfter ? 1 : 0) } });
    },
  });
  const view = await readMiniatureDetail(transport.client, "miniature");
  assert.equal(variables.length, 2);
  assert.equal(variables[1].recipeAfter, "next");
  assert.deepEqual(
    view.recipe.nodes.map((row) => row.paint.id),
    ["paint0", "paint1"],
  );
  assert.equal(view.required.nodes.length, 1);
  assert.equal(view.missing.nodes.length, 1);
  assert.equal(view.missing.nodes[0].missingStock, true);
  assert.equal(view.missing.nodes[0].brokenSubstitution, true, "reasons remain independent");
  assert.deepEqual(transport.client.cache.extract(), {}, "network pages never normalize before acceptance");
  transport.dispose();
});

void test("a recipe revision change restarts the entire detail window", async () => {
  let calls = 0;
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      calls++;
      const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
        variables: { recipeAfter?: string | null };
      };
      return Response.json({
        data: { miniature: detail(calls === 1 ? "1" : "2", body.variables.recipeAfter ? 1 : 0) },
      });
    },
  });
  const view = await readMiniatureDetail(transport.client, "miniature");
  assert.equal(calls, 4);
  assert.equal(view.revision.seq, "2");
  assert.equal(view.recipe.nodes.length, 2);
  transport.dispose();
});

void test("an attached scheme changing revision restarts miniature and all scheme entries", async () => {
  let calls = 0;
  let schemeCalls = 0;
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
        operationName: string;
        variables: { recipeAfter?: string | null };
      };
      if (body.operationName === "MiniatureSchemeDetails") {
        schemeCalls++;
        return Response.json({
          data: {
            miniatureScheme: {
              revision: { epoch: "vault", seq: "2" },
              scheme: {
                id: "scheme",
                name: "Scheme",
                category: null,
                isSystem: false,
                sourceName: null,
                sourceLogoUrl: null,
                paintCount: 0,
                availableCount: 0,
                previewSwatches: [],
                previewSwatchesTruncated: false,
                imageUrl: null,
              },
              entries: connection([]),
            },
          },
        });
      }
      calls++;
      return Response.json({
        data: { miniature: detail(calls <= 2 ? "1" : "2", body.variables.recipeAfter ? 1 : 0, true) },
      });
    },
  });
  const view = await readMiniatureDetail(transport.client, "miniature");
  assert.equal(calls, 4);
  assert.equal(schemeCalls, 2);
  assert.equal(view.revision.seq, "2");
  assert.equal(view.attachedSchemes[0].revision.seq, "2");
  transport.dispose();
});
