import { i18n } from "@paint-vault/i18n/runtime";
import type { ApolloClient } from "@apollo/client";

import { getFragmentData } from "./generated/fragment-masking";
import {
  MiniatureSchemeSummaryFragmentDoc,
  SchemesPageDocument,
  type SchemesPageQuery,
  type SchemesPageQueryVariables,
} from "./generated/graphql";
import { isStaleLibraryCursor } from "./library-loader";

export type SchemesVariables = Omit<SchemesPageQueryVariables, "after" | "usesPaintIds"> & {
  usesPaintIds: string[];
};
function unpack(raw: SchemesPageQuery["schemes"]) {
  return {
    ...raw,
    nodes: raw.nodes.map((node) => ({
      ...getFragmentData(MiniatureSchemeSummaryFragmentDoc, node),
      sourceId: node.sourceId,
      gradient: node.gradient,
      paintNames: node.paintNames,
      usageCount: node.usageCount,
      previewMoreCount: node.previewMoreCount,
    })),
  };
}
export type SchemesRead = ReturnType<typeof unpack>;
export type SchemeCardProjection = SchemesRead["nodes"][number];

// Read an entire loaded list window privately. A revision change between pages
// restarts the chain; none of those mixed pages can enter Apollo or the screen.
export async function readSchemes(
  client: ApolloClient,
  variables: SchemesVariables,
  pages = 1,
): Promise<SchemesRead> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      let combined: SchemesRead | undefined;
      let after: string | null = null;
      for (let page = 0; page < Math.max(1, pages); page += 1) {
        const { data } = await client.query({
          query: SchemesPageDocument,
          variables: { ...variables, after },
          fetchPolicy: "no-cache",
        });
        if (!data) throw new Error(i18n.t("shell:schemesResponseWasEmpty"));
        const next = unpack(data.schemes);
        if (
          combined &&
          (combined.revision.epoch !== next.revision.epoch || combined.revision.seq !== next.revision.seq)
        ) {
          combined = undefined;
          break;
        }
        combined = combined ? { ...next, nodes: [...combined.nodes, ...next.nodes] } : next;
        if (!next.pageInfo.hasNextPage) break;
        const cursor = next.pageInfo.endCursor;
        if (!cursor || cursor === after) throw new Error(i18n.t("shell:schemesReturnedAnInvalidPageCursor"));
        after = cursor;
      }
      if (combined) return combined;
    } catch (error) {
      if (!isStaleLibraryCursor(error)) throw error;
    }
  }
  throw new Error(i18n.t("shell:schemesChangedWhileRefreshingTryAgain"));
}
