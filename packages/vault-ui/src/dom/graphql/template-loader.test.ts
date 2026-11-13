import assert from "node:assert/strict";
import test from "node:test";

import { createVaultGraphQLClient } from "./client";
import { readTemplateRecipe, readTemplateSourceMiniature, readTemplateSummaries } from "./template-loader";

const revision = (seq = "1") => ({ epoch: "templates", seq });
const connection = <T>(nodes: T[], page: number, pages: number) => ({
  nodes,
  totalCount: pages,
  pageInfo: { hasNextPage: page < pages, endCursor: String(page) },
});
const json = (data: unknown) => Response.json({ data });
const stale = () => Response.json({ errors: [{ message: "changed", extensions: { code: "STALE_CURSOR" } }] });
function scope(respond: (operation: string, variables: Record<string, unknown>) => Response) {
  return createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
        operationName: string;
        variables: Record<string, unknown>;
      };
      return respond(body.operationName, body.variables);
    },
  });
}

void test("template summaries page global results/facets without a recipe or cache writes", async () => {
  const requests: Record<string, unknown>[] = [];
  const client = scope((operation, variables) => {
    assert.equal(operation, "TemplateSummaries");
    requests.push(variables);
    const page = Number(variables.after ?? 0) + 1;
    return json({
      templates: {
        revision: revision(),
        categoryCounts: [{ key: "Infantry", label: "Infantry", count: 500 }],
        sourceCounts: [{ key: "plugin", label: "Plugin", count: 800 }],
        templates: connection(
          [
            {
              id: `template-${page}`,
              name: `Knight ${page}`,
              manufacturer: "Maker",
              faction: "Order",
              imageUrl: "",
              categories: ["Infantry"],
              kind: "source",
              sourceId: "plugin",
              sourceName: "Plugin",
              sourceLogoUrl: null,
              schemeCount: 900,
              paintCount: 1500,
            },
          ],
          page,
          13,
        ),
      },
    });
  });
  try {
    const result = await readTemplateSummaries(
      client.client,
      { search: "knight", category: "Infantry", sourceId: "plugin" },
      100,
    );
    assert.equal(result.templates.templates.nodes.length, 13);
    assert.equal(requests.length, 13);
    assert.equal(result.templates.categoryCounts[0].count, 500);
    assert.ok(
      requests.every((vars) => vars.first === 48 && vars.search === "knight" && vars.sourceId === "plugin"),
    );
    assert.deepEqual(client.client.cache.extract(), {});
  } finally {
    client.client.stop();
  }
});

void test("recipe loads every paint and scheme page independently with no repeated first-page rows", async () => {
  const requests: Record<string, unknown>[] = [];
  const client = scope((operation, vars) => {
    assert.equal(operation, "SelectedTemplateRecipe");
    requests.push(vars);
    const paintPage = Number(vars.paintAfter ?? 0) + 1,
      schemePage = Number(vars.schemeAfter ?? 0) + 1;
    return json({
      templateRecipe: {
        revision: revision(),
        templateId: "user:template",
        paints: connection(
          [
            {
              paintId: `p${paintPage}`,
              paintName: "Paint",
              paintBrand: "Brand",
              step: "BASECOAT",
              notes: "Keep notes",
              sortOrder: paintPage,
            },
          ],
          paintPage,
          7,
        ),
        schemes: connection([{ schemeId: `s${schemePage}`, name: "Scheme" }], schemePage, 2),
      },
    });
  });
  try {
    const result = await readTemplateRecipe(client.client, "user:template");
    assert.equal(requests.length, 7);
    assert.deepEqual(
      result.templateRecipe.paints.nodes.map((row) => row.paintId),
      ["p1", "p2", "p3", "p4", "p5", "p6", "p7"],
    );
    assert.deepEqual(
      result.templateRecipe.schemes.nodes.map((row) => row.schemeId),
      ["s1", "s2"],
    );
    assert.ok(requests.slice(2).every((vars) => vars.schemeAfter === null));
    assert.deepEqual(client.client.cache.extract(), {});
  } finally {
    client.client.stop();
  }
});

void test("mixed template revisions restart whole recipe and stale cursors retry summaries", async () => {
  let calls = 0;
  const client = scope((_operation, vars) => {
    calls += 1;
    const page = Number(vars.paintAfter ?? 0) + 1;
    return json({
      templateRecipe: {
        revision: revision(calls === 1 ? "1" : "2"),
        templateId: "t",
        paints: connection(
          [
            {
              paintId: `p${page}`,
              paintName: "P",
              paintBrand: "B",
              step: "OTHER",
              notes: "",
              sortOrder: page,
            },
          ],
          page,
          2,
        ),
        schemes: connection([], 1, 1),
      },
    });
  });
  try {
    const result = await readTemplateRecipe(client.client, "t");
    assert.equal(calls, 4);
    assert.equal(result.templateRecipe.revision.seq, "2");
    assert.equal(result.templateRecipe.paints.nodes.length, 2);
  } finally {
    client.client.stop();
  }
  let tries = 0;
  const summaries = scope(() =>
    ++tries === 1
      ? stale()
      : json({
          templates: {
            revision: revision(),
            categoryCounts: [],
            sourceCounts: [],
            templates: connection([], 1, 1),
          },
        }),
  );
  try {
    await readTemplateSummaries(summaries.client, {});
    assert.equal(tries, 2);
  } finally {
    summaries.client.stop();
  }
});

void test("selected source miniature fetches only compact recipe and preserves repeated steps", async () => {
  let calls = 0;
  const client = scope((operation, vars) => {
    assert.equal(operation, "TemplateSourceMiniature");
    calls += 1;
    const page = Number(vars.paintAfter ?? 0) + 1;
    return json({
      miniature: {
        revision: revision(),
        miniature: { id: "model", title: "Knight", manufacturer: "Maker", faction: "Order", imageUrl: null },
        recipe: connection(
          [
            {
              paint: { id: "paint", name: "Red", brand: "Brand" },
              step: page === 1 ? "BASECOAT" : "HIGHLIGHT",
              notes: `notes ${page}`,
              sortOrder: page,
            },
          ],
          page,
          2,
        ),
        schemes: connection([{ scheme: { id: "s1", name: "Scheme" } }], 1, 1),
      },
    });
  });
  try {
    const result = await readTemplateSourceMiniature(client.client, "model");
    assert.equal(calls, 2);
    assert.equal(result.miniature.recipe.nodes.length, 2);
    assert.equal(result.miniature.schemes.nodes.length, 1);
    assert.deepEqual(
      result.miniature.recipe.nodes.map((row) => row.notes),
      ["notes 1", "notes 2"],
    );
    assert.deepEqual(client.client.cache.extract(), {});
  } finally {
    client.client.stop();
  }
});

void test("invalid recipe cursors and perpetual revision churn fail instead of saving partial recipes", async () => {
  const client = scope(() =>
    json({
      templateRecipe: {
        revision: revision(),
        templateId: "t",
        paints: { nodes: [], pageInfo: { hasNextPage: true, endCursor: null } },
        schemes: connection([], 1, 1),
      },
    }),
  );
  try {
    await assert.rejects(readTemplateRecipe(client.client, "t"), /invalid page cursor/);
  } finally {
    client.client.stop();
  }
});
