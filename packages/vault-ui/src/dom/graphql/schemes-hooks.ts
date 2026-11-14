import { i18n } from "@paint-vault/i18n/runtime";
import type { ApolloClient } from "@apollo/client";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getFragmentData, makeFragmentData } from "./generated/fragment-masking";
import {
  DetailPaintFragmentDoc,
  MiniatureSchemeSummaryFragmentDoc,
  SchemesPageDocument,
  SchemeUsedPaintOptionsDocument,
} from "./generated/graphql";
import { useSchemeWindow } from "./miniature-scheme-hooks";
import { useVaultGraphQL } from "./provider";
import { readSchemes, type SchemesRead, type SchemesVariables } from "./schemes-loader";

const moreSchemes = (data: SchemesRead) => data.pageInfo.hasNextPage;
export function useSchemes(filters: SchemesVariables) {
  const key = JSON.stringify({ ...filters, usesPaintIds: [...new Set(filters.usesPaintIds)].sort() });
  const variables = useMemo(() => JSON.parse(key) as SchemesVariables, [key]);
  const read = useCallback(
    (client: ApolloClient, pages: number) => readSchemes(client, variables, pages),
    [variables],
  );
  const write = useCallback(
    (client: ApolloClient, data: SchemesRead) => {
      client.writeQuery({
        query: SchemesPageDocument,
        variables: { ...variables, after: null },
        data: {
          schemes: {
            ...data,
            nodes: data.nodes.map((node) => ({
              ...makeFragmentData(node, MiniatureSchemeSummaryFragmentDoc),
              sourceId: node.sourceId,
              gradient: node.gradient,
              paintNames: node.paintNames,
              usageCount: node.usageCount,
              previewMoreCount: node.previewMoreCount,
            })),
          },
        },
      });
    },
    [variables],
  );
  const { data, ...result } = useSchemeWindow(key, read, write, moreSchemes);
  const scope = useVaultGraphQL();
  const [previousFacets, setPreviousFacets] = useState<{
    scope: typeof scope;
    facets: SchemesRead["facets"];
  } | null>(null);
  useEffect(() => {
    if (data) setPreviousFacets({ scope, facets: data.facets });
  }, [scope, data]);
  return {
    ...result,
    items: data?.nodes ?? [],
    facets: data?.facets ?? (previousFacets?.scope === scope ? previousFacets.facets : null),
    totalCount: data?.totalCount ?? 0,
    hasNextPage: data?.pageInfo.hasNextPage ?? false,
  };
}

const noMore = () => false;
export function useSchemePaintOptions(search: string, excludeIds: string[]) {
  const key = JSON.stringify({ search, excludeIds: [...new Set(excludeIds)].sort() });
  const variables = useMemo(() => JSON.parse(key) as { search: string; excludeIds: string[] }, [key]);
  const read = useCallback(
    async (client: ApolloClient) => {
      const { data } = await client.query({
        query: SchemeUsedPaintOptionsDocument,
        variables,
        fetchPolicy: "no-cache",
      });
      if (!data) throw new Error(i18n.t("shell:schemePaintsResponseWasEmpty"));
      return data.schemePaintOptions;
    },
    [variables],
  );
  const write = useCallback(
    (client: ApolloClient, data: Awaited<ReturnType<typeof read>>) => {
      client.writeQuery({
        query: SchemeUsedPaintOptionsDocument,
        variables,
        data: { schemePaintOptions: data },
      });
    },
    [variables],
  );
  const { data, ...result } = useSchemeWindow(`used-paints:${key}`, read, write, noMore);
  return { ...result, items: data ? getFragmentData(DetailPaintFragmentDoc, data.items) : [] };
}
