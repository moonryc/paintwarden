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
const schemeSummary = (id = "scheme") => ({
  id,
  name: id,
  category: null,
  isSystem: false,
  sourceName: null,
  sourceLogoUrl: null,
  paintCount: 0,
  availableCount: 0,
  previewSwatches: [],
  previewSwatchesTruncated: false,
  imageUrl: null,
  thumbnailUrl: null,
});
const entry = (id: string, schemeId: string, kind = "PAINT") => ({
  id,
  schemeId,
  kind,
  sortOrder: Number(id.replace(/\D/g, "")) || 0,
  paint: kind === "PAINT" ? paint("same-paint") : null,
  label: kind === "DIVIDER" ? "Keep this divider" : null,
  tone: null,
  role: null,
  imageUrl: kind === "IMAGE" ? "/full-image.webp" : null,
  thumbnailUrl: kind === "IMAGE" ? "/thumbnail.webp" : null,
  imageType: null,
  method: null,
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
              scheme: schemeSummary(),
            },
          ]
        : [],
    ),
    attachedSchemeEntries: connection([]),
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

void test("attached entry revision changes restart miniature and all attached schemes", async () => {
  let calls = 0;
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
        operationName: string;
        variables: { recipeAfter?: string | null; entriesAfter?: string | null };
      };
      assert.equal(body.operationName, "ProjectMiniatureDetails");
      calls++;
      const view = detail(calls === 1 ? "1" : "2", body.variables.recipeAfter ? 1 : 0, true);
      return Response.json({
        data: {
          miniature: {
            ...view,
            attachedSchemeEntries: connection(
              [entry(`entry${calls}`, "scheme")],
              !body.variables.entriesAfter,
            ),
          },
        },
      });
    },
  });
  const view = await readMiniatureDetail(transport.client, "miniature");
  assert.equal(calls, 4);
  assert.equal(view.revision.seq, "2");
  assert.equal(view.attachedSchemes[0].revision.seq, "2");
  assert.deepEqual(
    view.attachedSchemes[0].entries.nodes.map((row) => row.id),
    ["entry3", "entry4"],
  );
  transport.dispose();
});

void test("one detail request batches multiple attached schemes, including empty and mixed recipes", async () => {
  let calls = 0;
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as { operationName: string };
      assert.equal(body.operationName, "ProjectMiniatureDetails");
      calls++;
      return Response.json({
        data: {
          miniature: {
            ...detail("1", 1),
            schemes: connection(
              Array.from({ length: 8 }, (_, i) => ({
                id: `link${i}`,
                sortOrder: i,
                scheme: schemeSummary(`scheme${i}`),
              })),
            ),
            attachedSchemeEntries: connection([
              entry("paint1", "scheme0"),
              entry("paint2", "scheme0"),
              entry("divider3", "scheme0", "DIVIDER"),
              entry("image4", "scheme7", "IMAGE"),
            ]),
          },
        },
      });
    },
  });
  const view = await readMiniatureDetail(transport.client, "miniature");
  assert.equal(calls, 1, "no per-scheme follow-up requests");
  assert.equal(view.attachedSchemes.length, 8);
  assert.deepEqual(
    view.attachedSchemes[0].entries.nodes.map((row) => row.paint?.id ?? row.kind),
    ["same-paint", "same-paint", "DIVIDER"],
  );
  assert.equal(view.attachedSchemes[1].entries.totalCount, 0);
  assert.equal(view.attachedSchemes[7].entries.nodes[0].imageUrl, "/full-image.webp");
  assert.equal(view.attachedSchemes[7].entries.nodes[0].thumbnailUrl, "/thumbnail.webp");
  assert.deepEqual(transport.client.cache.extract(), {}, "aggregate remains uncommitted");
  transport.dispose();
});

void test("more than 40 schemes and entries complete independent bounded connections without truncation", async () => {
  const schemes = Array.from({ length: 45 }, (_, i) => ({
    id: `link${i}`,
    sortOrder: i,
    scheme: schemeSummary(`scheme${i}`),
  }));
  // One large scheme spans pages; entries also reach the final attached scheme.
  const entries = Array.from({ length: 83 }, (_, i) => entry(`entry${i}`, i < 82 ? "scheme0" : "scheme44"));
  const page = <T>(rows: T[], after?: string | null) => {
    const offset = Number(after ?? 0),
      end = Math.min(offset + 40, rows.length);
    return {
      nodes: rows.slice(offset, end),
      totalCount: rows.length,
      pageInfo: { hasNextPage: end < rows.length, endCursor: String(end) },
    };
  };
  const requests: Array<{
    recipeAfter?: string | null;
    schemesAfter?: string | null;
    entriesAfter?: string | null;
  }> = [];
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
        operationName: string;
        variables: (typeof requests)[number];
      };
      assert.equal(body.operationName, "ProjectMiniatureDetails");
      requests.push(body.variables);
      return Response.json({
        data: {
          miniature: {
            ...detail("1", body.variables.recipeAfter ? 1 : 0),
            schemes: page(schemes, body.variables.schemesAfter),
            attachedSchemeEntries: page(entries, body.variables.entriesAfter),
          },
        },
      });
    },
  });
  const view = await readMiniatureDetail(transport.client, "miniature");
  assert.equal(requests.length, 3, "request count follows the largest page stream, not scheme count");
  assert.deepEqual(
    requests.map((request) => request.entriesAfter),
    [null, "40", "80"],
  );
  assert.deepEqual(
    requests.map((request) => request.schemesAfter),
    [null, "40", null],
  );
  assert.equal(view.schemes.nodes.length, 45);
  assert.equal(view.attachedSchemeEntries.nodes.length, 83);
  assert.equal(view.attachedSchemes[0].entries.nodes.length, 82);
  assert.equal(view.attachedSchemes[44].entries.nodes[0].id, "entry82");
  assert.equal(view.attachedSchemes[0].entries.pageInfo.hasNextPage, false);
  assert.equal(view.recipe.nodes.length, 2, "finished recipe pages are not appended again");
  transport.dispose();
});

void test("stale attached entry cursors restart the entire window without partial cache writes", async () => {
  let calls = 0;
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () => {
      calls++;
      if (calls === 2)
        return Response.json({ errors: [{ message: "Changed", extensions: { code: "STALE_CURSOR" } }] });
      return Response.json({ data: { miniature: detail(calls === 1 ? "1" : "2", calls === 4 ? 1 : 0) } });
    },
  });
  const view = await readMiniatureDetail(transport.client, "miniature");
  assert.equal(calls, 4);
  assert.equal(view.revision.seq, "2");
  assert.equal(view.recipe.nodes.length, 2);
  assert.deepEqual(transport.client.cache.extract(), {});
  transport.dispose();
});

void test("non-advancing attached entry pages fail rather than returning a truncated recipe", async () => {
  let calls = 0;
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () => {
      calls++;
      return Response.json({
        data: {
          miniature: {
            ...detail("1", 1),
            attachedSchemeEntries: connection([entry("entry1", "scheme")], true),
          },
        },
      });
    },
  });
  await assert.rejects(readMiniatureDetail(transport.client, "miniature"), /pagination did not advance/i);
  assert.equal(calls, 2);
  assert.deepEqual(transport.client.cache.extract(), {});
  transport.dispose();
});
