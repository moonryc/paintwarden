import { i18n } from "@paintwarden/i18n/runtime";
import type { ApolloClient } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";

import { getFragmentData } from "./generated/fragment-masking";
import {
  DetailPaintFragmentDoc,
  ProjectMiniatureDetailsDocument,
  type ProjectMiniatureDetailsQuery,
} from "./generated/graphql";
import { readMiniatureScheme } from "./miniature-scheme-hooks";

function unpack(view: ProjectMiniatureDetailsQuery["miniature"]) {
  return {
    ...view,
    recipe: {
      ...view.recipe,
      nodes: view.recipe.nodes.map((row) => ({
        ...row,
        paint: getFragmentData(DetailPaintFragmentDoc, row.paint),
      })),
    },
    missing: {
      ...view.missing,
      nodes: view.missing.nodes.map((row) => ({
        ...row,
        paint: getFragmentData(DetailPaintFragmentDoc, row.paint),
      })),
    },
    required: {
      ...view.required,
      nodes: view.required.nodes.map((paint) => getFragmentData(DetailPaintFragmentDoc, paint)),
    },
  };
}
type Detail = ReturnType<typeof unpack>;
type Scheme = Awaited<ReturnType<typeof readMiniatureScheme>>;
export type MiniatureDetailView = Detail & { attachedSchemes: Scheme[] };
const sameRevision = (a: Detail["revision"], b: Detail["revision"]) => a.epoch === b.epoch && a.seq === b.seq;
const families = ["recipe", "schemes", "missing", "required"] as const;

// A replacement recipe must never be built from a truncated page. Read bounded
// pages to completion, including attached scheme entries, and publish one revision.
// A concurrent edit restarts the whole aggregate instead of mixing old and new rows.
export async function readMiniatureDetail(client: ApolloClient, id: string): Promise<MiniatureDetailView> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      let view: Detail | null = null;
      const after: Record<(typeof families)[number], string | null> = {
        recipe: null,
        schemes: null,
        missing: null,
        required: null,
      };
      let changed = false;
      do {
        const { data } = await client.query({
          query: ProjectMiniatureDetailsDocument,
          variables: {
            id,
            recipeAfter: after.recipe,
            schemesAfter: after.schemes,
            missingAfter: after.missing,
            requiredAfter: after.required,
          },
          fetchPolicy: "no-cache",
        });
        if (!data) throw new Error(i18n.t("shell:miniatureDetailsResponseWasEmpty"));
        const next = unpack(data.miniature);
        if (view && !sameRevision(view.revision, next.revision)) {
          changed = true;
          break;
        }
        if (!view) view = next;
        else {
          if (after.recipe)
            view.recipe = { ...next.recipe, nodes: [...view.recipe.nodes, ...next.recipe.nodes] };
          if (after.schemes)
            view.schemes = { ...next.schemes, nodes: [...view.schemes.nodes, ...next.schemes.nodes] };
          if (after.missing)
            view.missing = { ...next.missing, nodes: [...view.missing.nodes, ...next.missing.nodes] };
          if (after.required)
            view.required = { ...next.required, nodes: [...view.required.nodes, ...next.required.nodes] };
        }
        for (const family of families) {
          const page = view[family].pageInfo;
          const cursor = page.hasNextPage ? page.endCursor : null;
          if (page.hasNextPage && (!cursor || cursor === after[family]))
            throw new Error(i18n.t("shell:miniaturePaginationDidNotAdvance"));
          after[family] = cursor ?? null;
        }
      } while (families.some((family) => after[family]));
      if (!view || changed) continue;
      const attachedSchemes: Scheme[] = [];
      for (const link of view.schemes.nodes) {
        const scheme = await readMiniatureScheme(client, link.scheme.id);
        if (!sameRevision(view.revision, scheme.revision) || !scheme.scheme) {
          changed = true;
          break;
        }
        attachedSchemes.push(scheme);
      }
      if (!changed) return { ...view, attachedSchemes };
    } catch (error) {
      if (
        CombinedGraphQLErrors.is(error) &&
        error.errors.some((entry) => entry.extensions?.code === "STALE_CURSOR")
      )
        continue;
      throw error;
    }
  }
  throw new Error(i18n.t("shell:miniatureChangedWhileRefreshingTryAgain"));
}
