// Zustand contains credentials, actions and screen state only. Apollo owns server data.
import { createStore } from "zustand/vanilla";

import type {
  Api,
  AuthHeaders,
  AuthStatus,
  Notify,
  Paint,
  PaintStateSetter,
  RecipeStep,
  Requirement,
  State,
  Tab,
  Toast,
} from "../types";
import { readJson } from "../utils/vault-query";

export type MiniatureFilter = "ALL" | "OWNED" | "WISHLIST";
export type PaintFilter = "ALL" | "OWNED" | "WISHLIST" | "UNTRACKED";
export type VaultStore = {
  auth: AuthStatus | null;
  authLoading: boolean;
  authError: string;
  // A transport refresh signal, never a cache of server rows.
  refreshGeneration: number;
  // Sign-in token for servers that require sign-in. Kept in memory only.
  token: string;
  authGeneration: number;
  setToken(token: string): void;
  authHeaders: AuthHeaders;

  // Rechecks credentials and invalidates mounted Apollo projections.
  refresh(): Promise<void>;
  // Compatibility action: no snapshot/delta transport remains active.
  syncChanges(): Promise<void>;
  // Checks sign-in status; Apollo independently checks its revision cursor.
  checkServer(): Promise<void>;
  // Fixture compatibility only. Production writes use scoped GraphQL commands.
  updateVault(update: (current: State) => State): void;
  // REST is reserved for source management, authentication and binary operations.
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

// The unused first argument keeps old story adapters source-compatible during Phase 4.
export function createVaultStore(_legacyClient?: unknown, overrides: Partial<VaultStore> = {}) {
  return createStore<VaultStore>()((set, get) => {
    let checking: Promise<void> | null = null;
    const checkAccess = () => {
      const generation = get().authGeneration;
      checking ??= (async () => {
        const headers = get().authHeaders();
        try {
          const auth = await readJson<AuthStatus>(
            await fetch("/api/auth/status", { cache: "no-store", headers }),
            "Could not check vault access",
          );
          if (generation !== get().authGeneration) return;
          const previous = get().auth;
          const changed =
            previous &&
            (previous.username !== auth.username ||
              previous.authenticated !== auth.authenticated ||
              previous.requireSignIn !== auth.requireSignIn ||
              previous.setupRequired !== auth.setupRequired);
          set({
            auth,
            authLoading: false,
            authError: "",
            ...(changed ? { authGeneration: generation + 1 } : {}),
          });
        } catch (error) {
          if (generation === get().authGeneration)
            set({
              authLoading: false,
              authError: error instanceof Error ? error.message : "Could not check vault access",
            });
        }
      })().finally(() => {
        checking = null;
        if (generation !== get().authGeneration && get().authLoading) void checkAccess();
      });
      return checking;
    };
    const fixtureOnly = () => {
      throw new Error("Legacy snapshot actions are fixture-only; use scoped GraphQL commands");
    };
    return {
      auth: null,
      authLoading: true,
      authError: "",
      refreshGeneration: 0,
      token: "",
      authGeneration: 0,
      setToken: (token) => {
        // Cookie-only transitions also dispose every sensitive Apollo scope.
        set({
          token,
          auth: null,
          authLoading: true,
          authError: "",
          authGeneration: get().authGeneration + 1,
        });
      },
      authHeaders: (): Record<string, string> => {
        const { token } = get();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
      refresh: async () => {
        await checkAccess();
        set({ refreshGeneration: get().refreshGeneration + 1 });
      },
      syncChanges: async () => {},
      checkServer: checkAccess,
      updateVault: fixtureOnly,
      api: async (path, options) => {
        const { authHeaders, notify, refresh } = get();
        try {
          if (path.split("?")[0] === "/api/state" || path.startsWith("/api/changes"))
            throw new Error("Legacy snapshot requests are disabled");
          const response = await fetch(path, {
            ...options,
            headers: {
              ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
              ...authHeaders(),
              ...options.headers,
            },
          });
          const result = (await response.json().catch(() => ({}))) as { error?: string };
          if (!response.ok) throw new Error(result.error || "Request failed");
          await refresh();
          return result;
        } catch (error) {
          notify(error instanceof Error ? error.message : "Request failed", "error");
          await refresh();
          throw error;
        }
      },
      setPaintState: fixtureOnly,
      toggleOwned: fixtureOnly,
      setRecipe: fixtureOnly,
      setRecipeSteps: fixtureOnly,
      toasts: [],
      notify: (message, tone = "ok", action) => {
        const id = Date.now() + Math.random();
        set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone, action }] }));
        setTimeout(() => get().dismissToast(id), action ? 5000 : 3600);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((toast) => toast.id !== id) })),

      // A small direct-entry link works in HTTP and paintvault://app alike.
      // Navigation itself remains unchanged; no persisted screen preference.
      tab: typeof window !== "undefined" && window.location.hash === "#paints" ? "paints" : "dashboard",
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
