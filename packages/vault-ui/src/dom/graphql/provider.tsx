import { i18n } from "@paintwarden/i18n/runtime";
import type { ApolloClient } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import Box from "@mui/material/Box";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { ConnectionLostContext, PageErrorSuppressedContext } from "../Components/QueryErrorNotice";
import { AppBanner } from "../Components/AppBanner";
import { AppContent } from "../Layout/AppContent";
import { useVaultStore } from "../store/hooks";

import {
  createVaultGraphQLClient,
  isVaultConnectionLost,
  isVaultRateLimited,
  type VaultGraphQLError,
} from "./client";
import { VaultChangesDocument, VaultInvalidationDocument, VaultRevisionDocument } from "./generated/graphql";
import { VaultInvalidationController } from "./invalidation";
import { PluginInstallProvider } from "./plugin-install-hooks";
import { VaultReconnection, reconnectDelay } from "./reconnection";

export type VaultGraphQLScope = { client: ApolloClient; controller: VaultInvalidationController };
export const VaultGraphQLContext = createContext<VaultGraphQLScope | null>(null);
export const useVaultGraphQL = () => useContext(VaultGraphQLContext);

const VaultConnectionContext = createContext<{
  failure: VaultGraphQLError | null;
  retry: () => void;
  lost: boolean;
} | null>(null);

// Providers own transport state; the shell owns placement. Never render a notice
// before the shell, where the fixed navigation/titlebar can cover it.
export function VaultGraphQLStatus() {
  const connection = useContext(VaultConnectionContext);
  if (!connection || (!connection.failure && !connection.lost)) return null;
  if (connection.lost)
    return (
      <AppBanner severity="info" onRetry={connection.retry}>
        {i18n.t("shell:connectionLostReconnecting")}
      </AppBanner>
    );
  if (!connection.failure) return null;
  const { failure, retry } = connection;
  return (
    <AppBanner key={failure.message} severity={failure.accessDenied ? "error" : "warning"} onRetry={retry}>
      {failure.accessDenied ? i18n.t("shell:vaultAccessExpiredSignInAgain") : failure.message}
    </AppBanner>
  );
}

function Scope({ children }: { children: ReactNode }) {
  const auth = useVaultStore((store) => store.auth);
  const token = useVaultStore((store) => store.token);
  const setToken = useVaultStore((store) => store.setToken);
  const authHeaders = useVaultStore((store) => store.authHeaders);
  const checkServer = useVaultStore((store) => store.checkServer);
  const refreshGeneration = useVaultStore((store) => store.refreshGeneration);
  const [failure, setFailure] = useState<VaultGraphQLError | null>(null);
  const [scope] = useState(() => {
    const transport = createVaultGraphQLClient({
      onDisconnect: () => recovery?.disconnected(),
      sseRetry: (attempt) => new Promise((resolve) => setTimeout(resolve, reconnectDelay(attempt))),
      authHeaders,
      onError: (error) => {
        // Query/mutation hooks own recoverable errors, including STALE_CURSOR
        // retries. Only authorization is a scope-wide transport failure.
        if (error.accessDenied) {
          recovery.dispose();
          setFailure(error);
        }
      },
    });
    const controller = new VaultInvalidationController((_families, reset) => {
      // Ordinary invalidations mark revisions dirty, not absent. All readers use
      // no-cache and publish only accepted complete windows; evicting roots here
      // needlessly tears down cache consumers before their replacement arrives.
      if (reset) transport.client.cache.restore({});
    });
    const recovery = new VaultReconnection(
      async () => {
        const cursor = controller.getCursor();
        if (cursor) {
          const result = await transport.client.query({
            query: VaultInvalidationDocument,
            variables: { epoch: cursor.epoch, since: cursor.seq },
            fetchPolicy: "no-cache",
          });
          if (result.data) controller.event(result.data.vaultInvalidation);
        } else {
          await transport.client.query({ query: VaultRevisionDocument, fetchPolicy: "no-cache" });
        }
      },
      async () => {
        // Most projections are atomic imperative readers, not Apollo watchers.
        // Refresh both kinds; never replay mutations, even after a lost response.
        await checkServer();
        controller.refresh();
        setFailure((previous) => (previous?.accessDenied ? previous : null));
        setStreamAttempt((attempt) => attempt + 1);
        await Promise.allSettled(transport.client.refetchQueries({ include: "all" }).results);
      },
    );
    return { ...transport, controller, recovery };
  });
  const lost = useSyncExternalStore(scope.recovery.subscribe, scope.recovery.getSnapshot, () => false);
  const baseline = useSyncExternalStore(scope.controller.onCursor, scope.controller.getBaseline, () => null);
  const connected = useRef(false);
  const [streamAttempt, setStreamAttempt] = useState(0);
  useEffect(() => {
    if (!baseline) return;
    connected.current = false;
    let terminalFailure = false;
    const subscription = scope.client
      .subscribe({
        query: VaultChangesDocument,
        variables: { epoch: baseline.epoch, since: baseline.seq },
        fetchPolicy: "no-cache",
      })
      .subscribe({
        next(result) {
          if (result.error) {
            terminalFailure = true;
            connected.current = false;
            if (!isVaultRateLimited(result.error))
              setFailure({ message: result.error.message, accessDenied: false });
            return;
          }
          const event = result.data?.vaultChanges;
          if (!event) return;
          connected.current = true;
          scope.controller.event(event);
          if (!scope.recovery.getSnapshot())
            setFailure((previous) => (previous?.accessDenied ? previous : null));
        },
        error(error: unknown) {
          connected.current = false;
          if (isVaultConnectionLost(error)) {
            scope.recovery.disconnected();
            return;
          }
          setFailure((previous) =>
            previous?.accessDenied
              ? previous
              : {
                  message:
                    error instanceof Error
                      ? error.message
                      : i18n.t("shell:liveUpdatesDisconnectedRetryingOnFocus"),
                  accessDenied: false,
                },
          );
        },
        complete() {
          connected.current = false;
          if (!terminalFailure) scope.recovery.disconnected();
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
        // A throttled catch-up is not a broken connection. The retained SSE
        // stream and next focus/30s check still own eventual reconciliation.
        if (isVaultRateLimited(error)) return;
        if (isVaultConnectionLost(error)) {
          scope.recovery.disconnected();
          return;
        }
        if (current)
          setFailure({
            message: error instanceof Error ? error.message : i18n.t("shell:couldNotRefreshLiveUpdates"),
            accessDenied: false,
          });
      });
    return () => {
      current = false;
    };
  }, [scope, refreshGeneration]);
  const checking = useRef<Promise<void> | null>(null);
  const check = useCallback(
    (userInitiated = false) => {
      if (scope.recovery.getSnapshot()) {
        void scope.recovery.retry();
        return;
      }
      if (document.visibilityState !== "visible" || checking.current) return;
      // A connected SSE stream already delivers durable cursor catch-up. Auth
      // polling remains in useServerChecks; duplicate focus/poll queries only
      // compete with the user's searches and edits for the same request budget.
      if (!userInitiated && connected.current) return;
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
          // Foreground search bursts can temporarily exhaust the shared budget.
          // Only an explicit Retry should surface that response globally; keep
          // polling at the normal bounded interval, without a hot retry loop.
          if (!userInitiated && isVaultRateLimited(error)) return;
          if (isVaultConnectionLost(error)) {
            scope.recovery.disconnected();
            return;
          }
          setFailure((previous) =>
            previous?.accessDenied
              ? previous
              : {
                  message: error instanceof Error ? error.message : i18n.t("shell:couldNotCheckForUpdates"),
                  accessDenied: false,
                },
          );
        })
        .finally(() => {
          checking.current = null;
        });
    },
    [scope, checkServer],
  );
  useEffect(() => {
    const backgroundCheck = () => check();
    const timer = setInterval(backgroundCheck, 30_000);
    window.addEventListener("focus", backgroundCheck);
    window.addEventListener("online", backgroundCheck);
    document.addEventListener("visibilitychange", backgroundCheck);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", backgroundCheck);
      window.removeEventListener("online", backgroundCheck);
      document.removeEventListener("visibilitychange", backgroundCheck);
    };
  }, [check]);
  useEffect(
    () => () => {
      scope.recovery.dispose();
      scope.controller.dispose();
      scope.dispose();
    },
    [scope],
  );
  // Authorization denial must unmount every projection/dialog, not merely clear
  // Apollo's cache: atomic windows also retain previously accepted local data.
  // There is no navigation in this state, so use the shared full-width content
  // container with titlebar clearance rather than leaving private rows behind.
  // Retry advances the auth generation, recreating the disposed transport and
  // rechecking access rather than querying a permanently stopped client.
  if (failure?.accessDenied)
    return (
      <Box component="main" sx={{ minHeight: "100vh", pt: 8, bgcolor: "var(--canvas)" }}>
        <AppContent>
          <AppBanner severity="error" onRetry={() => setToken(token)}>
            {i18n.t("shell:vaultAccessExpiredSignInAgain")}
          </AppBanner>
        </AppContent>
      </Box>
    );
  return (
    <ApolloProvider client={scope.client}>
      <VaultGraphQLContext.Provider value={scope}>
        <VaultConnectionContext.Provider value={{ failure, lost, retry: () => check(true) }}>
          <ConnectionLostContext.Provider value={lost}>
            <PageErrorSuppressedContext.Provider value={Boolean(failure)}>
              <PluginInstallProvider
                client={scope.client}
                enabled={Boolean(auth && !auth.setupRequired && (!auth.requireSignIn || auth.authenticated))}
              >
                {children}
              </PluginInstallProvider>
            </PageErrorSuppressedContext.Provider>
          </ConnectionLostContext.Provider>
        </VaultConnectionContext.Provider>
      </VaultGraphQLContext.Provider>
    </ApolloProvider>
  );
}

// Server changes remount Vault; token/cookie account transitions create a new scope.
export function VaultGraphQLProvider({ children }: { children: ReactNode }) {
  const generation = useVaultStore((store) => store.authGeneration);
  return <Scope key={generation}>{children}</Scope>;
}
