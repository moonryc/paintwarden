import type { ApolloClient } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { Alert } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { useVaultStore } from "../store/hooks";
import { VAULT_QUERY } from "../utils/vault-query";

import { createVaultGraphQLClient, type VaultGraphQLError } from "./client";
import { VaultChangesDocument, VaultInvalidationDocument } from "./generated/graphql";
import { VaultInvalidationController, type VaultFamily } from "./invalidation";

export type VaultGraphQLScope = { client: ApolloClient; controller: VaultInvalidationController };
export const VaultGraphQLContext = createContext<VaultGraphQLScope | null>(null);
export const useVaultGraphQL = () => useContext(VaultGraphQLContext);

const fields: Record<VaultFamily, readonly string[]> = {
  LIBRARY: ["library"],
  PAINT: ["paint"],
  OPTIONS: ["paintOptions"],
  HOME: ["home"],
  MINIATURES: ["miniatures", "miniature"],
  WISHLIST: ["wishlist"],
  SCHEMES: ["schemes", "scheme"],
  TEMPLATES: ["templates", "template"],
  SOURCES: ["sources"],
};

function Scope({ children }: { children: ReactNode }) {
  const authHeaders = useVaultStore((store) => store.authHeaders);
  const checkServer = useVaultStore((store) => store.checkServer);
  const syncChanges = useVaultStore((store) => store.syncChanges);
  const [failure, setFailure] = useState<VaultGraphQLError | null>(null);
  const [scope] = useState(() => {
    const transport = createVaultGraphQLClient({
      authHeaders,
      onError: (error) => setFailure((previous) => (previous?.accessDenied ? previous : error)),
    });
    const controller = new VaultInvalidationController((families, reset) => {
      if (reset) transport.client.cache.restore({});
      else {
        transport.client.cache.batch({
          update(cache) {
            for (const family of families)
              for (const fieldName of fields[family]) cache.evict({ id: "ROOT_QUERY", fieldName });
          },
        });
        // Mounted atomic windows retain their entities until replacement; do not
        // collect their optimistic inventory while the root is being refreshed.
      }
    });
    return { ...transport, controller };
  });
  const baseline = useSyncExternalStore(scope.controller.onCursor, scope.controller.getBaseline, () => null);
  const connected = useRef(false);
  const [streamAttempt, setStreamAttempt] = useState(0);
  useEffect(() => {
    if (!baseline) return;
    connected.current = false;
    const subscription = scope.client
      .subscribe({
        query: VaultChangesDocument,
        variables: { epoch: baseline.epoch, since: baseline.seq },
        fetchPolicy: "no-cache",
      })
      .subscribe({
        next(result) {
          const event = result.data?.vaultChanges;
          if (!event) return;
          connected.current = true;
          scope.controller.event(event);
          // This is a no-op until a legacy screen has actually loaded a snapshot.
          // Both transports read the same trigger log with independent cursors.
          if (event.reset || event.families.length) void syncChanges().catch(() => {});
          setFailure((previous) => (previous?.accessDenied ? previous : null));
        },
        error(error: unknown) {
          connected.current = false;
          setFailure((previous) =>
            previous?.accessDenied
              ? previous
              : {
                  message:
                    error instanceof Error ? error.message : "Live updates disconnected. Retrying on focus.",
                  accessDenied: false,
                },
          );
        },
        complete() {
          connected.current = false;
        },
      });
    return () => subscription.unsubscribe();
  }, [baseline, scope, syncChanges, streamAttempt]);
  const legacyCache = useQueryClient();
  const checkedSources = useRef(false);
  useEffect(() => {
    // Preserve deferred source checks for direct Library entry without loading State.
    // Legacy entry already schedules its own check after the snapshot is usable.
    if (!baseline || checkedSources.current) return;
    checkedSources.current = true;
    if (legacyCache.getQueryData(VAULT_QUERY)) return;
    void fetch("/api/catalog-sources", { method: "PUT", headers: authHeaders() }).catch(() => {});
  }, [baseline, legacyCache, authHeaders]);
  const checking = useRef<Promise<void> | null>(null);
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible" || checking.current) return;
      checking.current = (async () => {
        await checkServer();
        const cursor = scope.controller.getCursor();
        if (!cursor) return;
        const result = await scope.client.query({
          query: VaultInvalidationDocument,
          variables: { epoch: cursor.epoch, since: cursor.seq },
          fetchPolicy: "no-cache",
        });
        if (result.data) scope.controller.event(result.data.vaultInvalidation);
        if (!connected.current) setStreamAttempt((attempt) => attempt + 1);
        setFailure((previous) => (previous?.accessDenied ? previous : null));
      })()
        .catch((error: unknown) => {
          setFailure((previous) =>
            previous?.accessDenied
              ? previous
              : {
                  message: error instanceof Error ? error.message : "Could not check for updates",
                  accessDenied: false,
                },
          );
        })
        .finally(() => {
          checking.current = null;
        });
    };
    const timer = setInterval(check, 30_000);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [scope, checkServer]);
  useEffect(
    () => () => {
      scope.controller.dispose();
      scope.dispose();
    },
    [scope],
  );
  if (failure?.accessDenied) return <Alert severity="error">Vault access expired. Sign in again.</Alert>;
  return (
    <ApolloProvider client={scope.client}>
      <VaultGraphQLContext.Provider value={scope}>
        {failure && (
          <Alert severity="warning" role="status">
            {failure.message}
          </Alert>
        )}
        {children}
      </VaultGraphQLContext.Provider>
    </ApolloProvider>
  );
}

// Server changes remount Vault; token/cookie account transitions create a new scope.
export function VaultGraphQLProvider({ children }: { children: ReactNode }) {
  const generation = useVaultStore((store) => store.authGeneration);
  return <Scope key={generation}>{children}</Scope>;
}
