import type { ApolloClient } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { i18n } from "@paintwarden/i18n/runtime";

import {
  ColorToolIndexDocument,
  SchemeColorToolIndexDocument,
  type ColorToolIndexQuery,
  type SchemeColorToolIndexQuery,
} from "./generated/graphql";

export type ColorIndexRead = ColorToolIndexQuery["colorIndex"];
type SchemeColorPage = SchemeColorToolIndexQuery["schemeColorIndex"];
type IndexPage = ColorIndexRead | SchemeColorPage;
async function readIndexPages<T extends IndexPage>(
  readPage: (after: string | null) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let result: T | null = null;
    let after: string | null = null;
    const seen = new Set<string>();
    try {
      do {
        const next: T = await readPage(after);
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

export async function readColorIndex(client: ApolloClient): Promise<ColorIndexRead> {
  return readIndexPages(async (after) => {
    const { data } = await client.query({
      query: ColorToolIndexDocument,
      variables: { after },
      fetchPolicy: "no-cache",
    });
    if (!data) throw new Error(i18n.t("components:scanLoadFailed"));
    return data.colorIndex;
  });
}

export type SchemeColorIndexScheme = {
  id: string;
  name: string;
  paints: SchemeColorPage["nodes"][number]["paint"][];
};
export type SchemeColorIndexRead = {
  revision: SchemeColorPage["revision"];
  schemes: SchemeColorIndexScheme[];
};
export async function readSchemeColorIndex(client: ApolloClient): Promise<SchemeColorIndexRead> {
  const result = await readIndexPages(async (after) => {
    const { data } = await client.query({
      query: SchemeColorToolIndexDocument,
      variables: { after },
      fetchPolicy: "no-cache",
    });
    if (!data) throw new Error(i18n.t("components:scanLoadFailed"));
    return data.schemeColorIndex;
  });
  const byId = new Map<string, SchemeColorIndexScheme>();
  for (const { schemeId, schemeName, paint } of result.nodes) {
    let scheme = byId.get(schemeId);
    if (!scheme) {
      scheme = { id: schemeId, name: schemeName, paints: [] };
      byId.set(schemeId, scheme);
    }
    scheme.paints.push(paint);
  }
  return { revision: result.revision, schemes: [...byId.values()] };
}
