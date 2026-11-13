import type { ApolloClient } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { Alert } from "@mui/material";
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

import { createVaultGraphQLClient, type VaultGraphQLError } from "./client";
import { VaultChangesDocument, VaultInvalidationDocument } from "./generated/graphql";
import { VaultInvalidationController, type VaultFamily } from "./invalidation";

export type VaultGraphQLScope = { client: ApolloClient; controller: VaultInvalidationController };
export const VaultGraphQLContext = createContext<VaultGraphQLScope | null>(null);
export const useVaultGraphQL = () => useContext(VaultGraphQLContext);

const fields: Record<VaultFamily, readonly string[]> = {
  LIBRARY: ["library", "vaultNavigation"],
  PAINT: ["paint", "paintRanking", "ownedPaintOptions"],
  OPTIONS: ["paintOptions", "ownedPaintOptions"],
  HOME: ["home"],
  MINIATURES: ["miniatures", "miniature"],
  WISHLIST: [
    "wishlist",
    "wishlistModelOptions",
    "wishlistRelatedProjects",
    "wishlistExport",
    "vaultNavigation",
  ],
  SCHEMES: ["schemes", "schemePaintOptions", "miniatureScheme"],
  TEMPLATES: ["templates", "templateRecipe"],
  SOURCES: ["sources", "sourceVersions", "sourceRemoval", "sourceShareable"],
};

function Scope({ children }: { children: ReactNode }) {
  const authHeaders = useVaultStore((store) => store.authHeaders);
  const checkServer = useVaultStore((store) => store.checkServer);
  const refreshGeneration = useVaultStore((store) => store.refreshGeneration);
  const [failure, setFailure] = useState<VaultGraphQLError | null>(null);
  const [scope] = useState(() => {
    const transport = createVaultGraphQLClient({
      authHeaders,
      onError: (error) => {
        // Query/mutation hooks own recoverable errors, including STALE_CURSOR
        // retries. Only authorization is a scope-wide transport failure.
        if (error.accessDenied) setFailure(error);
      },
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
  }, [baseline, scope, streamAttempt]);
  const refreshed = useRef(refreshGeneration);
  useEffect(() => {
    if (refreshed.current === refreshGeneration) return;
    refreshed.current = refreshGeneration;
    scope.controller.refresh();
    const cursor = scope.controller.getCursor();
    if (!cursor) return;
    let current = true;
    // Restores can replace the epoch. Reconcile immediately instead of waiting
    // for focus/polling while new envelopes are correctly rejected as old-scope.
    void scope.client
      .query({
        query: VaultInvalidationDocument,
        variables: { epoch: cursor.epoch, since: cursor.seq },
        fetchPolicy: "no-cache",
      })
      .then(({ data }) => {
        if (current && data) scope.controller.event(data.vaultInvalidation);
      })
      .catch((error: unknown) => {
        if (current)
          setFailure({
            message: error instanceof Error ? error.message : "Could not refresh live updates",
            accessDenied: false,
          });
      });
    return () => {
      current = false;
    };
  }, [scope, refreshGeneration]);
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
