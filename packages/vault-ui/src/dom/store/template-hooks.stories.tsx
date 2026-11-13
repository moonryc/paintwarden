import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { emptyState } from "../utils/constants";
import { TEMPLATES_QUERY, templateCatalogOptions, templateRecipeOptions } from "../utils/template-query";
import { VAULT_QUERY, createVaultQueryClient } from "../utils/vault-query";

import { createVaultStore } from "./vault-store";

const meta = {
  title: "Store/Template cache",
  render: () => <p>Template catalog, recipes, and vault invalidation regression.</p>,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Invalidation: Story = {
  play: async () => {
    const client = createVaultQueryClient();
    const store = createVaultStore(client);
    const headers = store.getState().authHeaders;
    const catalogKey = templateCatalogOptions(headers).queryKey;
    const recipeKey = templateRecipeOptions("user:one", headers).queryKey;
    const seed = () => {
      client.setQueryData(VAULT_QUERY, { ...emptyState, cursor: { epoch: "fixture", seq: 1 } });
      client.setQueryData(catalogKey, { sourceVersion: null, categories: [], templates: [] });
      client.setQueryData(recipeKey, { schemeIds: ["existing-scheme"], paints: [] });
    };
    const expectInvalidated = () => {
      expect(client.getQueryState(catalogKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(recipeKey)?.isInvalidated).toBe(true);
    };
    const originalFetch = window.fetch;
    let reload = false;
    window.fetch = async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.startsWith("/api/changes")) {
        return Response.json({ epoch: "fixture", seq: reload ? 2 : 1, reload, changes: [] });
      }
      return Response.json({ ok: true });
    };
    try {
      // Ordinary paint/miniature saves do not invalidate the large template list.
      seed();
      await store.getState().api("/api/paint-state", { method: "PUT", body: "{}" });
      expect(client.getQueryState(catalogKey)?.isInvalidated).toBe(false);

      // Template and source writes are reported by the server as reload changes, including
      // changes picked up from another client by the periodic sync.
      for (const path of ["/api/miniature-templates", "/api/catalog-sources"]) {
        seed();
        reload = true;
        await store.getState().api(path, { method: "PUT", body: "{}" });
        expectInvalidated();
      }
      seed();
      await store.getState().syncChanges();
      expectInvalidated();

      // Backup restore and source dialogs use refresh rather than the mutation helper.
      seed();
      await store.getState().refresh();
      expectInvalidated();

      seed();
      store.getState().setToken("second-account");
      expect(store.getState().authHeaders()).toEqual({ authorization: "Bearer second-account" });
      expect(client.getQueryData(catalogKey)).toBeUndefined();
      expect(client.getQueryData(recipeKey)).toBeUndefined();
      expect(client.getQueryCache().findAll({ queryKey: TEMPLATES_QUERY })).toHaveLength(2);
    } finally {
      window.fetch = originalFetch;
      client.clear();
    }
  },
};
