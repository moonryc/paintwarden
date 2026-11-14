import type { ApolloClient } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { i18n } from "@paintwarden/i18n/runtime";

import { ColorToolIndexDocument, type ColorToolIndexQuery } from "./generated/graphql";

export type ColorIndexRead = ColorToolIndexQuery["colorIndex"];
export async function readColorIndex(client: ApolloClient): Promise<ColorIndexRead> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let result: ColorIndexRead | null = null;
    let after: string | null = null;
    const seen = new Set<string>();
    try {
      do {
        const response = await client.query({
          query: ColorToolIndexDocument,
          variables: { after },
          fetchPolicy: "no-cache",
        });
        const data: ColorToolIndexQuery | undefined = response.data;
        if (!data) throw new Error(i18n.t("components:scanLoadFailed"));
        const next: ColorIndexRead = data.colorIndex;
        if (
          result &&
          (result.revision.epoch !== next.revision.epoch || result.revision.seq !== next.revision.seq)
        )
          break;
        result = result ? { ...next, nodes: [...result.nodes, ...next.nodes] } : next;
        if (!next.pageInfo.hasNextPage) return result;
        if (!next.pageInfo.endCursor || seen.has(next.pageInfo.endCursor))
          throw new Error(i18n.t("components:scanLoadFailed"));
        after = next.pageInfo.endCursor;
        seen.add(after);
      } while (after);
    } catch (error) {
      if (!(
        CombinedGraphQLErrors.is(error) &&
        error.errors.some((entry) => entry.extensions?.code === "STALE_CURSOR")
      ))
        throw error;
    }
  }
  throw new Error(i18n.t("components:scanLoadFailed"));
}
