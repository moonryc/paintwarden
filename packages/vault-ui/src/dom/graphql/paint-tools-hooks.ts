import { normalizeSearch } from "../utils/use-search-results";
import { i18n } from "@paintwarden/i18n/runtime";
import type { ApolloClient } from "@apollo/client";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { getFragmentData } from "./generated/fragment-masking";
import { DetailPaintFragmentDoc, OwnedPaintPickerOptionsDocument } from "./generated/graphql";
import { useSchemeWindow } from "./miniature-scheme-hooks";
import {
  readPaintConversion,
  readPaintRankingWindow,
  writePaintConversion,
  writePaintRanking,
  type PaintRankingRead,
  type PaintConversionRead,
} from "./paint-tools-loader";
import { useVaultGraphQL } from "./provider";

const noMore = () => false;
const moreRanked = (data: PaintRankingRead) => data.pageInfo.hasNextPage;
export function usePaintRanking(id: string, ownedOnly = false) {
  const read = useCallback(
    (client: ApolloClient, pages: number) => readPaintRankingWindow(client, id, ownedOnly, pages),
    [id, ownedOnly],
  );
  const write = useCallback(
    (client: ApolloClient, data: PaintRankingRead) => writePaintRanking(client, id, ownedOnly, data),
    [id, ownedOnly],
  );
  return useSchemeWindow(JSON.stringify({ id, ownedOnly }), read, write, moreRanked);
}
export function usePaintConversion(ids: string[], choiceIds: string[]) {
  const key = JSON.stringify({ ids: [...new Set(ids)], choiceIds: [...new Set(choiceIds)].sort() });
  const variables = useMemo(() => JSON.parse(key) as { ids: string[]; choiceIds: string[] }, [key]);
  const read = useCallback(
    (client: ApolloClient) => readPaintConversion(client, variables.ids, variables.choiceIds),
    [variables],
  );
  const scope = useVaultGraphQL();
  const result = useSchemeWindow(key, read, writePaintConversion, noMore);
  const originals = JSON.stringify(variables.ids);
  const previous = useRef<{ scope: typeof scope; originals: string; data: PaintConversionRead } | null>(null);
  useEffect(() => {
    if (result.data) previous.current = { scope, originals, data: result.data };
  }, [scope, originals, result.data]);
  // A manual choice is validated without unmounting the active picker or its
  // keyboard focus. This is the prior accepted projection, never a partial read;
  // loading stays true and prevents saving until the replacement is accepted.
  const retained = previous.current;
  const data =
    result.data ?? (retained?.scope === scope && retained.originals === originals ? retained.data : null);
  return { ...result, data };
}
export function useOwnedPaintOptions(search: string) {
  search = normalizeSearch(search);
  const read = useCallback(
    async (client: ApolloClient, _pages: number, signal?: AbortSignal) => {
      const { data } = await client.query({
        query: OwnedPaintPickerOptionsDocument,
        variables: { search },
        fetchPolicy: "no-cache",
        context: { fetchOptions: { signal }, queryDeduplication: false },
      });
      if (!data) throw new Error(i18n.t("shell:ownedPaintsResponseWasEmpty"));
      return data.ownedPaintOptions;
    },
    [search],
  );
  const write = useCallback(
    (client: ApolloClient, data: Awaited<ReturnType<typeof read>>) => {
      client.writeQuery({
        query: OwnedPaintPickerOptionsDocument,
        variables: { search },
        data: { ownedPaintOptions: data },
      });
    },
    [search],
  );
  const { data, ...result } = useSchemeWindow(search, read, write, noMore, true, search);
  return { ...result, items: data ? getFragmentData(DetailPaintFragmentDoc, data.items) : [] };
}
