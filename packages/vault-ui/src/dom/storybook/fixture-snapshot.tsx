// Storybook-only mutable snapshots. These never fetch or participate in the production
// data layer; the query-shaped methods just keep fixture mutation controls concise.
import { createContext, useContext, type ReactNode } from "react";

import { LegacyVaultContext } from "../store/hooks";
import type { State } from "../types";
import { emptyState } from "../utils/constants";

export const VAULT_QUERY = ["vault"] as const;

export function createFixtureSnapshotClient(initialState?: State) {
  let snapshot = initialState;
  const listeners = new Set<() => void>();
  const publish = (next: State | undefined) => {
    if (Object.is(snapshot, next)) return;
    snapshot = next;
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => snapshot ?? emptyState,
    subscribe: (onChange: () => void) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    getQueryData: <T extends State = State>(_key: typeof VAULT_QUERY) => snapshot as T | undefined,
    setQueryData: <T extends State = State>(
      _key: typeof VAULT_QUERY,
      update: T | ((data: T | undefined) => T | undefined),
    ) => {
      const next = typeof update === "function" ? update(snapshot as T | undefined) : update;
      // Like the previous fixture cache, an undefined updater result leaves data alone.
      if (next !== undefined) publish(next);
      return snapshot;
    },
    removeQueries: (_filter: { queryKey: typeof VAULT_QUERY; exact?: boolean }) => publish(undefined),
  };
}

export type FixtureSnapshotClient = ReturnType<typeof createFixtureSnapshotClient>;
const FixtureSnapshotContext = createContext<FixtureSnapshotClient | null>(null);

export function FixtureSnapshotProvider({
  client,
  children,
}: {
  client: FixtureSnapshotClient;
  children: ReactNode;
}) {
  return (
    <FixtureSnapshotContext.Provider value={client}>
      <LegacyVaultContext.Provider value={client}>{children}</LegacyVaultContext.Provider>
    </FixtureSnapshotContext.Provider>
  );
}

export function useFixtureSnapshotClient() {
  const client = useContext(FixtureSnapshotContext);
  if (!client) throw new Error("Fixture snapshot controls require FixtureSnapshotProvider");
  return client;
}
