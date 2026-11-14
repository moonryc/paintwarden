import { i18n } from "@paintwarden/i18n/runtime";
import type { ApolloClient } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";

import { getFragmentData } from "./generated/fragment-masking";
import {
  DetailPaintFragmentDoc,
  DetailSubstitutionFragmentDoc,
  PaintDetailsDocument,
  PaintSubstitutionIngredientsDocument,
  type PaintDetailsQuery,
} from "./generated/graphql";
import type { Revision } from "./invalidation";

const sameRevision = (a: Revision, b: Revision) => a.epoch === b.epoch && a.seq === b.seq;

function unpack(raw: PaintDetailsQuery["paint"]) {
  return {
    ...raw,
    paint: getFragmentData(DetailPaintFragmentDoc, raw.paint),
    substitutions: {
      ...raw.substitutions,
      nodes: raw.substitutions.nodes.map((ref) => {
        const mix = getFragmentData(DetailSubstitutionFragmentDoc, ref);
        return {
          ...mix,
          ingredients: {
            ...mix.ingredients,
            nodes: mix.ingredients.nodes.map((row) => ({
              ...row,
              paint: getFragmentData(DetailPaintFragmentDoc, row.paint),
            })),
          },
        };
      }),
    },
  };
}
export type PaintDetailView = ReturnType<typeof unpack>;
export type DetailWindow = { substitutions: number; usedBy: number; ingredients: Record<string, number> };

// Rebuild the loaded window atomically, never mixing pages (or ingredient pages) from revisions.
// Only a bounded page is requested at a time; additional pages follow explicit user navigation.
export async function readPaintDetail(client: ApolloClient, id: string, window: DetailWindow) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      let view: PaintDetailView | null = null;
      let substitutionsAfter: string | null = null;
      let usedByAfter: string | null = null;
      let changed = false;
      for (let page = 0; page < Math.max(window.substitutions, window.usedBy); page += 1) {
        const { data } = await client.query({
          query: PaintDetailsDocument,
          variables: { id, substitutionsAfter, usedByAfter },
          fetchPolicy: "no-cache",
        });
        if (!data) throw new Error(i18n.t("shell:paintDetailsResponseWasEmpty"));
        const next = unpack(data.paint);
        if (view && !sameRevision(view.revision, next.revision)) {
          changed = true;
          break;
        }
        if (!view) view = next;
        else {
          if (page < window.substitutions && substitutionsAfter)
            view.substitutions = {
              ...next.substitutions,
              nodes: [...view.substitutions.nodes, ...next.substitutions.nodes],
            };
          if (page < window.usedBy && usedByAfter)
            view.usedBy = { ...next.usedBy, nodes: [...view.usedBy.nodes, ...next.usedBy.nodes] };
        }
        substitutionsAfter =
          page + 1 < window.substitutions && view.substitutions.pageInfo.hasNextPage
            ? (view.substitutions.pageInfo.endCursor ?? null)
            : null;
        usedByAfter =
          page + 1 < window.usedBy && view.usedBy.pageInfo.hasNextPage
            ? (view.usedBy.pageInfo.endCursor ?? null)
            : null;
        if (!substitutionsAfter && !usedByAfter) break;
      }
      if (!view || changed) continue;
      for (const mix of view.substitutions.nodes) {
        for (
          let page = 0;
          page < (window.ingredients[mix.id] ?? 0) && mix.ingredients.pageInfo.hasNextPage;
          page += 1
        ) {
          const { data } = await client.query({
            query: PaintSubstitutionIngredientsDocument,
            variables: { id: mix.id, after: mix.ingredients.pageInfo.endCursor },
            fetchPolicy: "no-cache",
          });
          if (!data) throw new Error(i18n.t("shell:substitutionResponseWasEmpty"));
          if (!sameRevision(view.revision, data.substitution.revision)) {
            changed = true;
            break;
          }
          const ingredients = data.substitution.substitution?.ingredients;
          if (!ingredients) {
            changed = true;
            break;
          }
          mix.ingredients = {
            ...ingredients,
            nodes: [
              ...mix.ingredients.nodes,
              ...ingredients.nodes.map((row) => ({
                ...row,
                paint: getFragmentData(DetailPaintFragmentDoc, row.paint),
              })),
            ],
          };
        }
        if (changed) break;
      }
      if (!changed) return view;
    } catch (error) {
      if (
        CombinedGraphQLErrors.is(error) &&
        error.errors.some((entry) => entry.extensions?.code === "STALE_CURSOR")
      )
        continue;
      throw error;
    }
  }
  throw new Error(i18n.t("shell:paintChangedWhileRefreshingTryAgain"));
}
