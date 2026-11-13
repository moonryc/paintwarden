import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import type { Tab } from "../types";

import { VaultNavigationDocument, type VaultNavigationQuery } from "./generated/graphql";
import type { ReadTicket, VaultFamily } from "./invalidation";
import { useVaultGraphQL } from "./provider";

const FAMILIES: readonly VaultFamily[] = ["LIBRARY", "WISHLIST"];
const NavigationCounts = createContext<Partial<Record<Tab, number>>>({});
export const useNavigationCounts = () => useContext(NavigationCounts);

// One bounded, revision-guarded shell projection serves both desktop and mobile
// navigation. Missing/loading badges stay absent rather than displaying false zeroes.
export function NavigationCountsProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const scope = useVaultGraphQL();
  const [state, setState] = useState<{ scope: typeof scope; data: VaultNavigationQuery } | null>(null);
  useEffect(() => {
    if (!scope || !enabled) return;
    let active = true;
    let running = false;
    let pending = false;
    let accepted: { ticket: ReadTicket; data: VaultNavigationQuery } | null = null;
    const run = async () => {
      pending = true;
      if (running) return;
      running = true;
      try {
        for (let attempt = 0; active && pending && attempt < 4; attempt += 1) {
          pending = false;
          const ticket = scope.controller.capture();
          const result = await scope.client.query({
            query: VaultNavigationDocument,
            fetchPolicy: "no-cache",
          });
          if (!active || !result.data) return;
          if (!scope.controller.accepts(ticket, result.data.vaultNavigation.revision, FAMILIES)) {
            pending = true;
            continue;
          }
          accepted = { ticket, data: result.data };
          scope.client.writeQuery({ query: VaultNavigationDocument, data: result.data });
          setState({ scope, data: result.data });
        }
      } catch {
        // Screen reads surface connection errors; badges must never block navigation.
      } finally {
        running = false;
      }
    };
    const unsubscribe = scope.controller.listen(FAMILIES, () => {
      if (
        accepted &&
        scope.controller.isCurrent(accepted.ticket) &&
        scope.controller.isFresh(accepted.data.vaultNavigation.revision, FAMILIES)
      )
        return;
      void run();
    });
    void run();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [scope, enabled]);
  const data = enabled && state?.scope === scope ? state.data.vaultNavigation : null;
  return (
    <NavigationCounts.Provider
      value={data ? { paints: data.availablePaints, wishlist: data.shoppingPaints } : {}}
    >
      {children}
    </NavigationCounts.Provider>
  );
}
