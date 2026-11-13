import { ApolloProvider, useApolloClient, useQuery, useSubscription } from "@apollo/client/react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";

import { useVaultStore } from "../store/hooks";

import { createVaultGraphQLClient, type VaultGraphQLError } from "./client";
import { getFragmentData } from "./generated/fragment-masking";
import { LibraryPageDocument, LibraryPaintFragmentDoc, VaultChangesDocument } from "./generated/graphql";
import { DEBUG_LIBRARY_MAX_PAGES, LIBRARY_PAGE_SIZE, readLibraryWindow } from "./library-loader";

function LibraryRows() {
  const client = useApolloClient();
  const { data, loading, error } = useQuery(LibraryPageDocument, {
    variables: { first: LIBRARY_PAGE_SIZE },
    fetchPolicy: "cache-first",
  });
  const pages = useRef(1);
  const running = useRef<Promise<void> | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const refresh = useCallback(() => {
    pending.current = true;
    if (running.current) return running.current;
    setBusy(true);
    const work = async () => {
      try {
        while (pending.current && mounted.current) {
          pending.current = false;
          const next = await readLibraryWindow(client, pages.current);
          if (!mounted.current) return;
          client.writeQuery({
            query: LibraryPageDocument,
            variables: { first: LIBRARY_PAGE_SIZE },
            data: next,
          });
          setRefreshError("");
        }
      } catch (cause) {
        if (mounted.current)
          setRefreshError(cause instanceof Error ? cause.message : "Library refresh failed");
      } finally {
        running.current = null;
        if (mounted.current) setBusy(false);
      }
    };
    running.current = work();
    return running.current;
  }, [client]);
  const revision = data?.library.revision;
  const { error: subscriptionError } = useSubscription(VaultChangesDocument, {
    skip: !revision,
    variables: { epoch: revision?.epoch ?? "", since: revision?.seq ?? "0" },
    onData: ({ data: event }) => {
      const change = event.data?.vaultChanges;
      if (change && (change.reset || change.epoch !== revision?.epoch || change.seq !== revision?.seq))
        void refresh();
    },
  });
  useEffect(() => {
    mounted.current = true;
    const onFocus = () => {
      void refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted.current = false;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);
  const message = refreshError || error?.message || subscriptionError?.message;
  const paints = getFragmentData(LibraryPaintFragmentDoc, data?.library.nodes ?? []);
  return (
    <Stack spacing={1}>
      <Typography component="h2" variant="h6">
        Internal GraphQL Library
      </Typography>
      <Typography variant="body2">
        Raw inventory only · {paints.length} rows · bounded 48-row requests
      </Typography>
      {message && <Alert severity="warning">{message}</Alert>}
      <Box component="ul" sx={{ m: 0, pl: 3, maxHeight: 240, overflow: "auto" }}>
        {paints.map((paint) => (
          <li key={paint.id}>
            {paint.brand} · {paint.range} · {paint.name} — {paint.inventory?.state ?? "UNTRACKED"}
          </li>
        ))}
      </Box>
      <Stack direction="row" spacing={1}>
        <Button disabled={busy || loading} onClick={() => void refresh()}>
          Refresh loaded pages
        </Button>
        <Button
          disabled={
            busy || loading || !data?.library.pageInfo.hasNextPage || pages.current >= DEBUG_LIBRARY_MAX_PAGES
          }
          onClick={() => {
            pages.current += 1;
            void refresh();
          }}
        >
          Load next Library page
        </Button>
      </Stack>
      {(busy || loading) && <Typography role="status">Loading Library…</Typography>}
    </Stack>
  );
}

function ClientScope() {
  const authHeaders = useVaultStore((store) => store.authHeaders);
  const [failure, setFailure] = useState<VaultGraphQLError | null>(null);
  const [scope] = useState(() => createVaultGraphQLClient({ authHeaders, onError: setFailure }));
  useEffect(() => () => scope.dispose(), [scope]);
  // Do not leave another account's rows visible after an expired/revoked session.
  if (failure?.accessDenied) return <Alert severity="error">GraphQL access expired. Sign in again.</Alert>;
  return (
    <ApolloProvider client={scope.client}>
      <LibraryRows />
    </ApolloProvider>
  );
}

export default function LibraryDebugPanel() {
  const authGeneration = useVaultStore((store) => store.authGeneration);
  const [retry, setRetry] = useState(0);
  return (
    <Box sx={{ p: 2, border: "1px dashed", borderColor: "divider", m: 2 }}>
      {/* A new identity gets a brand-new client. Server changes unmount the containing Vault. */}
      <ClientScope key={`${authGeneration}:${retry}`} />
      <Button onClick={() => setRetry((value) => value + 1)}>Reconnect GraphQL debug client</Button>
    </Box>
  );
}
