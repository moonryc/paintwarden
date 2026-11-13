// The vault's shared actions and app-wide screen state, so components can reach them without
// receiving them as props. The vault data itself stays in the TanStack Query cache, which this
// store reads and updates; components read it with `useVault()`.
import { applyVaultChanges, type VaultChanges } from "@paint-vault/core/vault-changes";
import type { QueryClient } from "@tanstack/react-query";
import { createStore } from "zustand/vanilla";

import type {
  Api,
  AuthHeaders,
  Notify,
  Paint,
  PaintStateSetter,
  RecipeStep,
  Requirement,
  State,
  Tab,
  Toast,
} from "../types";
import { emptyState, noop } from "../utils/constants";
import { buzz } from "../utils/misc";
import { TEMPLATES_QUERY } from "../utils/template-query";
import { owns } from "../utils/vault-data";
import { AUTH_QUERY, VAULT_QUERY, readJson } from "../utils/vault-query";

export type MiniatureFilter = "ALL" | "OWNED" | "WISHLIST";
export type PaintFilter = "ALL" | "OWNED" | "WISHLIST" | "UNTRACKED";

export type VaultStore = {
  // Sign-in token for servers that require sign-in. Kept in memory only.
  token: string;
  authGeneration: number;
  setToken(token: string): void;
  authHeaders: AuthHeaders;

  // Reloads access and the whole vault, for sign-in changes and large operations such as
  // restoring a backup or installing a catalog source.
  refresh(): Promise<void>;
  // Brings the cached vault up to date after a save by merging only the rows that changed.
  syncChanges(): Promise<void>;
  // Checks sign-in status and merges changes made by other clients. Failures appear as a load
  // error rather than a toast, because nothing the user just did has failed.
  checkServer(): Promise<void>;
  // Optimistic edits update the cached vault immediately; the next sync confirms them.
  updateVault(update: (current: State) => State): void;
  // Sends a request to the server, then syncs the vault. Failures show a toast and reload.
  api: Api;

  setPaintState: PaintStateSetter;
  // Marks a paint owned (or not) and offers a one-tap undo back to its previous record.
  toggleOwned(paint: Paint): void;
  setRecipe(miniatureId: string, entries: Omit<Requirement, "miniatureId">[]): void;
  setRecipeSteps(miniatureId: string, steps: RecipeStep[]): void;

  toasts: Toast[];
  notify: Notify;
  dismissToast(id: number): void;

  tab: Tab;
  go(tab: Tab): void;
  // The miniature open in the project drawer.
  selectedId: string | null;
  openMini(id: string): void;
  closeMini(): void;
  miniatureFilter: MiniatureFilter;
  setMiniatureFilter(filter: MiniatureFilter): void;
  paintFilter: PaintFilter;
  setPaintFilter(filter: PaintFilter): void;
  paintSearch: string;
  setPaintSearch(search: string): void;
  // The Plugins dialog, which any page can open, for example from an empty catalog.
  pluginsOpen: boolean;
  openPlugins(): void;
  closePlugins(): void;
};

// Both the web app and the desktop app create one store per mounted vault, beside its query
// client. Storybook passes `overrides` to replace server actions with spies.
export function createVaultStore(queryClient: QueryClient, overrides: Partial<VaultStore> = {}) {
  return createStore<VaultStore>()((set, get) => {
    const current = () => queryClient.getQueryData<State>(VAULT_QUERY) ?? emptyState;

    // Syncs run one at a time so each starts from the position the previous one reached.
    let syncQueue: Promise<void> = Promise.resolve();
    const runSync = async () => {
      // A full load that started before the save would overwrite it with older data.
      await queryClient.cancelQueries({ queryKey: VAULT_QUERY });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const cursor = queryClient.getQueryData<State>(VAULT_QUERY)?.cursor;
        if (!cursor) break;
        const result = await readJson<VaultChanges>(
          await fetch(`/api/changes?epoch=${encodeURIComponent(cursor.epoch)}&since=${cursor.seq}`, {
            cache: "no-store",
            headers: get().authHeaders(),
          }),
          "Could not sync your vault",
        );
        if (result.reload) break;
        // Leaving the cache alone when nothing changed keeps periodic checks from re-rendering.
        if (!result.changes.length && result.epoch === cursor.epoch && result.seq === cursor.seq) return;
        let applied = false;
        queryClient.setQueryData<State>(VAULT_QUERY, (cached) => {
          if (cached?.cursor?.epoch !== cursor.epoch || cached.cursor.seq !== cursor.seq) return cached;
          applied = true;
          return {
            ...applyVaultChanges(cached, result.changes),
            cursor: { epoch: result.epoch, seq: result.seq },
          };
        });
        if (applied) return;
      }
      // A reload includes catalog/source changes, template edits, and backup restores. Template
      // summaries and lazily loaded recipes must move to the same server revision as the vault.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: VAULT_QUERY }),
        queryClient.invalidateQueries({ queryKey: TEMPLATES_QUERY }),
      ]);
    };

    const runServerCheck = async () => {
      const hasVault = () => Boolean(queryClient.getQueryData(VAULT_QUERY));
      // Without a vault, the user is signing in, seeing the load error, or waiting on the first load.
      if (!hasVault()) return;
      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY });
      if (queryClient.getQueryState(AUTH_QUERY)?.status === "error" || !hasVault()) return;
      // A full load already in progress will bring the latest data, and a sync would cancel it.
      if (queryClient.isFetching({ queryKey: VAULT_QUERY })) return;
      // A successful full load is what clears an earlier load error.
      if (queryClient.getQueryState(VAULT_QUERY)?.status === "error") {
        await queryClient.invalidateQueries({ queryKey: VAULT_QUERY });
        return;
      }
      await get()
        .syncChanges()
        .catch(() => queryClient.invalidateQueries({ queryKey: VAULT_QUERY }));
    };
    // Focus and visibility events usually fire together, so they share one check.
    let serverCheck: Promise<void> | null = null;

    return {
      token: "",
      authGeneration: 0,
      setToken: (token) => {
        // Cookie-only sign-out can keep the token empty but must discard scoped caches.
        set({ authGeneration: get().authGeneration + 1 });
        if (get().token === token) return;
        set({ token });
        // Clear another account's data immediately, including inactive recipe queries. Reset
        // cancels in-flight requests before active consumers refetch with the new credentials.
        void queryClient.resetQueries({ queryKey: TEMPLATES_QUERY });
      },
      authHeaders: (): Record<string, string> => {
        const { token } = get();
        return token ? { authorization: `Bearer ${token}` } : {};
      },

      refresh: async () => {
        await queryClient.invalidateQueries({ queryKey: AUTH_QUERY });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: VAULT_QUERY }),
          queryClient.invalidateQueries({ queryKey: TEMPLATES_QUERY }),
        ]);
      },
      syncChanges: () => {
        const next = syncQueue.then(runSync, runSync);
        syncQueue = next.catch(noop);
        return next;
      },
      checkServer: () => {
        serverCheck ??= runServerCheck().finally(() => {
          serverCheck = null;
        });
        return serverCheck;
      },
      updateVault: (update) => {
        queryClient.setQueryData<State>(VAULT_QUERY, (cached) => cached && update(cached));
      },
      api: async (path, options) => {
        const { authHeaders, notify, refresh, syncChanges } = get();
        try {
          const response = await fetch(path, {
            ...options,
            headers: {
              ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
              ...authHeaders(),
              ...options.headers,
            },
          });
          const result = (await response.json().catch(() => ({}))) as { error?: string };
          if (!response.ok) {
            if (response.status === 401) void refresh();
            throw new Error(result.error || "Request failed");
          }
          await syncChanges();
          return result;
        } catch (e) {
          notify(e instanceof Error ? e.message : "Request failed", "error");
          await refresh();
          throw e;
        }
      },

      // Optimistic: update locally first so toggles feel instant, then sync with the server.
      setPaintState: (paintId, state, stockLevel = "FULL", quantity) => {
        const record = current().paintRecords[paintId],
          qty =
            state === "OWNED"
              ? Math.max(
                  0,
                  Math.min(999, Math.floor(quantity ?? (record?.state === "OWNED" ? record.quantity : 1))),
                )
              : 0,
          nextState = state === "OWNED" && qty === 0 ? null : state,
          stock = nextState === "OWNED" && stockLevel === "EMPTY" ? "FULL" : stockLevel;
        buzz();
        get().updateVault((d) => {
          const paintStates = { ...d.paintStates },
            paintRecords = { ...d.paintRecords };
          if (nextState) {
            paintStates[paintId] = nextState;
            paintRecords[paintId] = { state: nextState, stockLevel: stock, quantity: qty };
          } else {
            delete paintStates[paintId];
            delete paintRecords[paintId];
          }
          return { ...d, paintStates, paintRecords };
        });
        get()
          .api("/api/paint-state", {
            method: "PUT",
            body: JSON.stringify({ paintId, state: nextState, stockLevel: stock, quantity: qty }),
          })
          .catch(noop);
      },
      toggleOwned: (paint) => {
        const { setPaintState, notify } = get();
        const prev = current().paintRecords[paint.id],
          owned = owns(prev);
        setPaintState(
          paint.id,
          owned ? null : "OWNED",
          "FULL",
          owned ? undefined : Math.max(1, prev?.quantity ?? 0),
        );
        notify(owned ? `${paint.name} unmarked` : `${paint.name} marked as owned`, "ok", {
          label: "Undo",
          onClick: () =>
            prev
              ? setPaintState(paint.id, prev.state, prev.stockLevel, prev.quantity)
              : setPaintState(paint.id, null),
        });
      },
      setRecipe: (miniatureId, entries) => {
        get().updateVault((d) => ({
          ...d,
          requirements: [
            ...d.requirements.filter((r) => r.miniatureId !== miniatureId),
            ...entries.map((entry) => ({ miniatureId, ...entry })),
          ],
        }));
        get()
          .api("/api/requirements", { method: "PUT", body: JSON.stringify({ miniatureId, entries }) })
          .catch(noop);
      },
      setRecipeSteps: (miniatureId, steps) => {
        get().updateVault((d) => ({
          ...d,
          recipeSteps: [
            ...d.recipeSteps.filter((row) => row.miniatureId !== miniatureId),
            ...steps.map((step) => ({ miniatureId, step })),
          ],
        }));
        get()
          .api("/api/recipe-steps", { method: "PUT", body: JSON.stringify({ miniatureId, steps }) })
          .catch(noop);
      },

      toasts: [],
      notify: (message, tone = "ok", action) => {
        const id = Date.now() + Math.random();
        set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone, action }] }));
        setTimeout(() => get().dismissToast(id), action ? 5000 : 3600);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((toast) => toast.id !== id) })),

      tab: "dashboard",
      go: (tab) => {
        set({ tab });
        window.scrollTo({ top: 0 });
      },
      selectedId: null,
      openMini: (id) => set({ selectedId: id }),
      closeMini: () => set({ selectedId: null }),
      miniatureFilter: "ALL",
      setMiniatureFilter: (miniatureFilter) => set({ miniatureFilter }),
      paintFilter: "OWNED",
      setPaintFilter: (paintFilter) => set({ paintFilter }),
      paintSearch: "",
      setPaintSearch: (paintSearch) => set({ paintSearch }),
      pluginsOpen: false,
      openPlugins: () => set({ pluginsOpen: true }),
      closePlugins: () => set({ pluginsOpen: false }),

      ...overrides,
    };
  });
}

export type VaultStoreApi = ReturnType<typeof createVaultStore>;
