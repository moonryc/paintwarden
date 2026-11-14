import { i18n } from "@paintwarden/i18n/runtime";
import type { ApolloClient } from "@apollo/client";

import {
  SelectedTemplateRecipeDocument,
  TemplateSourceMiniatureDocument,
  TemplateSummariesDocument,
  type SelectedTemplateRecipeQuery,
  type TemplateSourceMiniatureQuery,
  type TemplateSummariesQuery,
  type TemplateSummariesQueryVariables,
} from "./generated/graphql";
import type { Revision } from "./invalidation";
import { isStaleLibraryCursor } from "./library-loader";

export const TEMPLATE_PAGE_SIZE = 48;
export type TemplateVariables = Omit<TemplateSummariesQueryVariables, "first" | "after">;
const sameRevision = (a: Revision, b: Revision) => a.epoch === b.epoch && a.seq === b.seq;

type Connection = { pageInfo: { hasNextPage: boolean; endCursor?: string | null } };
function nextCursor(connection: Connection, previous: string | null) {
  if (!connection.pageInfo.hasNextPage) return null;
  const next = connection.pageInfo.endCursor;
  if (!next || next === previous) throw new Error(i18n.t("shell:templatesReturnedAnInvalidPageCursor"));
  return next;
}
async function stable<T>(read: () => Promise<T | undefined>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const data = await read();
      if (data) return data;
    } catch (error) {
      if (!isStaleLibraryCursor(error)) throw error;
    }
  }
  throw new Error(i18n.t("shell:templatesChangedWhileRefreshingTryAgain"));
}

// Only the explicitly loaded summary window is rebuilt after invalidation. No
// recipe read or normalized entity write is permitted from this loader.
export function readTemplateSummaries(client: ApolloClient, variables: TemplateVariables, pages = 1) {
  return stable(async () => {
    let combined: TemplateSummariesQuery | undefined;
    let after: string | null = null;
    for (let page = 0; page < Math.max(1, pages); page += 1) {
      const { data } = await client.query({
        query: TemplateSummariesDocument,
        variables: { ...variables, first: TEMPLATE_PAGE_SIZE, after },
        fetchPolicy: "no-cache",
      });
      if (!data) throw new Error(i18n.t("shell:templateSummariesResponseWasEmpty"));
      if (combined && !sameRevision(combined.templates.revision, data.templates.revision)) return undefined;
      combined = combined
        ? {
            templates: {
              ...data.templates,
              templates: {
                ...data.templates.templates,
                nodes: [...combined.templates.templates.nodes, ...data.templates.templates.nodes],
              },
            },
          }
        : data;
      after = nextCursor(data.templates.templates, after);
      if (!after) break;
    }
    return combined;
  });
}

// Both independent connection chains must agree on one revision before the
// editor can replace a whole recipe. Continue until complete, never a page cap.
export function readTemplateRecipe(client: ApolloClient, id: string) {
  return stable(async () => {
    let combined: SelectedTemplateRecipeQuery | undefined;
    let paintAfter: string | null = null;
    let schemeAfter: string | null = null;
    do {
      const { data }: { data?: SelectedTemplateRecipeQuery } = await client.query({
        query: SelectedTemplateRecipeDocument,
        variables: { id, paintAfter, schemeAfter },
        fetchPolicy: "no-cache",
      });
      if (!data) throw new Error(i18n.t("shell:templateRecipeResponseWasEmpty"));
      if (combined && !sameRevision(combined.templateRecipe.revision, data.templateRecipe.revision))
        return undefined;
      const next: SelectedTemplateRecipeQuery["templateRecipe"] = data.templateRecipe;
      const firstPage = !combined;
      combined = combined
        ? {
            templateRecipe: {
              ...next,
              paints: {
                ...next.paints,
                nodes: paintAfter
                  ? [...combined.templateRecipe.paints.nodes, ...next.paints.nodes]
                  : combined.templateRecipe.paints.nodes,
              },
              schemes: {
                ...next.schemes,
                nodes: schemeAfter
                  ? [...combined.templateRecipe.schemes.nodes, ...next.schemes.nodes]
                  : combined.templateRecipe.schemes.nodes,
              },
            },
          }
        : data;
      paintAfter = paintAfter !== null || firstPage ? nextCursor(next.paints, paintAfter) : null;
      schemeAfter = schemeAfter !== null || firstPage ? nextCursor(next.schemes, schemeAfter) : null;
    } while (paintAfter || schemeAfter);
    return combined;
  });
}

export function readTemplateSourceMiniature(client: ApolloClient, id: string) {
  return stable(async () => {
    let combined: TemplateSourceMiniatureQuery | undefined;
    let paintAfter: string | null = null;
    let schemeAfter: string | null = null;
    do {
      const { data }: { data?: TemplateSourceMiniatureQuery } = await client.query({
        query: TemplateSourceMiniatureDocument,
        variables: { id, paintAfter, schemeAfter },
        fetchPolicy: "no-cache",
      });
      if (!data) throw new Error(i18n.t("shell:sourceMiniatureResponseWasEmpty"));
      if (combined && !sameRevision(combined.miniature.revision, data.miniature.revision)) return undefined;
      const next: TemplateSourceMiniatureQuery["miniature"] = data.miniature;
      const firstPage = !combined;
      combined = combined
        ? {
            miniature: {
              ...next,
              recipe: {
                ...next.recipe,
                nodes: paintAfter
                  ? [...combined.miniature.recipe.nodes, ...next.recipe.nodes]
                  : combined.miniature.recipe.nodes,
              },
              schemes: {
                ...next.schemes,
                nodes: schemeAfter
                  ? [...combined.miniature.schemes.nodes, ...next.schemes.nodes]
                  : combined.miniature.schemes.nodes,
              },
            },
          }
        : data;
      paintAfter = paintAfter !== null || firstPage ? nextCursor(next.recipe, paintAfter) : null;
      schemeAfter = schemeAfter !== null || firstPage ? nextCursor(next.schemes, schemeAfter) : null;
    } while (paintAfter || schemeAfter);
    return combined;
  });
}
