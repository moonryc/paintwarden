import { i18n } from "@paintwarden/i18n/runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { PaintingStatus } from "../types";

import { getFragmentData } from "./generated/fragment-masking";
import {
  MiniatureListDocument,
  MiniatureTileFragmentDoc,
  type MiniatureListQuery,
} from "./generated/graphql";
import { isStaleLibraryCursor } from "./library-loader";
import {
  appendMiniaturePage,
  MINIATURE_PAGE_SIZE,
  miniatureListEnvelope,
  readMiniaturePage,
  readMiniatureWindow,
  sameMiniatureRevision,
  type MiniatureListVariables,
} from "./miniature-list-loader";
import { miniatureTileProjection, type MiniatureTileProjection } from "./miniature-list-model";
import { useVaultGraphQL, type VaultGraphQLScope } from "./provider";

export type MiniatureListFilters = {
  workbench: boolean;
  ownership: "ALL" | "OWNED" | "WISHLIST";
  stage: PaintingStatus | "ALL";
  search: string;
};
export type MiniatureListView = {
  rows: MiniatureTileProjection[];
  totalCount: number;
  collectionCount: number;
  statusCounts: { ALL: number; OWNED: number; WISHLIST: number };
  stageCounts: {
    ALL: number;
    NOT_STARTED: number;
    ASSEMBLED: number;
    PRIMED: number;
    IN_PROGRESS: number;
    COMPLETE: number;
  };
  owned: number;
  ready: number;
  missingProjectPaints: number;
  wishlistedMissingPaints: number;
  catalogCount: number;
  hasNextPage: boolean;
};
export type MiniatureListResult = MiniatureListView & {
  loading: boolean;
  refreshing: boolean;
  error: string;
  loadMore(): void;
  retry(): void;
};
// Storybook may supply precomputed sample projections. Production uses the paginated Apollo reader.
export const MiniatureFixtureContext = createContext<
  ((filters: MiniatureListFilters) => MiniatureListView) | null
>(null);
export const emptyMiniatureView: MiniatureListView = {
  rows: [],
  totalCount: 0,
  collectionCount: 0,
  statusCounts: { ALL: 0, OWNED: 0, WISHLIST: 0 },
  stageCounts: { ALL: 0, NOT_STARTED: 0, ASSEMBLED: 0, PRIMED: 0, IN_PROGRESS: 0, COMPLETE: 0 },
  owned: 0,
  ready: 0,
  missingProjectPaints: 0,
  wishlistedMissingPaints: 0,
  catalogCount: 0,
  hasNextPage: false,
};

export function miniatureListVariables(filters: MiniatureListFilters): MiniatureListVariables {
  return {
    workbench: filters.workbench,
    ownership: filters.ownership === "ALL" ? undefined : filters.ownership,
    stage: filters.workbench && filters.stage !== "ALL" ? filters.stage : undefined,
    search: filters.search.trim(),
  };
}

export function miniatureListView(data: MiniatureListQuery): MiniatureListView {
  const envelope = miniatureListEnvelope(data);
  const home = data.home?.counts;
  const statusCounts = { ...emptyMiniatureView.statusCounts };
  for (const facet of data.miniatures?.ownershipCounts ?? [])
    if (facet.key in statusCounts) statusCounts[facet.key as keyof typeof statusCounts] = facet.count;
  const stageCounts = { ...emptyMiniatureView.stageCounts };
  for (const facet of home?.stages ?? data.miniatures?.stageCounts ?? [])
    if (facet.key in stageCounts) stageCounts[facet.key as keyof typeof stageCounts] = facet.count;
  if (home) stageCounts.ALL = home.owned;
  return {
    rows: getFragmentData(MiniatureTileFragmentDoc, envelope.miniatures.nodes).map(miniatureTileProjection),
    totalCount: envelope.miniatures.totalCount,
    collectionCount: home?.owned ?? statusCounts.ALL,
    statusCounts,
    stageCounts,
    owned: home?.owned ?? statusCounts.OWNED,
    ready: home?.ready ?? 0,
    missingProjectPaints: home?.distinctMissingPaints ?? 0,
    wishlistedMissingPaints: home?.wishlistedMissingPaints ?? 0,
    catalogCount: home?.catalogCount ?? 0,
    hasNextPage: envelope.miniatures.pageInfo.hasNextPage,
  };
}

type NetworkState = {
  dataKey?: string;
  scope?: VaultGraphQLScope;
  data?: MiniatureListQuery;
  loading: boolean;
  refreshing: boolean;
  error: string;
};

export function useMiniatureList(filters: MiniatureListFilters): MiniatureListResult {
  const fixture = useContext(MiniatureFixtureContext);
  const scope = useVaultGraphQL();
  const filterKey = JSON.stringify(filters);
  const stableFilters = useMemo(() => JSON.parse(filterKey) as MiniatureListFilters, [filterKey]);
  const key = JSON.stringify(miniatureListVariables(stableFilters));
  const variables = useMemo(() => JSON.parse(key) as MiniatureListVariables, [key]);
  const [state, setState] = useState<NetworkState>({ loading: !fixture, refreshing: false, error: "" });
  const commands = useRef({ more: () => {}, refresh: () => {} });
  useEffect(() => {
    if (fixture) return;
    if (!scope) {
      setState({
        loading: false,
        refreshing: false,
        error: i18n.t("shell:theMiniatureConnectionIsNotAvailable"),
      });
      return;
    }
    let active = true;
    let running = false;
    let refreshPending = true;
    let morePending = false;
    let pages = 1;
    let current: MiniatureListQuery | undefined;
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
          const targetPages =
            pages +
            (more && current && miniatureListEnvelope(current).miniatures.pageInfo.hasNextPage ? 1 : 0);
          const ticket = controller.capture();
          let next: MiniatureListQuery;
          if (!refresh && current && miniatureListEnvelope(current).miniatures.pageInfo.hasNextPage) {
            try {
              const page = await readMiniaturePage(
                client,
                variables,
                miniatureListEnvelope(current).miniatures.pageInfo.endCursor ?? null,
              );
              next = sameMiniatureRevision(current, page)
                ? appendMiniaturePage(current, page)
                : await readMiniatureWindow(client, targetPages, variables);
            } catch (error) {
              if (!isStaleLibraryCursor(error)) throw error;
              next = await readMiniatureWindow(client, targetPages, variables);
            }
          } else {
            next = await readMiniatureWindow(client, targetPages, variables);
          }
          if (!active) return;
          if (
            !controller.accepts(ticket, miniatureListEnvelope(next).revision, [
              variables.workbench ? "HOME" : "MINIATURES",
            ])
          ) {
            refreshPending = true;
            morePending ||= more;
            continue;
          }
          acceptedTicket = ticket;
          // A single cache commit and React commit replace the whole loaded window.
          client.writeQuery({
            query: MiniatureListDocument,
            variables: { ...variables, first: MINIATURE_PAGE_SIZE },
            data: next,
          });
          current = next;
          pages = Math.max(
            1,
            Math.ceil(miniatureListEnvelope(next).miniatures.nodes.length / MINIATURE_PAGE_SIZE),
          );
          controller.observe(miniatureListEnvelope(next).revision);
          setState({ data: next, dataKey: key, scope, loading: false, refreshing: true, error: "" });
        }
      } catch (error) {
        if (active)
          setState((previous) => ({
            ...previous,
            error: error instanceof Error ? error.message : i18n.t("shell:miniatureRefreshFailed"),
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
        if (
          !(current && miniatureListEnvelope(current).miniatures.pageInfo.hasNextPage) ||
          morePending ||
          running
        )
          return;
        morePending = true;
        void run();
      },
    };
    // Query changes hide the previous result immediately; edits keep the current rows and
    // list geometry in place until every loaded page has been successfully replaced.
    setState((previous) => ({ ...previous, loading: true, refreshing: false, error: "" }));
    const unsubscribe = controller.listen([variables.workbench ? "HOME" : "MINIATURES"], () => {
      if (
        current &&
        acceptedTicket &&
        controller.isCurrent(acceptedTicket) &&
        controller.isFresh(miniatureListEnvelope(current).revision, [
          variables.workbench ? "HOME" : "MINIATURES",
        ])
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
    if (!state.data || state.scope !== scope) return emptyMiniatureView;
    const accepted = miniatureListView(state.data);
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
