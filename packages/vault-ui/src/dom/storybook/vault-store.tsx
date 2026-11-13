// Gives every story a fixture-only snapshot holding the sample vault
// and a vault store whose server actions are spies, so components render without a server.
// A story can show different data with `parameters: { vault: someState }`.
import type { Decorator } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { fn } from "storybook/test";

import { PaintCommandsContext, type PaintCommands } from "../graphql/paint-actions";
import { WishlistFixtureContext } from "../graphql/wishlist-hooks";
import { createVaultStore } from "../store/vault-store";
import { VaultStoreProvider } from "../store/VaultStoreProvider";
import type { State } from "../types";

import {
  createFixtureSnapshotClient,
  FixtureSnapshotProvider,
  type FixtureSnapshotClient,
} from "./fixture-snapshot";
import { vault } from "./fixtures";
import { createWishlistFixture } from "./wishlist-fixture";

// Isolate this subscription so snapshot edits do not render unrelated stories/controls.
function WishlistFixtureProvider({
  client,
  children,
}: {
  client: FixtureSnapshotClient;
  children: ReactNode;
}) {
  const data = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  const fixture = useMemo(() => createWishlistFixture(() => data), [data]);
  return <WishlistFixtureContext.Provider value={fixture}>{children}</WishlistFixtureContext.Provider>;
}

function StoryVault({ data, children }: { data: State; children: ReactNode }) {
  const [client] = useState(() => createFixtureSnapshotClient(data));
  const [paintCommands] = useState<PaintCommands>(() => ({
    importPaints: fn<PaintCommands["importPaints"]>(async (paints) => ({
      imported: paints.length,
      skipped: 0,
    })).mockName("importPaints"),
    updatePaint: fn<PaintCommands["updatePaint"]>(async () => undefined).mockName("updatePaint"),
    deletePaint: fn<PaintCommands["deletePaint"]>(async () => undefined).mockName("deletePaint"),
    createSubstitution: fn<PaintCommands["createSubstitution"]>(async () => "story-substitution").mockName(
      "createSubstitution",
    ),
    setSubstitutionDefault: fn<PaintCommands["setSubstitutionDefault"]>(async () => undefined).mockName(
      "setSubstitutionDefault",
    ),
    deleteSubstitution: fn<PaintCommands["deleteSubstitution"]>(async () => undefined).mockName(
      "deleteSubstitution",
    ),
  }));
  const [store] = useState(() =>
    createVaultStore(undefined, {
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
    <FixtureSnapshotProvider client={client}>
      <VaultStoreProvider store={store}>
        <PaintCommandsContext.Provider value={paintCommands}>
          <WishlistFixtureProvider client={client}>{children}</WishlistFixtureProvider>
        </PaintCommandsContext.Provider>
      </VaultStoreProvider>
    </FixtureSnapshotProvider>
  );
}

export const withVaultStore: Decorator = (Story, context) => (
  // Keyed by story so each story starts from its own data and fresh spies.
  <StoryVault key={context.id} data={(context.parameters.vault as State | undefined) ?? vault}>
    <Story />
  </StoryVault>
);
