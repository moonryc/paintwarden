import { useContext } from "react";
import { useStore } from "zustand";

import { VaultStoreContext } from "./context";
import type { VaultStore } from "./vault-store";

// Reads shared actions or screen state, such as `useVaultStore((s) => s.go)`.
// The component re-renders only when the selected value changes, so select single fields or
// actions rather than building new objects in the selector.
export function useVaultStore<T>(selector: (store: VaultStore) => T): T {
  const store = useContext(VaultStoreContext);
  if (!store) throw new Error("useVaultStore must be used inside a VaultStoreProvider");
  return useStore(store, selector);
}
