import { ApolloClient, ApolloLink } from "@apollo/client";
import { Button } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { Observable } from "rxjs";
import { expect, userEvent, within } from "storybook/test";

import { createVaultCache } from "../../graphql/cache";
import { VaultInvalidationController } from "../../graphql/invalidation";
import { VaultGraphQLContext } from "../../graphql/provider";

import { ColorSchemesPage } from "./ColorSchemesPage";

const paint = (id: string, name: string) => ({
  __typename: "Paint",
  id,
  name,
  brand: "Example",
  range: "Base",
  colorHex: "#884422",
  sourceUrl: null,
  isCustom: false,
  sourceName: null,
  sourceLogoUrl: null,
  inventory: null,
  available: false,
  hasActiveSubstitution: false,
  brokenReason: null,
  missingStock: true,
  brokenSubstitution: false,
  activeSubstitution: null,
});
const paints = [paint("target-a", "Copper base"), paint("target-b", "Bronze highlight")];
const scheme = (index: number, seq: number) => ({
  __typename: "MiniatureScheme",
  id: `scheme-${index}`,
  name: `Bronze armor ${String(index).padStart(2, "0")}`,
  category: "BROWN",
  isSystem: true,
  sourceName: "Example source",
  sourceId: "source",
  sourceLogoUrl: null,
  paintCount: 2,
  availableCount: seq > 1 ? 2 : 1,
  previewSwatches: [{ paintId: "target-a", colorHex: "#884422" }],
  previewSwatchesTruncated: false,
  imageUrl: null,
  gradient: "linear-gradient(135deg, #884422 0%, #aabbcc 100%)",
  paintNames: "Copper base · Bronze highlight",
  previewMoreCount: 0,
  usageCount: 2,
});
function PageConnection({
  children,
  empty = false,
  fail = false,
  delay = 0,
}: {
  children: ReactNode;
  empty?: boolean;
  fail?: boolean;
  delay?: number;
}) {
  const [scope] = useState(() => {
    let seq = 1;
    let failRead = fail;
    const controller = new VaultInvalidationController();
    const client = new ApolloClient({
      cache: createVaultCache(),
      link: new ApolloLink(
        (operation) =>
          new Observable((observer) => {
            const respond = () => {
              const revision = { epoch: "schemes-page-story", seq: String(seq) };
              if (operation.operationName === "SchemeUsedPaintOptions") {
                const query = String(operation.variables.search).toLowerCase();
                const excluded = operation.variables.excludeIds as string[];
                observer.next({
                  data: {
                    schemePaintOptions: {
                      revision,
                      items: paints.filter(
                        (item) => !excluded.includes(item.id) && item.name.toLowerCase().includes(query),
                      ),
                    },
                  },
                });
              } else if (operation.operationName === "SchemesPage") {
                if (failRead) {
                  failRead = false;
                  observer.error(new Error("Scheme connection interrupted"));
                  return;
                }
                const ids = operation.variables.usesPaintIds as string[];
                const search = String(operation.variables.search ?? "");
                const filtered =
                  !!search ||
                  ids.length > 0 ||
                  operation.variables.readiness === "READY" ||
                  operation.variables.noSource;
                const totalCount = empty ? 0 : filtered ? 1 : 49;
                const start = operation.variables.after ? 48 : 0;
                const nodes = Array.from(
                  { length: Math.max(0, Math.min(totalCount - start, 48)) },
                  (_, offset) => scheme(start + offset, seq),
                );
                observer.next({
                  data: {
                    schemes: {
                      revision,
                      nodes,
                      totalCount,
                      pageInfo: {
                        hasNextPage: !filtered && !empty && start === 0,
                        endCursor: start === 0 && !filtered && !empty ? "next" : null,
                      },
                      facets: {
                        categories: [{ key: "BROWN", label: "Brown", count: empty ? 0 : 49 }],
                        sources: [
                          { key: "source", label: "Example source", count: empty ? 0 : 49 },
                          { key: "", label: "Not from a plugin", count: 0 },
                        ],
                        readiness: [
                          { key: "ALL", label: "All", count: empty ? 0 : 49 },
                          { key: "READY", label: "Ready to paint", count: 1 },
                          { key: "MISSING", label: "Missing paints", count: 48 },
                        ],
                      },
                    },
                  },
                });
              } else {
                observer.error(new Error(`Unexpected operation ${operation.operationName}`));
                return;
              }
              observer.complete();
            };
            if (delay) {
              const timer = setTimeout(respond, delay);
              return () => clearTimeout(timer);
            }
            respond();
            return undefined;
          }),
      ),
    });
    return {
      client,
      controller,
      dispose() {
        controller.dispose();
        client.stop();
      },
      refresh() {
        seq++;
        controller.committed({ epoch: "schemes-page-story", seq: String(seq) }, [
          "SCHEMES",
          "PAINT",
          "MINIATURES",
        ]);
      },
    };
  });
  return (
    <VaultGraphQLContext.Provider value={scope}>
      <Button onClick={scope.refresh}>Simulate stock update</Button>
      {children}
    </VaultGraphQLContext.Provider>
  );
}
const meta = {
  title: "Schemes/Apollo page",
  component: ColorSchemesPage,
  decorators: [
    (Story, context) => (
      <PageConnection delay={context.parameters.queryDelay ?? 0}>
        <Story />
      </PageConnection>
    ),
  ],
} satisfies Meta<typeof ColorSchemesPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CardsAndLoadedWindowRefresh: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByText("Bronze armor 00")).toBeInTheDocument();
    await expect(canvas.getAllByText(/Used by 2 miniatures/).length).toBeGreaterThan(0);
    await expect(canvas.getAllByText("Copper base · Bronze highlight").length).toBeGreaterThan(0);
    await userEvent.click(canvas.getByRole("button", { name: "Load more schemes" }));
    await expect(canvas.queryByRole("button", { name: "Load more schemes" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Simulate stock update" }));
    await expect(await canvas.findAllByText("Every paint available")).not.toHaveLength(0);
    await userEvent.click(canvas.getByRole("combobox", { name: "Status" }));
    await userEvent.click(
      within(canvasElement.ownerDocument.body).getByRole("option", { name: "Ready to paint (1)" }),
    );
    await expect(await canvas.findByText("Bronze armor 00")).toBeInTheDocument();
  },
};
export const UsesPaintsRetainsSelectedValues: Story = {
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByText("Bronze armor 00");
    const input = canvas.getByRole("combobox", { name: "Uses paints" });
    await userEvent.click(input);
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("option", { name: /Copper base/ }),
    );
    await expect(canvas.getByText("Copper base", { selector: ".MuiChip-label" })).toBeInTheDocument();
    await userEvent.type(input, "Bronze");
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("option", { name: /Bronze highlight/ }),
    );
    await expect(canvas.getByText("Copper base", { selector: ".MuiChip-label" })).toBeInTheDocument();
    await expect(canvas.getByText("Bronze highlight", { selector: ".MuiChip-label" })).toBeInTheDocument();
  },
};
export const EmptyCollection: Story = {
  decorators: [
    (Story) => (
      <PageConnection empty>
        <Story />
      </PageConnection>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("No color schemes yet")).toBeInTheDocument();
  },
};
export const ReadFailureRetry: Story = {
  decorators: [
    (Story) => (
      <PageConnection fail>
        <Story />
      </PageConnection>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Scheme connection interrupted")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(await canvas.findByText("Bronze armor 00")).toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: { queryDelay: 750 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("status")).toHaveAttribute("aria-live", "polite");
    const skeletons = canvasElement.querySelectorAll("[data-skeleton]");
    await expect(skeletons).toHaveLength(1);
    await expect(skeletons[0]).toHaveAttribute("data-skeleton", "schemes");
    await expect(skeletons[0]).toHaveAttribute("aria-busy", "true");
    await expect(canvas.queryByPlaceholderText("Search schemes…")).not.toBeInTheDocument();
    await expect(await canvas.findByRole("button", { name: /Bronze armor 00/ })).toBeVisible();
    await expect(canvasElement.querySelector("[data-skeleton]")).not.toBeInTheDocument();
  },
};
