import type { ReactNode } from "react";

import { VaultStoreContext } from "./context";
import type { VaultStoreApi } from "./vault-store";

// Makes one vault's store available to `useVaultStore`. It must sit inside the
// QueryClientProvider for the same vault, since the store reads and writes that client's cache.
export function VaultStoreProvider({ store, children }: { store: VaultStoreApi; children: ReactNode }) {
  return <VaultStoreContext.Provider value={store}>{children}</VaultStoreContext.Provider>;
}
