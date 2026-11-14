import { i18n } from "@paintwarden/i18n/runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { getFragmentData } from "./generated/fragment-masking";
import { LibraryPageDocument, LibraryPaintFragmentDoc, type LibraryPageQuery } from "./generated/graphql";
import {
  appendLibraryPage,
  isStaleLibraryCursor,
  LIBRARY_PAGE_SIZE,
  readLibraryPage,
  readLibraryWindow,
  sameLibraryRevision,
  type LibraryVariables,
} from "./library-loader";
import { libraryPaintProjection, type LibraryPaintProjection } from "./library-model";
import { useVaultGraphQL, type VaultGraphQLScope } from "./provider";

export const ALL_LIBRARY_SOURCES = "\u0000all";
export const NO_LIBRARY_SOURCE = "\u0000none";
export type LibraryInventory = "ALL" | "OWNED" | "WISHLIST" | "UNTRACKED";
export type LibraryFilters = { search: string; brand: string; plugin: string; inventory: LibraryInventory };
type Facet = { key: string; label: string; count: number };
export type LibraryView = {
  rows: LibraryPaintProjection[];
  totalCount: number;
  catalogCount: number;
  availableCount: number;
  wishlistCount: number;
  brands: Facet[];
  sources: Facet[];
  inventory: Facet[];
  hasNextPage: boolean;
};
export type LibraryResult = LibraryView & {
  loading: boolean;
  refreshing: boolean;
  error: string;
  loadMore(): void;
  retry(): void;
};
// Storybook may supply precomputed sample projections. Production uses the paginated Apollo reader.
export const LibraryFixtureContext = createContext<((filters: LibraryFilters) => LibraryView) | null>(null);
const emptyView: LibraryView = {
  rows: [],
  totalCount: 0,
  catalogCount: 0,
  availableCount: 0,
  wishlistCount: 0,
  brands: [],
  sources: [],
  inventory: [],
  hasNextPage: false,
};

export function libraryVariables(filters: LibraryFilters): LibraryVariables {
  return {
    search: filters.search.trim(),
    filter: filters.search.trim() ? "ALL" : filters.inventory,
    brand: filters.brand === "ALL" ? undefined : filters.brand,
    sourceName:
      filters.plugin === ALL_LIBRARY_SOURCES || filters.plugin === NO_LIBRARY_SOURCE
        ? undefined
        : filters.plugin,
    noSource: filters.plugin === NO_LIBRARY_SOURCE,
  };
}

export function libraryView(data: LibraryPageQuery): LibraryView {
  const library = data.library;
  return {
    rows: getFragmentData(LibraryPaintFragmentDoc, library.nodes).map(libraryPaintProjection),
    totalCount: library.totalCount,
    catalogCount: library.catalogCount,
    availableCount: library.availableCount,
    wishlistCount: library.explicitWishlistCount,
    brands: library.facets.brands,
    sources: library.facets.sources,
    inventory: library.facets.inventory,
    hasNextPage: library.pageInfo.hasNextPage,
  };
}

type NetworkState = {
  dataKey?: string;
  scope?: VaultGraphQLScope;
  data?: LibraryPageQuery;
  loading: boolean;
  refreshing: boolean;
  error: string;
};

export function useLibraryPaints(filters: LibraryFilters): LibraryResult {
  const fixture = useContext(LibraryFixtureContext);
  const scope = useVaultGraphQL();
  const filterKey = JSON.stringify(filters);
  const stableFilters = useMemo(() => JSON.parse(filterKey) as LibraryFilters, [filterKey]);
  const key = JSON.stringify(libraryVariables(stableFilters));
  const variables = useMemo(() => JSON.parse(key) as LibraryVariables, [key]);
  const [state, setState] = useState<NetworkState>({ loading: !fixture, refreshing: false, error: "" });
  const commands = useRef({ more: () => {}, refresh: () => {} });
  useEffect(() => {
    if (fixture) return;
    if (!scope) {
      setState({
        loading: false,
        refreshing: false,
        error: i18n.t("shell:theLibraryConnectionIsNotAvailable"),
      });
      return;
    }
    let active = true;
    let running = false;
    let refreshPending = true;
    let morePending = false;
    let pages = 1;
    let current: LibraryPageQuery | undefined;
    const { client, controller } = scope;
    let acceptedTicket: ReturnType<typeof controller.capture> | undefined;
    const run = async () => {
      if (running || !active) return;
      running = true;
      setState((previous) => ({ ...previous, loading: !current, refreshing: Boolean(current), error: "" }));
      try {
        while (active && (refreshPending || morePending)) {
          const refresh = refreshPending || !current;
          refreshPending = false;
          const more = morePending;
          morePending = false;
          const targetPages = pages + (more && current?.library.pageInfo.hasNextPage ? 1 : 0);
          const ticket = controller.capture();
          let next: LibraryPageQuery;
          if (!refresh && current?.library.pageInfo.hasNextPage) {
            try {
              const page = await readLibraryPage(
                client,
                variables,
                current.library.pageInfo.endCursor ?? null,
              );
              next = sameLibraryRevision(current, page)
                ? appendLibraryPage(current, page)
                : await readLibraryWindow(client, targetPages, variables);
            } catch (error) {
              if (!isStaleLibraryCursor(error)) throw error;
              next = await readLibraryWindow(client, targetPages, variables);
            }
          } else {
            next = await readLibraryWindow(client, targetPages, variables);
          }
          if (!active) return;
          if (!controller.accepts(ticket, next.library.revision, ["LIBRARY"])) {
            refreshPending = true;
            morePending ||= more;
            continue;
          }
          acceptedTicket = ticket;
          // A single cache commit and React commit replace the whole loaded window.
          client.writeQuery({
            query: LibraryPageDocument,
            variables: { ...variables, first: LIBRARY_PAGE_SIZE },
            data: next,
          });
          current = next;
          pages = Math.max(1, Math.ceil(next.library.nodes.length / LIBRARY_PAGE_SIZE));
          controller.observe(next.library.revision);
          setState({ data: next, dataKey: key, scope, loading: false, refreshing: true, error: "" });
        }
      } catch (error) {
        if (active)
          setState((previous) => ({
            ...previous,
            error: error instanceof Error ? error.message : i18n.t("shell:libraryRefreshFailed"),
          }));
      } finally {
        running = false;
        if (active) setState((previous) => ({ ...previous, loading: false, refreshing: false }));
      }
    };
    const refresh = () => {
      refreshPending = true;
      void run();
    };
    commands.current = {
      refresh,
      more: () => {
        if (!current?.library.pageInfo.hasNextPage || morePending || running) return;
        morePending = true;
        void run();
      },
    };
    // Query changes hide the previous result immediately; edits keep the current rows and
    // list geometry in place until every loaded page has been successfully replaced.
    setState((previous) => ({ ...previous, loading: true, refreshing: false, error: "" }));
    const unsubscribe = controller.listen(["LIBRARY"], () => {
      if (
        current &&
        acceptedTicket &&
        controller.isCurrent(acceptedTicket) &&
        controller.isFresh(current.library.revision, ["LIBRARY"])
      )
        return;
      refresh();
    });
    // Match the previous fuzzy worker's 80ms search debounce, without delaying edits
    // or invalidations. Fast typing must not consume one network request per keystroke.
    const searchTimer = variables.search
      ? setTimeout(() => {
          void run();
        }, 80)
      : undefined;
    if (!searchTimer) void run();
    return () => {
      clearTimeout(searchTimer);
      active = false;
      unsubscribe();
    };
  }, [scope, variables, key, fixture]);
  const loadMore = useCallback(() => commands.current.more(), []);
  const retry = useCallback(() => commands.current.refresh(), []);
  const view = useMemo(() => {
    if (fixture) return fixture(stableFilters);
    if (!state.data || state.scope !== scope) return emptyView;
    const accepted = libraryView(state.data);
    // Keep global options while a different filter is loading, but never show rows from
    // the old query (even for the render before its effect runs).
    return state.dataKey === key ? accepted : { ...accepted, rows: [], totalCount: 0, hasNextPage: false };
  }, [fixture, stableFilters, state.data, state.dataKey, state.scope, key, scope]);
  return {
    ...view,
    loading: fixture ? false : state.loading,
    refreshing: fixture ? false : state.refreshing,
    error: fixture ? "" : state.error,
    loadMore,
    retry,
  };
}
