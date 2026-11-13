import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { useStore } from "zustand";

import type { State } from "../types";

import { VaultStoreContext } from "./context";
import type { VaultStore } from "./vault-store";

// Reads shared actions or screen state, such as `useVaultStore((s) => s.setPaintState)`.
// The component re-renders only when the selected value changes, so select single fields or
// actions rather than building new objects in the selector.
export function useVaultStore<T>(selector: (store: VaultStore) => T): T {
  const store = useContext(VaultStoreContext);
  if (!store) throw new Error("useVaultStore must be used inside a VaultStoreProvider");
  return useStore(store, selector);
}

// Complete sample snapshots are available only to legacy Storybook adapters. Runtime
// consumers must use scoped Apollo projections, never construct State from pages.
export type LegacyVaultAdapter = {
  subscribe(onChange: () => void): () => void;
  getSnapshot(): State;
};
export const LegacyVaultContext = createContext<LegacyVaultAdapter | null>(null);

const selectVault = (data: State) => data;

export function useVault(): State;
export function useVault<T>(select: (data: State) => T, isEqual?: (a: T, b: T) => boolean): T;
export function useVault<T>(
  select: (data: State) => T = selectVault as (data: State) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const adapter = useContext(LegacyVaultContext);
  if (!adapter)
    throw new Error("useVault is fixture-only; runtime screens must use scoped Apollo projections");
  const subscribe = useCallback((onChange: () => void) => adapter.subscribe(onChange), [adapter]);
  const snapshot = useCallback(() => adapter.getSnapshot(), [adapter]);
  // Keep the last committed selection across inline-selector changes, but keep snapshot
  // memoization local to each render's selector. A shared mutable selector ref could expose
  // an uncommitted selector to the current subscription during concurrent rendering.
  const committed = useRef<{ value: T } | null>(null);
  const selectedSnapshot = useMemo(() => {
    let memo: { data: State; value: T } | undefined;
    return () => {
      const data = snapshot();
      if (memo && Object.is(memo.data, data)) return memo.value;
      const next = select(data);
      const previous = memo ?? committed.current;
      const value = previous && isEqual(previous.value, next) ? previous.value : next;
      memo = { data, value };
      return value;
    };
  }, [snapshot, select, isEqual]);
  // Cache the *selected* value, not only the raw vault. Repeated getSnapshot calls must
  // return the same reference even for inline selectors that allocate objects.
  const value = useSyncExternalStore(subscribe, selectedSnapshot, selectedSnapshot);
  useEffect(() => {
    committed.current = { value };
  }, [value]);
  return value;
}
