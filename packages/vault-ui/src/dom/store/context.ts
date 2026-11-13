import { createContext } from "react";

import type { VaultStoreApi } from "./vault-store";

export const VaultStoreContext = createContext<VaultStoreApi | null>(null);
