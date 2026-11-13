import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import type { AuthStatus, State } from "../types";

import { emptyState, noop } from "./constants";
import { rememberImageScope } from "./image-cache";
import { TEMPLATES_QUERY } from "./template-query";

export const AUTH_QUERY = ["auth"] as const;
export const VAULT_QUERY = ["vault"] as const;

// Both the web app and the desktop app create one client per mounted vault. The desktop app
// remounts the vault when it switches servers, so each server starts with an empty cache.
export function createVaultQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The desktop app's bundled server works offline, so requests never wait for
        // navigator.onLine.
        networkMode: "always",
        // Saves and `useServerChecks` keep the vault current by merging only the rows that changed;
        // refetching on focus or reconnect would reload all of it.
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: Infinity,
        retry: 1,
      },
      mutations: { networkMode: "always" },
    },
  });
}

const isAuthorized = (auth: AuthStatus | null) =>
  Boolean(auth && !auth.setupRequired && !(auth.requireSignIn && !auth.authenticated));

export async function readJson<T>(response: Response, message: string) {
  rememberImageScope(response);
  if (!response.ok) throw new Error(message);
  return (await response.json()) as T;
}

// Loads sign-in status and the vault into the query cache. The vault store's `syncChanges` keeps
// the cached vault current after saves.
export function useVaultData(
  authHeaders: () => Record<string, string>,
  syncChanges: () => Promise<void>,
  legacyRequired = true,
) {
  const queryClient = useQueryClient();
  const authQuery = useQuery({
    queryKey: AUTH_QUERY,
    queryFn: async ({ signal }) =>
      readJson<AuthStatus>(
        await fetch("/api/auth/status", { cache: "no-store", headers: authHeaders(), signal }),
        "Could not check vault access",
      ),
  });
  const auth = authQuery.data ?? null;
  const authorized = isAuthorized(auth);
  const vaultQuery = useQuery({
    queryKey: VAULT_QUERY,
    enabled: authorized && legacyRequired,
    // Merged changes already keep unchanged rows and tables intact; comparing the whole vault
    // after every write would cost more than it saves.
    structuralSharing: false,
    queryFn: async ({ signal }) =>
      readJson<State>(
        await fetch("/api/state", { cache: "no-store", headers: authHeaders(), signal }),
        "Could not load your vault",
      ),
  });
  useEffect(() => {
    if (auth && !authorized) {
      queryClient.removeQueries({ queryKey: VAULT_QUERY });
      queryClient.removeQueries({ queryKey: TEMPLATES_QUERY });
    }
  }, [auth, authorized, queryClient]);

  // Catalog sources are checked for updates after the vault is on screen, because GitHub may be
  // slow or unreachable.
  const checkedSources = useRef(false);
  useEffect(() => {
    if (!vaultQuery.isSuccess || checkedSources.current) return;
    checkedSources.current = true;
    void fetch("/api/catalog-sources", { method: "PUT", headers: authHeaders() })
      .then(async (response) => {
        if (!response.ok) return;
        await syncChanges();
      })
      .catch(noop);
  }, [vaultQuery.isSuccess, authHeaders, syncChanges]);

  return {
    auth,
    data: authorized ? (vaultQuery.data ?? emptyState) : emptyState,
    loading: authQuery.isPending || (authorized && legacyRequired && vaultQuery.isPending),
    loadError: (authQuery.error ?? (legacyRequired ? vaultQuery.error : null))?.message ?? "",
    // True when there is no vault to show, as opposed to a failed refresh of one already loaded.
    loadFailed:
      (authQuery.isError && !auth) ||
      (authorized && legacyRequired && vaultQuery.isError && !vaultQuery.data),
  };
}

const SERVER_CHECK_INTERVAL_MS = 30_000;

// Picks up changes made by other browsers or devices: when the window regains focus, when the
// network returns, and periodically while the window is visible.
export function useServerChecks(checkServer: () => Promise<void>) {
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible") void checkServer();
    };
    const timer = setInterval(check, SERVER_CHECK_INTERVAL_MS);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [checkServer]);
}
