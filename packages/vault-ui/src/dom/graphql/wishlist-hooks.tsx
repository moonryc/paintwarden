import { normalizeSearch, SEARCH_DEBOUNCE_MS } from "../utils/use-search-results";
import { i18n } from "@paintwarden/i18n/runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { Paint, State } from "../types";
import type { PaintRequirementReason } from "../utils/vault-data";

import { getFragmentData } from "./generated/fragment-masking";
import {
  LibraryPaintFragmentDoc,
  WishlistExportDocument,
  WishlistModelOptionsDocument,
  WishlistPageDocument,
  WishlistRelatedProjectsDocument,
  WishlistRowFragmentDoc,
  type WishlistPageQuery,
  type WishlistRowFragment,
} from "./generated/graphql";
import { isStaleLibraryCursor } from "./library-loader";
import { libraryPaintProjection } from "./library-model";
import { useVaultGraphQL, type VaultGraphQLScope } from "./provider";
import { useRetainedQuery } from "./use-retained-query";
import { readWishlistWindow, WISHLIST_PAGE_SIZE } from "./wishlist-loader";

export type WishlistProjection = {
  paint: Paint;
  record: State["paintRecords"][string] | undefined;
  brandGroup: string;
  projectCount: number;
  projects: { id: string; title: string }[];
  projectsTruncated: boolean;
  restock: boolean;
  reasons: PaintRequirementReason[];
};
export type WishlistModelOption = { id: string; title: string; projectCount: number };
export type WishlistView = {
  rows: WishlistProjection[];
  missing: WishlistProjection[];
  totalCount: number;
  missingCount: number;
  counts: {
    shoppingPaints: number;
    restockPaints: number;
    missingPaints: number;
    missingStock: number;
    brokenSubstitution: number;
    listedMissingStock: number;
    projectCount: number;
  };
  hasNextPage: boolean;
  missingHasNextPage: boolean;
};
export type WishlistExport = { title: string; text: string; totalCount: number };
export type WishlistProjects = {
  nodes: { id: string; title: string }[];
  totalCount: number;
  hasNextPage: boolean;
  endCursor: string | null;
};
export type WishlistFixture = {
  record?(paintId: string): WishlistProjection["record"];
  view(miniatureId: string | null): WishlistView;
  modelOptions(search: string): WishlistModelOption[];
  exportList(miniatureId: string | null): Promise<WishlistExport>;
  relatedProjects(paintId: string, after?: string | null): Promise<WishlistProjects>;
};
// A complete-vault adapter is permitted only in Storybook. Production never reads useVault.
export const WishlistFixtureContext = createContext<WishlistFixture | null>(null);
export const emptyWishlistView: WishlistView = {
  rows: [],
  missing: [],
  totalCount: 0,
  missingCount: 0,
  counts: {
    shoppingPaints: 0,
    restockPaints: 0,
    missingPaints: 0,
    missingStock: 0,
    brokenSubstitution: 0,
    listedMissingStock: 0,
    projectCount: 0,
  },
  hasNextPage: false,
  missingHasNextPage: false,
};
function wishlistProjection(row: WishlistRowFragment): WishlistProjection {
  const projection = libraryPaintProjection(getFragmentData(LibraryPaintFragmentDoc, row.paint));
  return {
    paint: projection.paint,
    record: projection.record,
    brandGroup: row.brandGroup,
    projectCount: row.projectCount,
    projects: row.relatedProjectsPreview,
    projectsTruncated: row.relatedProjectsTruncated,
    restock: row.restock,
    reasons: [
      ...(row.missingStock ? ["missingStock" as const] : []),
      ...(row.brokenSubstitution ? ["brokenSubstitution" as const] : []),
    ],
  };
}
export function wishlistView(data: WishlistPageQuery): WishlistView {
  const view = data.wishlist;
  return {
    rows: getFragmentData(WishlistRowFragmentDoc, view.shopping.nodes).map(wishlistProjection),
    missing: getFragmentData(WishlistRowFragmentDoc, view.missing.nodes).map(wishlistProjection),
    totalCount: view.shopping.totalCount,
    missingCount: view.missing.totalCount,
    counts: view.counts,
    hasNextPage: view.shopping.pageInfo.hasNextPage,
    missingHasNextPage: view.missing.pageInfo.hasNextPage,
  };
}
type NetworkState = {
  key?: string | null;
  scope?: VaultGraphQLScope;
  data?: WishlistPageQuery;
  loading: boolean;
  refreshing: boolean;
  error: string;
};
export function useWishlist(miniatureId: string | null) {
  const fixture = useContext(WishlistFixtureContext);
  const scope = useVaultGraphQL();
  const [state, setState] = useState<NetworkState>({ loading: !fixture, refreshing: false, error: "" });
  const commands = useRef({ more: (_missing: boolean) => {}, refresh: () => {} });
  useEffect(() => {
    if (fixture) return;
    if (!scope) {
      setState({
        loading: false,
        refreshing: false,
        error: i18n.t("shell:theWishlistConnectionIsNotAvailable"),
      });
      return;
    }
    const abort = new AbortController();
    let active = true;
    let running = false;
    let pending = true;
    let pages = { shopping: 1, missing: 1 };
    let current: WishlistPageQuery | undefined;
    let acceptedTicket: ReturnType<typeof scope.controller.capture> | undefined;
    const { client, controller } = scope;
    const run = async () => {
      if (running || !active) return;
      running = true;
      setState((previous) => ({ ...previous, loading: !current, refreshing: Boolean(current), error: "" }));
      try {
        while (pending && active) {
          pending = false;
          const ticket = controller.capture();
          const next = await readWishlistWindow(client, miniatureId, pages, abort.signal);
          if (!active) return;
          if (!controller.accepts(ticket, next.wishlist.revision, ["WISHLIST", "PAINT"])) {
            pending = true;
            continue;
          }
          acceptedTicket = ticket;
          client.writeQuery({
            query: WishlistPageDocument,
            variables: { miniatureId, first: WISHLIST_PAGE_SIZE, missingFirst: WISHLIST_PAGE_SIZE },
            data: next,
          });
          current = next;
          pages = {
            shopping: Math.max(1, Math.ceil(next.wishlist.shopping.nodes.length / WISHLIST_PAGE_SIZE)),
            missing: Math.max(1, Math.ceil(next.wishlist.missing.nodes.length / WISHLIST_PAGE_SIZE)),
          };
          controller.observe(next.wishlist.revision);
          setState({ key: miniatureId, scope, data: next, loading: false, refreshing: true, error: "" });
        }
      } catch (error) {
        if (active)
          setState((previous) => ({
            ...previous,
            error: error instanceof Error ? error.message : i18n.t("shell:wishlistRefreshFailed"),
          }));
      } finally {
        running = false;
        if (active) setState((previous) => ({ ...previous, loading: false, refreshing: false }));
      }
    };
    const refresh = () => {
      pending = true;
      void run();
    };
    commands.current = {
      refresh,
      more: (missing) => {
        if (
          running ||
          !current ||
          !(missing ? current.wishlist.missing : current.wishlist.shopping).pageInfo.hasNextPage
        )
          return;
        pages = { ...pages, [missing ? "missing" : "shopping"]: pages[missing ? "missing" : "shopping"] + 1 };
        refresh();
      },
    };
    setState((previous) => ({ ...previous, loading: true, refreshing: false, error: "" }));
    const unsubscribe = controller.listen(["WISHLIST"], () => {
      if (
        current &&
        acceptedTicket &&
        controller.isCurrent(acceptedTicket) &&
        controller.isFresh(current.wishlist.revision, ["WISHLIST"])
      )
        return;
      refresh();
    });
    void run();
    return () => {
      active = false;
      abort.abort();
      unsubscribe();
    };
  }, [scope, miniatureId, fixture]);
  const exportList = useCallback(async (): Promise<WishlistExport> => {
    if (fixture) return fixture.exportList(miniatureId);
    if (!scope) throw new Error(i18n.t("shell:theWishlistConnectionIsNotAvailable"));
    const ticket = scope.controller.capture();
    const { data } = await scope.client.query({
      query: WishlistExportDocument,
      variables: { miniatureId },
      fetchPolicy: "no-cache",
    });
    if (!data || !scope.controller.accepts(ticket, data.wishlistExport.revision, ["WISHLIST"]))
      throw new Error(i18n.t("shell:wishlistChangedWhileExportingTryAgain"));
    return {
      title: data.wishlistExport.text.split("\n", 1)[0] || i18n.t("shell:paintShoppingList"),
      text: data.wishlistExport.text,
      totalCount: data.wishlistExport.totalCount,
    };
  }, [scope, fixture, miniatureId]);
  const relatedProjects = useCallback(
    async (paintId: string, after: string | null = null): Promise<WishlistProjects> => {
      if (fixture) return fixture.relatedProjects(paintId, after);
      if (!scope) throw new Error(i18n.t("shell:theWishlistConnectionIsNotAvailable"));
      const ticket = scope.controller.capture();
      const { data } = await scope.client.query({
        query: WishlistRelatedProjectsDocument,
        variables: { paintId, first: 30, after },
        fetchPolicy: "no-cache",
      });
      if (!data || !scope.controller.accepts(ticket, data.wishlistRelatedProjects.revision, ["WISHLIST"]))
        throw new Error(i18n.t("shell:projectAssociationsChangedReopenTheList"));
      return {
        nodes: data.wishlistRelatedProjects.nodes,
        totalCount: data.wishlistRelatedProjects.totalCount,
        hasNextPage: data.wishlistRelatedProjects.pageInfo.hasNextPage,
        endCursor: data.wishlistRelatedProjects.pageInfo.endCursor ?? null,
      };
    },
    [scope, fixture],
  );
  const retained = useRetainedQuery(
    state.scope === scope ? state.data : null,
    !state.error && (state.loading || state.refreshing || state.key !== miniatureId),
    scope,
  );
  const view = useMemo(() => {
    if (fixture) return fixture.view(miniatureId);
    return retained.data ? wishlistView(retained.data) : emptyWishlistView;
  }, [fixture, miniatureId, retained.data]);
  return {
    ...view,
    loading: fixture ? false : retained.loading,
    refreshing: fixture ? false : retained.refreshing,
    error: fixture ? "" : state.error,
    loadMore: useCallback(() => commands.current.more(false), []),
    loadMoreMissing: useCallback(() => commands.current.more(true), []),
    retry: useCallback(() => commands.current.refresh(), []),
    exportList,
    relatedProjects,
  };
}

export function useWishlistModelOptions(search: string) {
  search = normalizeSearch(search);
  const scope = useVaultGraphQL();
  const fixture = useContext(WishlistFixtureContext);
  const key = search.trim();
  const [state, setState] = useState<{
    key?: string;
    scope?: VaultGraphQLScope;
    options: WishlistModelOption[];
    loading: boolean;
    error: string;
    hasNextPage: boolean;
  }>({ options: [], loading: !fixture, error: "", hasNextPage: false });
  const commands = useRef({ more: () => {}, retry: () => {} });
  useEffect(() => {
    if (fixture) return;
    if (!scope) {
      setState({
        key,
        options: [],
        loading: false,
        error: i18n.t("shell:theMiniatureConnectionIsNotAvailable"),
        hasNextPage: false,
      });
      return;
    }
    const abort = new AbortController();
    let active = true;
    let running = false;
    let refreshQueued = false;
    let after: string | null = null;
    let options: WishlistModelOption[] = [];
    let revision: { epoch: string; seq: string } | undefined;
    const { client, controller } = scope;
    const run = async (more = false) => {
      if (!active || running) return;
      running = true;
      setState((previous) => ({ ...previous, loading: true, error: "" }));
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const ticket = controller.capture();
          let data;
          try {
            data = (
              await client.query({
                query: WishlistModelOptionsDocument,
                variables: { first: 40, after: more ? after : null, search: key },
                fetchPolicy: "no-cache",
                context: { fetchOptions: { signal: abort.signal }, queryDeduplication: false },
              })
            ).data;
          } catch (error) {
            if (!isStaleLibraryCursor(error)) throw error;
            more = false;
            continue;
          }
          if (!active) return;
          if (!data) throw new Error(i18n.t("shell:miniatureOptionsResponseWasEmpty"));
          const next = data.wishlistModelOptions;
          if (!controller.accepts(ticket, next.revision, ["WISHLIST"])) {
            more = false;
            continue;
          }
          if (
            more &&
            revision &&
            (revision.epoch !== next.revision.epoch || revision.seq !== next.revision.seq)
          ) {
            more = false;
            continue;
          }
          options = more ? [...options, ...next.nodes] : next.nodes;
          after = next.pageInfo.endCursor ?? null;
          revision = next.revision;
          setState({
            key,
            scope,
            options,
            loading: false,
            error: "",
            hasNextPage: next.pageInfo.hasNextPage,
          });
          return;
        }
        throw new Error(i18n.t("shell:miniatureOptionsChangedRepeatedlyTryAgain"));
      } catch (error) {
        if (active)
          setState((previous) => ({
            ...previous,
            error: error instanceof Error ? error.message : i18n.t("shell:miniatureSearchFailed"),
          }));
      } finally {
        running = false;
        if (active && refreshQueued) {
          refreshQueued = false;
          void run();
        }
        if (active) setState((previous) => ({ ...previous, loading: false }));
      }
    };
    commands.current = {
      more: () => {
        if (after) void run(true);
      },
      retry: () => {
        void run();
      },
    };
    const unsubscribe = controller.listen(["WISHLIST"], () => {
      if (running) refreshQueued = true;
      else void run();
    });
    const timer = setTimeout(
      () => {
        void run();
      },
      key ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => {
      active = false;
      abort.abort();
      clearTimeout(timer);
      unsubscribe();
    };
  }, [scope, key, fixture]);
  return {
    options: fixture ? fixture.modelOptions(key) : state.scope === scope ? state.options : [],
    hasNextPage: fixture ? false : state.hasNextPage,
    loading: fixture ? false : state.key !== key || state.scope !== scope || state.loading,
    error: fixture ? "" : state.error,
    loadMore: useCallback(() => commands.current.more(), []),
    retry: useCallback(() => commands.current.retry(), []),
  };
}
