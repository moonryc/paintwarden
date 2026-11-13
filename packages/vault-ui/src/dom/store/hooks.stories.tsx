import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { expect, userEvent, waitFor } from "storybook/test";

import type { State } from "../types";
import { emptyState } from "../utils/constants";
import { VAULT_QUERY } from "../utils/vault-query";

import { useVault } from "./hooks";

// These clients never fetch, and override the sample-vault provider outside this story.
function createClient(name: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });
  client.setQueryData<State>(VAULT_QUERY, {
    ...emptyState,
    catalog: [
      {
        id: "red",
        name,
        brand: "Fixture",
        range: "Test",
        colorHex: "#ff0000",
        sourceUrl: null,
        isCustom: true,
      },
    ],
    paintStates: { red: "OWNED", blue: "WISHLIST" },
  });
  return client;
}

type Counts = Record<string, number>;
function countRender(counts: Counts, name: string) {
  counts[name] = (counts[name] ?? 0) + 1;
  return <span data-testid={`${name}-renders`}>{counts[name]}</span>;
}

function CatalogSubscriber({ counts }: { counts: Counts }) {
  const catalog = useVault((data) => data.catalog);
  return (
    <p>
      Catalog: <span data-testid="catalog-value">{catalog[0]?.name ?? "empty"}</span>
      {countRender(counts, "catalog")}
    </p>
  );
}

function InventorySubscriber({ counts }: { counts: Counts }) {
  const inventory = useVault((data) => data.paintStates);
  return (
    <p>
      Inventory: <span data-testid="inventory-value">{inventory.red ?? "empty"}</span>
      {countRender(counts, "inventory")}
    </p>
  );
}

function ObjectSubscriber({ counts }: { counts: Counts }) {
  // Both functions are deliberately new on every render. Shallow equality must suppress
  // renders even when an unrelated cache update creates a new raw vault snapshot.
  const selection = useVault(
    (data) => ({ catalog: data.catalog, inventory: data.paintStates }),
    (a, b) => a.catalog === b.catalog && a.inventory === b.inventory,
  );
  return (
    <p>
      Object: <span data-testid="object-value">{selection.inventory.red ?? "empty"}</span>
      {countRender(counts, "object")}
    </p>
  );
}

function DefaultObjectSubscriber({ counts }: { counts: Counts }) {
  // With no custom equality, a newly allocated object must still be a stable snapshot
  // between cache changes: reading it repeatedly must not cause an infinite render loop.
  const selection = useVault((data) => ({ quantity: data.paintRecords.red?.quantity ?? 0 }));
  return (
    <p>
      Default object: <span data-testid="default-object-value">{selection.quantity}</span>
      {countRender(counts, "default-object")}
    </p>
  );
}

function WholeVaultSubscriber({ counts }: { counts: Counts }) {
  const data = useVault();
  return (
    <p>
      Whole vault: <span data-testid="whole-value">{data.paintRecords.red?.quantity ?? 0}</span>
      {countRender(counts, "whole")}
    </p>
  );
}

function PaintSubscriber({ paintId, counts }: { paintId: string; counts: Counts }) {
  const status = useVault((data) => data.paintStates[paintId]);
  return (
    <p>
      Selected paint: <span data-testid="paint-value">{status ?? "empty"}</span>
      {countRender(counts, "paint")}
    </p>
  );
}

function SelectorControls({ counts }: { counts: Counts }) {
  const [paintId, setPaintId] = useState("red");
  return (
    <>
      <button onClick={() => setPaintId((id) => (id === "red" ? "blue" : "red"))}>
        Change selected paint
      </button>
      <PaintSubscriber paintId={paintId} counts={counts} />
    </>
  );
}

function RegressionFixture() {
  const [clients] = useState(() => [createClient("First client"), createClient("Second client")]);
  const [clientIndex, setClientIndex] = useState(0);
  const client = clients[clientIndex];
  const [counts] = useState<Counts>(() => ({}));
  // Keep the actual subscriber elements stable when the provider's client changes. Cache
  // mutation buttons do not set React state, so only hook notifications can render them.
  const [subscribers] = useState(() => (
    <>
      <CatalogSubscriber counts={counts} />
      <InventorySubscriber counts={counts} />
      <ObjectSubscriber counts={counts} />
      <DefaultObjectSubscriber counts={counts} />
      <WholeVaultSubscriber counts={counts} />
      <SelectorControls counts={counts} />
    </>
  ));
  return (
    <QueryClientProvider client={client}>
      <section aria-label="Vault subscription regression fixture">
        <button
          onClick={() =>
            client.setQueryData<State>(
              VAULT_QUERY,
              (data) =>
                data && {
                  ...data,
                  paintRecords: {
                    ...data.paintRecords,
                    red: {
                      state: "OWNED",
                      stockLevel: "FULL",
                      quantity: (data.paintRecords.red?.quantity ?? 0) + 1,
                    },
                  },
                },
            )
          }
        >
          Update paint record
        </button>
        <button
          onClick={() =>
            client.setQueryData<State>(
              VAULT_QUERY,
              (data) =>
                data && {
                  ...data,
                  paintStates: { ...data.paintStates, red: "WISHLIST" },
                },
            )
          }
        >
          Update inventory
        </button>
        <button
          onClick={() =>
            client.setQueryData<State>(
              VAULT_QUERY,
              (data) =>
                data && {
                  ...data,
                  catalog: data.catalog.map((paint) => ({ ...paint, name: "Updated catalog" })),
                },
            )
          }
        >
          Update catalog
        </button>
        <button onClick={() => client.removeQueries({ queryKey: VAULT_QUERY, exact: true })}>
          Remove vault query
        </button>
        <button onClick={() => setClientIndex((index) => 1 - index)}>Switch query client</button>
        <button
          onClick={() =>
            clients[0].setQueryData<State>(
              VAULT_QUERY,
              (data) =>
                data && {
                  ...data,
                  catalog: data.catalog.map((paint) => ({ ...paint, name: "Inactive client" })),
                },
            )
          }
        >
          Update first client
        </button>
        {subscribers}
      </section>
    </QueryClientProvider>
  );
}

const meta = {
  title: "Store/useVault",
  component: RegressionFixture,
} satisfies Meta<typeof RegressionFixture>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SelectorSubscriptions: Story = {
  play: async ({ canvas }) => {
    const renders = (name: string) => Number(canvas.getByTestId(`${name}-renders`).textContent);
    const baseline = Object.fromEntries(
      ["catalog", "inventory", "object", "whole"].map((name) => [name, renders(name)]),
    );

    await userEvent.click(canvas.getByRole("button", { name: "Update paint record" }));
    await waitFor(() => expect(canvas.getByTestId("whole-value")).toHaveTextContent("1"));
    await expect(canvas.getByTestId("default-object-value")).toHaveTextContent("1");
    await expect(renders("whole")).toBeGreaterThan(baseline.whole);
    await expect(renders("catalog")).toBe(baseline.catalog);
    await expect(renders("inventory")).toBe(baseline.inventory);
    await expect(renders("object")).toBe(baseline.object);

    const wholeBeforeInventory = renders("whole");
    await userEvent.click(canvas.getByRole("button", { name: "Update inventory" }));
    await waitFor(() => expect(canvas.getByTestId("inventory-value")).toHaveTextContent("WISHLIST"));
    await expect(renders("inventory")).toBeGreaterThan(baseline.inventory);
    await expect(renders("object")).toBeGreaterThan(baseline.object);
    await expect(renders("whole")).toBeGreaterThan(wholeBeforeInventory);
    await expect(renders("catalog")).toBe(baseline.catalog);

    const inventoryBeforeCatalog = renders("inventory");
    const objectBeforeCatalog = renders("object");
    const wholeBeforeCatalog = renders("whole");
    await userEvent.click(canvas.getByRole("button", { name: "Update catalog" }));
    await waitFor(() => expect(canvas.getByTestId("catalog-value")).toHaveTextContent("Updated catalog"));
    await expect(renders("catalog")).toBeGreaterThan(baseline.catalog);
    await expect(renders("object")).toBeGreaterThan(objectBeforeCatalog);
    await expect(renders("whole")).toBeGreaterThan(wholeBeforeCatalog);
    await expect(renders("inventory")).toBe(inventoryBeforeCatalog);

    // Removal must publish the shared empty snapshot, including to selectors.
    const wholeBeforeRemoval = renders("whole");
    await userEvent.click(canvas.getByRole("button", { name: "Remove vault query" }));
    await waitFor(() => expect(canvas.getByTestId("catalog-value")).toHaveTextContent("empty"));
    await expect(canvas.getByTestId("inventory-value")).toHaveTextContent("empty");
    await expect(canvas.getByTestId("object-value")).toHaveTextContent("empty");
    await expect(canvas.getByTestId("whole-value")).toHaveTextContent("0");
    await expect(renders("whole")).toBeGreaterThan(wholeBeforeRemoval);
  },
};

export const SelectorAndClientChanges: Story = {
  play: async ({ canvas }) => {
    const renders = (name: string) => Number(canvas.getByTestId(`${name}-renders`).textContent);
    const catalogBefore = renders("catalog");
    const wholeBefore = renders("whole");
    await expect(canvas.getByTestId("paint-value")).toHaveTextContent("OWNED");
    await userEvent.click(canvas.getByRole("button", { name: "Change selected paint" }));
    await waitFor(() => expect(canvas.getByTestId("paint-value")).toHaveTextContent("WISHLIST"));
    // Only the closure prop changed: no cache notification is available to fix stale selection.
    await expect(renders("catalog")).toBe(catalogBefore);
    await expect(renders("whole")).toBe(wholeBefore);
    await userEvent.click(canvas.getByRole("button", { name: "Change selected paint" }));
    await waitFor(() => expect(canvas.getByTestId("paint-value")).toHaveTextContent("OWNED"));

    await userEvent.click(canvas.getByRole("button", { name: "Switch query client" }));
    await waitFor(() => expect(canvas.getByTestId("catalog-value")).toHaveTextContent("Second client"));
    const switchedCatalog = renders("catalog");
    const switchedWhole = renders("whole");
    await userEvent.click(canvas.getByRole("button", { name: "Update first client" }));
    await expect(canvas.getByTestId("catalog-value")).toHaveTextContent("Second client");
    await expect(renders("catalog")).toBe(switchedCatalog);
    await expect(renders("whole")).toBe(switchedWhole);

    await userEvent.click(canvas.getByRole("button", { name: "Update paint record" }));
    await waitFor(() => expect(canvas.getByTestId("whole-value")).toHaveTextContent("1"));
    await expect(renders("whole")).toBeGreaterThan(switchedWhole);
    await expect(renders("catalog")).toBe(switchedCatalog);
    await userEvent.click(canvas.getByRole("button", { name: "Switch query client" }));
    await waitFor(() => expect(canvas.getByTestId("catalog-value")).toHaveTextContent("Inactive client"));
    await expect(canvas.getByTestId("whole-value")).toHaveTextContent("0");
  },
};
