import { i18n } from "@paintwarden/i18n/runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FolderView } from "../Components/FolderTile";

import { readFolderTree } from "./folder-loader";
import {
  BrowseFoldersDocument,
  CreateBrowserFolderDocument,
  DeleteBrowserFolderDocument,
  DeleteBrowserFolderItemsDocument,
  MoveBrowserFolderDocument,
  MoveBrowserFolderItemsDocument,
  RenameBrowserFolderDocument,
  type BrowseFoldersQuery,
} from "./generated/graphql";
import type { VaultFamily } from "./invalidation";
import { useVaultGraphQL, type VaultGraphQLScope } from "./provider";
import { useRetainedQuery } from "./use-retained-query";

export type FolderBrowserState = {
  folderId: string | null;
  flat: boolean;
  setFlat(value: boolean): void;
  navigate(id: string | null): void;
  folders: FolderView[];
  visibleFolders: FolderView[];
  ancestors: FolderView[];
  currentFolder: FolderView | null;
  loading: boolean;
  refreshing?: boolean;
  error: string;
  refresh(): void;
  create(name: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  move(id: string, destination: string | null): Promise<void>;
  remove(id: string, mode: "DELETE_CONTENTS" | "MOVE_UP"): Promise<void>;
  moveItems(ids: string[], destination: string | null): Promise<void>;
};

export function folderAncestors(folders: FolderView[], id: string | null): FolderView[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const path: FolderView[] = [];
  const seen = new Set<string>();
  let current = id ? byId.get(id) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

function storedFlat(page: string) {
  try {
    // Existing collections retain their familiar flat layout until folders are enabled.
    return localStorage.getItem(`paintwarden.folders.${page}.flat`) !== "false";
  } catch {
    return true;
  }
}

export function useFolderBrowser(
  page: string,
  kind: "MINIATURE" | "TEMPLATE",
  search: string,
): FolderBrowserState {
  const scope = useVaultGraphQL();
  const [preferences, setPreferences] = useState<Record<string, boolean>>({});
  const [locations, setLocations] = useState<Record<string, string | null>>({});
  const flat = preferences[page] ?? storedFlat(page);
  const folderId = locations[page] ?? null;
  const [state, setState] = useState<{
    scope: VaultGraphQLScope | null;
    kind: string;
    data?: BrowseFoldersQuery;
    loading: boolean;
    error: string;
  }>({ scope, kind, loading: Boolean(scope), error: "" });
  const refreshRef = useRef(() => {});
  useEffect(() => {
    if (!scope) return;
    let active = true;
    let running = false;
    let pending = false;
    const families: VaultFamily[] = kind === "MINIATURE" ? ["HOME", "MINIATURES"] : ["TEMPLATES"];
    const variables = { kind: kind };
    const refresh = async () => {
      pending = true;
      if (running) return;
      running = true;
      try {
        while (active && pending) {
          pending = false;
          setState((previous) => ({ ...previous, loading: true, error: "" }));
          const ticket = scope.controller.capture();
          const data = await readFolderTree(scope.client, kind);
          if (!active) return;
          if (!data) throw new Error(i18n.t("pages:folders.error"));
          if (!scope.controller.accepts(ticket, data.folderBrowser.revision, families)) {
            pending = true;
            continue;
          }
          scope.client.writeQuery({
            query: BrowseFoldersDocument,
            variables: { ...variables, first: 100, after: null },
            data,
          });
          scope.controller.observe(data.folderBrowser.revision);
          setState({ scope, kind, data, loading: false, error: "" });
        }
      } catch {
        if (active)
          setState((previous) => ({ ...previous, loading: false, error: i18n.t("pages:folders.error") }));
      } finally {
        running = false;
      }
    };
    refreshRef.current = () => void refresh();
    const unsubscribe = scope.controller.listen(families, () => void refresh());
    void refresh();
    return () => {
      active = false;
      unsubscribe();
      refreshRef.current = () => {};
    };
  }, [scope, kind]);
  const matches = state.scope === scope && state.kind === kind;
  const retained = useRetainedQuery(
    state.scope === scope ? state.data : null,
    Boolean(scope) && (!matches || state.loading),
    scope,
  );
  const folders = useMemo(() => retained.data?.folderBrowser.folders ?? [], [retained.data]);
  const ancestors = useMemo(() => folderAncestors(folders, folderId), [folders, folderId]);
  const currentFolder = ancestors.at(-1) ?? null;
  // A remote delete or move must not leave the page stranded in an invisible folder.
  useEffect(() => {
    if (matches && state.data && folderId && !folders.some((folder) => folder.id === folderId))
      setLocations((previous) => ({ ...previous, [page]: null }));
  }, [matches, state.data, folders, folderId, page]);
  const q = search.trim().toLocaleLowerCase();
  const visibleFolders = folders.filter((folder) => {
    if (!q) return !flat && folder.parentId === folderId;
    return (
      folder.name.toLocaleLowerCase().includes(q) &&
      (flat ||
        folderId === null ||
        folderAncestors(folders, folder.id).some((ancestor) => ancestor.id === folderId))
    );
  });
  const commit = async (
    work: (
      scope: VaultGraphQLScope,
    ) => Promise<
      { revision: { epoch: string; seq: string }; invalidatedFamilies: VaultFamily[] } | null | undefined
    >,
  ) => {
    if (!scope) throw new Error(i18n.t("pages:folders.error"));
    const ticket = scope.controller.captureCommand();
    const payload = await work(scope);
    if (!payload || !scope.controller.commitCommand(ticket, payload.revision, payload.invalidatedFamilies))
      throw new Error(i18n.t("pages:folders.error"));
  };
  return {
    folderId,
    flat,
    folders,
    visibleFolders,
    ancestors,
    currentFolder,
    loading: retained.loading,
    refreshing: retained.refreshing,
    error: matches ? state.error : "",
    refresh: useCallback(() => refreshRef.current(), []),
    setFlat: (value) => {
      setPreferences((previous) => ({ ...previous, [page]: value }));
      try {
        localStorage.setItem(`paintwarden.folders.${page}.flat`, String(value));
      } catch {
        /* Device storage may be disabled. */
      }
    },
    navigate: (id) => {
      setLocations((previous) => ({ ...previous, [page]: id }));
      setPreferences((previous) => ({ ...previous, [page]: false }));
      try {
        localStorage.setItem(`paintwarden.folders.${page}.flat`, "false");
      } catch {
        /* Navigation still works without device storage. */
      }
    },
    create: (name) =>
      commit(
        async ({ client }) =>
          (
            await client.mutate({
              mutation: CreateBrowserFolderDocument,
              variables: { kind: kind, name, parentId: flat ? null : folderId },
              fetchPolicy: "no-cache",
            })
          ).data?.createFolder,
      ),
    rename: (id, name) =>
      commit(
        async ({ client }) =>
          (
            await client.mutate({
              mutation: RenameBrowserFolderDocument,
              variables: { id, name },
              fetchPolicy: "no-cache",
            })
          ).data?.renameFolder,
      ),
    move: (id, destination) =>
      commit(
        async ({ client }) =>
          (
            await client.mutate({
              mutation: MoveBrowserFolderDocument,
              variables: { id, parentId: destination },
              fetchPolicy: "no-cache",
            })
          ).data?.moveFolder,
      ),
    remove: (id, mode) =>
      commit(
        async ({ client }) =>
          (
            await client.mutate({
              mutation: DeleteBrowserFolderDocument,
              variables: { id, mode: mode },
              fetchPolicy: "no-cache",
            })
          ).data?.deleteFolder,
      ),
    moveItems: (ids, destination) =>
      commit(
        async ({ client }) =>
          (
            await client.mutate({
              mutation: MoveBrowserFolderItemsDocument,
              variables: { kind: kind, ids, folderId: destination },
              fetchPolicy: "no-cache",
            })
          ).data?.moveFolderItems,
      ),
  };
}

export type FolderCommands = {
  /** Delete 1–1000 entity IDs atomically. Folder IDs are not accepted. */
  deleteItems(kind: "MINIATURE" | "TEMPLATE", ids: string[]): Promise<void>;
};

export function createFolderCommands(scope: VaultGraphQLScope | null): FolderCommands {
  return {
    deleteItems: async (kind, ids) => {
      if (!scope) throw new Error(i18n.t("pages:folders.error"));
      const ticket = scope.controller.captureCommand();
      if (!scope.controller.isCommandCurrent(ticket)) throw new Error(i18n.t("pages:folders.error"));
      const result = await scope.client.mutate({
        mutation: DeleteBrowserFolderItemsDocument,
        variables: { kind, ids },
        fetchPolicy: "no-cache",
      });
      const payload = result.data?.deleteFolderItems;
      if (!payload || !scope.controller.commitCommand(ticket, payload.revision, payload.invalidatedFamilies))
        throw new Error(i18n.t("pages:folders.error"));
    },
  };
}

/** Entity-only atomic bulk commands. Folder IDs use the browser's remove(id, mode) instead. */
export function useFolderCommands(): FolderCommands {
  const scope = useVaultGraphQL();
  return useMemo(() => createFolderCommands(scope), [scope]);
}
