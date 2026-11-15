import { normalizeSearch, SEARCH_DEBOUNCE_MS, useSearchResults } from "../utils/use-search-results";
import { i18n } from "@paintwarden/i18n/runtime";
import type { ApolloClient } from "@apollo/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { makeFragmentData } from "./generated/fragment-masking";
import {
  DetailPaintFragmentDoc,
  MiniatureSchemeDetailsDocument,
  MiniatureSchemeSummaryFragmentDoc,
  SchemePickerOptionsDocument,
} from "./generated/graphql";
import type { ReadTicket, Revision, VaultFamily } from "./invalidation";
import {
  readMiniatureScheme,
  readSchemeOptions,
  type MiniatureSchemeRead,
  type SchemeOptionsRead,
  type SchemeOptionsVariables,
} from "./miniature-scheme-loader";
import { useVaultGraphQL, type VaultGraphQLScope } from "./provider";
import { useRetainedQuery } from "./use-retained-query";

export { readMiniatureScheme } from "./miniature-scheme-loader";
export type { MiniatureSchemeRead, SchemeOptionsRead } from "./miniature-scheme-loader";

const FAMILIES: readonly VaultFamily[] = ["SCHEMES", "PAINT", "SOURCES", "MINIATURES"];
type WindowState<T> = {
  key: string;
  scope: VaultGraphQLScope | null;
  data: T | null;
  loading: boolean;
  error: Error | null;
};

// Both reads share the same invalidation/commit boundary. In-flight pages never
// reach normalized entities, including when a scope, filter, or ID changes.
export function useSchemeWindow<T extends { revision: Revision }>(
  key: string,
  read: (client: ApolloClient, pages: number, signal?: AbortSignal) => Promise<T>,
  write: (client: ApolloClient, data: T) => void,
  hasMore: (data: T) => boolean,
  retainSearch = false,
  search = "",
) {
  const scope = useVaultGraphQL();
  const commands = useRef({ refetch: () => {}, loadMore: () => {} });
  const [state, setState] = useState<WindowState<T>>({ key, scope, data: null, loading: true, error: null });
  useEffect(() => {
    if (!scope) {
      setState({
        key,
        scope,
        data: null,
        loading: false,
        error: new Error(i18n.t("shell:theSchemeConnectionIsNotAvailable")),
      });
      commands.current = { refetch: () => {}, loadMore: () => {} };
      return;
    }
    const abort = new AbortController();
    let active = true;
    let running = false;
    let pending = true;
    let pages = 1;
    let current: T | null = null;
    let accepted: ReadTicket | null = null;
    const { client, controller } = scope;
    const run = async () => {
      if (!active || running) return;
      running = true;
      setState({ key, scope, data: current, loading: true, error: null });
      try {
        while (active && pending) {
          pending = false;
          const ticket = controller.capture();
          const next = await read(client, pages, abort.signal);
          if (!active) return;
          if (!controller.accepts(ticket, next.revision, FAMILIES)) {
            pending = true;
            continue;
          }
          // The cache and React receive only one accepted complete window.
          write(client, next);
          current = next;
          accepted = ticket;
          setState({ key, scope, data: next, loading: pending, error: null });
        }
      } catch (error) {
        if (active)
          setState({
            key,
            scope,
            data: current,
            loading: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
      } finally {
        running = false;
      }
    };
    const refetch = () => {
      pending = true;
      void run();
    };
    commands.current = {
      refetch,
      loadMore: () => {
        if (running || !current || !hasMore(current)) return;
        pages += 1;
        refetch();
      },
    };
    const unsubscribe = controller.listen(FAMILIES, () => {
      if (
        current &&
        accepted &&
        controller.isCurrent(accepted) &&
        controller.isFresh(current.revision, FAMILIES)
      )
        return;
      refetch();
    });
    setState({ key, scope, data: null, loading: true, error: null });
    const timer = setTimeout(() => void run(), retainSearch && search.trim() ? SEARCH_DEBOUNCE_MS : 0);
    return () => {
      clearTimeout(timer);
      active = false;
      abort.abort();
      unsubscribe();
    };
  }, [scope, key, read, write, hasMore, retainSearch, search]);
  const matches = state.key === key && state.scope === scope;
  const pending = !matches || state.loading;
  const data = useSearchResults(matches ? state.data : null, retainSearch && pending, scope);
  const retained = useRetainedQuery(data, pending, scope, retainSearch ? undefined : key);
  return {
    ...retained,
    error: matches ? state.error : null,
    refetch: useCallback(() => commands.current.refetch(), []),
    loadMore: useCallback(() => commands.current.loadMore(), []),
  };
}

const noMoreEntries = () => false;
export function useMiniatureScheme(id: string) {
  const read = useCallback((client: ApolloClient) => readMiniatureScheme(client, id), [id]);
  const write = useCallback(
    (client: ApolloClient, data: MiniatureSchemeRead) => {
      client.writeQuery({
        query: MiniatureSchemeDetailsDocument,
        variables: { id, after: null },
        data: {
          miniatureScheme: {
            ...data,
            scheme: data.scheme ? makeFragmentData(data.scheme, MiniatureSchemeSummaryFragmentDoc) : null,
            entries: {
              ...data.entries,
              nodes: data.entries.nodes.map((entry) => ({
                ...entry,
                paint: entry.paint ? makeFragmentData(entry.paint, DetailPaintFragmentDoc) : null,
              })),
            },
          },
        },
      });
    },
    [id],
  );
  const { loadMore: _loadMore, ...result } = useSchemeWindow(id, read, write, noMoreEntries);
  return result;
}

const moreOptions = (data: SchemeOptionsRead) => data.pageInfo.hasNextPage;
export function useSchemeOptions(search: string, category: string | null = null, excludeIds: string[] = []) {
  search = normalizeSearch(search);
  // Canonicalize exclusions so a new array identity does not reset pagination.
  const key = JSON.stringify({ search, category, excludeIds: [...new Set(excludeIds)].sort() });
  const variables = useMemo(() => JSON.parse(key) as SchemeOptionsVariables, [key]);
  const read = useCallback(
    (client: ApolloClient, pages: number, signal?: AbortSignal) =>
      readSchemeOptions(client, variables, pages, signal),
    [variables],
  );
  const write = useCallback(
    (client: ApolloClient, data: SchemeOptionsRead) => {
      client.writeQuery({
        query: SchemePickerOptionsDocument,
        variables: { ...variables, after: null },
        data: {
          schemeOptions: {
            ...data,
            nodes: data.nodes.map((scheme) => makeFragmentData(scheme, MiniatureSchemeSummaryFragmentDoc)),
          },
        },
      });
    },
    [variables],
  );
  const { data, ...result } = useSchemeWindow(key, read, write, moreOptions, true, search);
  // Selection belongs to the picker, not a particular search window. Do not
  // replace its retained selected rows when this result resets on search.
  return {
    ...result,
    items: data?.nodes ?? [],
    categories: data?.categoryCounts ?? [],
    totalCount: data?.totalCount ?? 0,
    hasNextPage: data?.pageInfo.hasNextPage ?? false,
  };
}
