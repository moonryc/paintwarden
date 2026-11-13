// Fixture-only server projections; never imported by production hooks.
import { createFuzzyIndex, searchFuzzyIndex } from "@paint-vault/core/fuzzy-search";

import type { MiniatureTemplate, MiniatureTemplateRecipe, State } from "../types";

import { fixtureMiniatureResponse } from "./miniature-api-fixtures";

export const sampleTemplates: MiniatureTemplate[] = [
  {
    id: "example:template-knight",
    name: "Example Knight",
    imageUrl: "",
    categories: ["Infantry"],
    faction: "Order of the Lantern",
    schemeCount: 0,
    paintCount: 0,
    manufacturer: "Example Miniatures",
    kind: "source",
    sourceName: "Example paint source",
  },
];
const page = <T>(nodes: T[], first: number, after: unknown) => {
  const start = Number(after ?? 0),
    end = Math.min(start + first, nodes.length);
  return {
    nodes: nodes.slice(start, end),
    totalCount: nodes.length,
    pageInfo: { hasNextPage: end < nodes.length, endCursor: String(end) },
  };
};
export function fixtureTemplateResponse(
  data: State,
  operation: string | undefined,
  vars: Record<string, unknown>,
  revision: { epoch: string; seq: string },
  templates = sampleTemplates,
  recipe: MiniatureTemplateRecipe = { schemeIds: [], paints: [] },
): Record<string, unknown> | null {
  if (operation === "TemplateSummaries") {
    const all = templates.map((row) => ({
      __typename: "TemplateSummary",
      ...row,
      sourceId: row.sourceName ? row.sourceName : null,
      sourceName: row.sourceName ?? null,
      sourceLogoUrl: row.sourceLogoUrl ?? null,
    }));
    const candidates = all.filter(
      (row) =>
        (!vars.id || row.id === vars.id) &&
        (!vars.category || row.categories.includes(typeof vars.category === "string" ? vars.category : "")) &&
        (!vars.sourceId || row.sourceId === vars.sourceId) &&
        (!vars.noSource || !row.sourceId),
    );
    const rows = vars.search
      ? searchFuzzyIndex(
          createFuzzyIndex(candidates, (row) => `${row.name} ${row.manufacturer} ${row.faction}`),
          typeof vars.search === "string" ? vars.search : "",
        )
      : candidates;
    return {
      templates: {
        revision,
        templates: page(rows, Number(vars.first ?? 48), vars.after),
        categoryCounts: [...new Set(all.flatMap((row) => row.categories))].map((key) => ({
          key,
          label: key,
          count: all.filter((row) => row.categories.includes(key)).length,
        })),
        sourceCounts: [...new Set(all.flatMap((row) => (row.sourceId ? [row.sourceId] : [])))].map((key) => ({
          key,
          label: key,
          count: all.filter((row) => row.sourceId === key).length,
        })),
      },
    };
  }
  if (operation === "SelectedTemplateRecipe")
    return {
      templateRecipe: {
        revision,
        templateId: vars.id,
        paints: page(
          recipe.paints.map((row) => {
            const paint = data.catalog.find((paint) => paint.id === row.paintId);
            return { ...row, paintName: paint?.name ?? row.paintId, paintBrand: paint?.brand ?? "" };
          }),
          100,
          vars.paintAfter,
        ),
        schemes: page(
          recipe.schemeIds.map((schemeId) => ({
            schemeId,
            name: data.colorSchemes.find((scheme) => scheme.id === schemeId)?.name ?? schemeId,
          })),
          100,
          vars.schemeAfter,
        ),
      },
    };
  if (operation === "TemplateSourceMiniature")
    return fixtureMiniatureResponse(
      data,
      "ProjectMiniatureDetails",
      { ...vars, recipeAfter: vars.paintAfter, schemesAfter: vars.schemeAfter },
      revision,
    );
  const mutation = {
    CreateReusableTemplate: "createTemplate",
    UpdateReusableTemplate: "updateTemplate",
    DeleteReusableTemplate: "deleteTemplate",
  }[operation ?? ""];
  if (mutation)
    return {
      [mutation]: {
        revision,
        templateId: vars.id ?? "user:created-template",
        clientMutationId: vars.clientMutationId ?? null,
        invalidatedFamilies: ["TEMPLATES"],
      },
    };
  return null;
}
