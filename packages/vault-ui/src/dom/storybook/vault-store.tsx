// Gives every story the vault context the app provides: a query cache holding the sample vault
// and a vault store whose server actions are spies, so components render without a server.
// A story can show different data with `parameters: { vault: someState }`.
import type { Decorator } from "@storybook/react-vite";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { fn } from "storybook/test";

import { createVaultStore } from "../store/vault-store";
import { VaultStoreProvider } from "../store/VaultStoreProvider";
import type { State } from "../types";
import { VAULT_QUERY, createVaultQueryClient } from "../utils/vault-query";

import { vault } from "./fixtures";

function StoryVault({ data, children }: { data: State; children: ReactNode }) {
  const [queryClient] = useState(() => {
    const client = createVaultQueryClient();
    client.setQueryData(VAULT_QUERY, data);
    return client;
  });
  const [store] = useState(() =>
    createVaultStore(queryClient, {
      api: fn(async () => ({})).mockName("api"),
      refresh: fn(async () => undefined).mockName("refresh"),
      syncChanges: fn(async () => undefined).mockName("syncChanges"),
      notify: fn().mockName("notify"),
      setPaintState: fn().mockName("setPaintState"),
      toggleOwned: fn().mockName("toggleOwned"),
      setRecipe: fn().mockName("setRecipe"),
      setRecipeSteps: fn().mockName("setRecipeSteps"),
      openMini: fn().mockName("openMini"),
      openPlugins: fn().mockName("openPlugins"),
    }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <VaultStoreProvider store={store}>{children}</VaultStoreProvider>
    </QueryClientProvider>
  );
}

export const withVaultStore: Decorator = (Story, context) => (
  // Keyed by story so each story starts from its own data and fresh spies.
  <StoryVault key={context.id} data={(context.parameters.vault as State | undefined) ?? vault}>
    <Story />
  </StoryVault>
);
