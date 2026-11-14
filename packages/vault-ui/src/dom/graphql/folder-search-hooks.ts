import { i18n } from "@paintwarden/i18n/runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FolderView } from "../Components/FolderTile";
import type { MiniatureTemplate } from "../types";

import {
  FOLDER_SEARCH_PAGE_SIZE,
  readFolderSearch,
  type FolderSearchVariables,
} from "./folder-search-loader";
import { getFragmentData } from "./generated/fragment-masking";
import {
  SearchFolderContentsDocument,
  MiniatureTileFragmentDoc,
  SearchTemplateFieldsFragmentDoc,
  type SearchFolderContentsQuery,
} from "./generated/graphql";
import type { VaultFamily } from "./invalidation";
import { miniatureTileProjection, type MiniatureTileProjection } from "./miniature-list-model";
import { useVaultGraphQL, type VaultGraphQLScope } from "./provider";

export function useFolderSearch(filters: FolderSearchVariables) {
  const scope = useVaultGraphQL();
  const key = JSON.stringify(filters);
  const variables = useMemo(() => JSON.parse(key) as FolderSearchVariables, [key]);
  const enabled = Boolean(filters.search.trim());
  const [state, setState] = useState<{
    scope: VaultGraphQLScope | null;
    key: string;
    data?: SearchFolderContentsQuery;
    loading: boolean;
    error: string;
  }>({ scope, key, loading: enabled, error: "" });
  const commands = useRef({ retry: () => {}, more: () => {} });
  useEffect(() => {
    commands.current = { retry: () => {}, more: () => {} };
    if (!enabled || !scope) return;
    let active = true;
    let running = false;
    let pending = true;
    let pages = 1;
    let current: SearchFolderContentsQuery | undefined;
    const families: VaultFamily[] = variables.kind === "MINIATURE" ? ["HOME", "MINIATURES"] : ["TEMPLATES"];
    const run = async () => {
      if (!active || running) return;
      running = true;
      setState({ scope, key, data: current, loading: true, error: "" });
      try {
        while (active && pending) {
          pending = false;
          const ticket = scope.controller.capture();
          const next = await readFolderSearch(scope.client, variables, pages);
          if (!active) return;
          if (!scope.controller.accepts(ticket, next.folderSearch.revision, families)) {
            pending = true;
            continue;
          }
          scope.client.writeQuery({
            query: SearchFolderContentsDocument,
            variables: { ...variables, first: FOLDER_SEARCH_PAGE_SIZE, after: null },
            data: next,
          });
          scope.controller.observe(next.folderSearch.revision);
          current = next;
          setState({ scope, key, data: next, loading: false, error: "" });
        }
      } catch {
        if (active)
          setState({ scope, key, data: current, loading: false, error: i18n.t("pages:folders.error") });
      } finally {
        running = false;
      }
    };
    const retry = () => {
      pending = true;
      void run();
    };
    commands.current = {
      retry,
      more: () => {
        if (running || !current?.folderSearch.results.pageInfo.hasNextPage) return;
        pages += 1;
        retry();
      },
    };
    const unsubscribe = scope.controller.listen(families, retry);
    const timer = setTimeout(() => void run(), 80);
    return () => {
      active = false;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [enabled, scope, key, variables]);
  const matching = enabled && state.scope === scope && state.key === key;
  const data = matching ? state.data : undefined;
  const result = useMemo(() => {
    const folders: FolderView[] = [];
    const miniatures: MiniatureTileProjection[] = [];
    const templates: MiniatureTemplate[] = [];
    for (const node of data?.folderSearch.results.nodes ?? []) {
      if (node.__typename === "Folder") folders.push(node);
      else if (node.__typename === "Miniature")
        miniatures.push(miniatureTileProjection(getFragmentData(MiniatureTileFragmentDoc, node)));
      else if (node.__typename === "TemplateSummary") {
        const row = getFragmentData(SearchTemplateFieldsFragmentDoc, node);
        templates.push({
          ...row,
          imageUrl: row.templateImageUrl,
          kind: row.kind === "user" ? "user" : "source",
          sourceName: row.sourceName ?? undefined,
        });
      }
    }
    return { folders, miniatures, templates };
  }, [data]);
  return {
    ...result,
    loading: enabled && Boolean(scope) && (!matching || (state.loading && !data)),
    refreshing: matching && Boolean(data) && state.loading,
    error: matching ? state.error : "",
    totalCount: data?.folderSearch.results.totalCount ?? 0,
    hasNextPage: data?.folderSearch.results.pageInfo.hasNextPage ?? false,
    loadMore: useCallback(() => commands.current.more(), []),
    retry: useCallback(() => commands.current.retry(), []),
  };
}
