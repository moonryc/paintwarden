import { ApolloClient, ApolloLink, Observable } from "@apollo/client";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState, type ReactNode } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { createVaultCache } from "../graphql/cache";
import { VaultInvalidationController } from "../graphql/invalidation";
import { VaultGraphQLContext } from "../graphql/provider";
import { emptyState } from "../utils/constants";

import { ApolloProjectDrawer } from "./ApolloProjectDrawer";

const saved = fn();
const stockSaved = fn();
const project = {
  __typename: "Miniature" as const,
  id: "apollo-project",
  title: "Projected captain",
  status: "WISHLIST",
  paintingStatus: "PRIMED",
  imageUrl: null,
  createdAt: 1234,
  notes: "Keep these project notes",
  manufacturer: "Example maker",
  faction: "Example army",
  scale: "28mm",
};
const paint = (id: string, broken = false) => ({
  __typename: "Paint" as const,
  id,
  brand: "Example",
  range: "Base",
  name: broken ? "Broken owned copper" : "Missing blue",
  colorHex: broken ? "#994422" : "#447799",
  sourceUrl: null,
  isCustom: false,
  sourceName: null,
  sourceLogoUrl: null,
  inventory: broken ? { __typename: "Inventory", state: "OWNED", stockLevel: "FULL", quantity: 1 } : null,
  available: false,
  hasActiveSubstitution: broken,
  brokenReason: broken ? "EMPTY" : null,
  missingStock: !broken,
  brokenSubstitution: broken,
  activeSubstitution: broken ? { id: "broken-mix", name: "Empty copper mix" } : null,
});
const connection = <T,>(nodes: T[]) => ({
  nodes,
  totalCount: nodes.length,
  pageInfo: { hasNextPage: false, endCursor: null },
});

type Mode = "default" | "empty" | "broken" | "loading" | "retry";
function ProjectConnection({ children, mode = "default" }: { children: ReactNode; mode?: Mode }) {
  const [scope] = useState(() => {
    let seq = 1;
    let failed = false;
    let miniature = { ...project };
    let steps = ["BASECOAT"];
    let paints =
      mode === "empty" ? [] : mode === "broken" ? [paint("broken", true), paint("blue")] : [paint("blue")];
    let entries = paints.map((row, index) => ({
      __typename: "MiniatureRecipeEntry",
      id: `entry${index}`,
      paint: row,
      step: "BASECOAT",
      notes: "Recipe note",
      sortOrder: index,
    }));
    const controller = new VaultInvalidationController();
    const client = new ApolloClient({
      cache: createVaultCache(),
      link: new ApolloLink(
        (operation) =>
          new Observable((observer) => {
            if (mode === "loading") return undefined;
            const timer = setTimeout(() => {
              if (operation.operationName === "ProjectMiniatureDetails") {
                if (mode === "retry" && !failed) {
                  failed = true;
                  observer.error(new Error("Project temporarily unavailable"));
                  return;
                }
                observer.next({
                  data: {
                    miniature: {
                      revision: { epoch: "project-story", seq: String(seq) },
                      miniature,
                      recipeSteps: mode === "empty" ? [] : steps,
                      recipe: connection(entries),
                      schemes: connection([]),
                      missing: connection(
                        paints.map((row) => ({
                          id: row.id,
                          paint: row,
                          missingStock: row.missingStock,
                          brokenSubstitution: row.brokenSubstitution,
                        })),
                      ),
                      required: connection(paints),
                    },
                  },
                });
              } else if (
                operation.operationName === "UpdateProjectMiniature" ||
                operation.operationName === "SetProjectRecipe"
              ) {
                saved(operation.operationName, operation.variables);
                if (operation.operationName === "UpdateProjectMiniature")
                  miniature = { ...miniature, ...operation.variables.input };
                else {
                  steps = operation.variables.steps as string[];
                  entries = (
                    operation.variables.entries as Array<{
                      id: string;
                      paintId: string;
                      step: string;
                      notes: string;
                      sortOrder: number;
                    }>
                  ).map((entry) => ({
                    ...entry,
                    __typename: "MiniatureRecipeEntry",
                    paint: paints.find((row) => row.id === entry.paintId)!,
                  }));
                }
                seq++;
                const field =
                  operation.operationName === "UpdateProjectMiniature"
                    ? "updateMiniature"
                    : "setMiniatureRecipe";
                observer.next({
                  data: {
                    [field]: {
                      revision: { epoch: "project-story", seq: String(seq) },
                      miniatureId: project.id,
                      clientMutationId: null,
                      invalidatedFamilies: ["MINIATURES", "HOME"],
                    },
                  },
                });
              } else if (operation.operationName === "SetPaintStock") {
                stockSaved(operation.variables.paintId);
                paints = paints.map((row) =>
                  row.id === operation.variables.paintId
                    ? {
                        ...row,
                        inventory: {
                          __typename: "Inventory",
                          state: "WISHLIST",
                          stockLevel: "FULL",
                          quantity: 0,
                        },
                      }
                    : row,
                );
                seq++;
                observer.next({
                  data: {
                    setPaintStock: {
                      revision: { epoch: "project-story", seq: String(seq) },
                      paint: paints.find((row) => row.id === operation.variables.paintId),
                      clientMutationId: null,
                      invalidatedFamilies: ["PAINT", "MINIATURES"],
                    },
                  },
                });
              } else {
                observer.error(new Error(`Unexpected operation ${operation.operationName}`));
                return;
              }
              observer.complete();
            }, 15);
            return () => clearTimeout(timer);
          }),
      ),
    });
    return { client, controller };
  });
  useEffect(
    () => () => {
      scope.controller.dispose();
      scope.client.stop();
    },
    [scope],
  );
  return <VaultGraphQLContext.Provider value={scope}>{children}</VaultGraphQLContext.Provider>;
}

const meta = {
  title: "Modals/Apollo project drawer",
  component: ApolloProjectDrawer,
  args: { miniatureId: project.id, onClose: fn() },
  parameters: { vault: emptyState },
  beforeEach: () => {
    saved.mockClear();
    stockSaved.mockClear();
  },
} satisfies Meta<typeof ApolloProjectDrawer>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CompleteProjection: Story = {
  render: (args) => (
    <ProjectConnection>
      <ApolloProjectDrawer {...args} />
    </ProjectConnection>
  ),
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await expect(await screen.findByRole("heading", { name: project.title })).toBeVisible();
    await expect(screen.getByText(project.notes)).toBeVisible();
    await expect(screen.getByRole("button", { name: "Close project" })).toBeVisible();
  },
};
export const Loading: Story = {
  render: (args) => (
    <ProjectConnection mode="loading">
      <ApolloProjectDrawer {...args} />
    </ProjectConnection>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement.ownerDocument.body).getByRole("status")).toHaveTextContent(
      "Loading Miniature details",
    );
    const body = canvasElement.ownerDocument.body;
    await expect(body.querySelectorAll("[data-skeleton]")).toHaveLength(1);
    await expect(body.querySelector('[data-skeleton="miniature-detail"]')).toHaveAttribute(
      "aria-busy",
      "true",
    );
  },
};
export const ErrorRetry: Story = {
  render: (args) => (
    <ProjectConnection mode="retry">
      <ApolloProjectDrawer {...args} />
    </ProjectConnection>
  ),
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await expect(await screen.findByRole("alert")).toHaveTextContent("Project temporarily unavailable");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await expect(await screen.findByRole("heading", { name: project.title })).toBeVisible();
  },
};
export const EmptyRecipe: Story = {
  render: (args) => (
    <ProjectConnection mode="empty">
      <ApolloProjectDrawer {...args} />
    </ProjectConnection>
  ),
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await expect(await screen.findByText("No paints assigned yet")).toBeVisible();
    await expect(screen.getByRole("button", { name: "Add a scheme" })).toBeVisible();
    await expect(screen.getByRole("button", { name: "Add a step" })).toBeVisible();
  },
};
export const BrokenAndStockReasons: Story = {
  render: (args) => (
    <ProjectConnection mode="broken">
      <ApolloProjectDrawer {...args} />
    </ProjectConnection>
  ),
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await userEvent.click(await screen.findByRole("button", { name: /2 paints need attention/ }));
    await expect(screen.getByText("Broken substitution", { exact: true })).toBeVisible();
    await expect(
      screen.getByRole("button", { name: "Fix substitution for Broken owned copper" }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Wishlist all" }));
    await waitFor(() => expect(stockSaved).toHaveBeenCalledWith("blue"));
    await expect(stockSaved).not.toHaveBeenCalledWith("broken");
  },
};
export const StagePreservesMetadata: Story = {
  render: (args) => (
    <ProjectConnection>
      <ApolloProjectDrawer {...args} />
    </ProjectConnection>
  ),
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await screen.findByRole("heading", { name: project.title });
    await userEvent.click(await screen.findByRole("tab", { name: /Complete$/ }));
    await waitFor(() =>
      expect(saved).toHaveBeenCalledWith(
        "UpdateProjectMiniature",
        expect.objectContaining({
          input: expect.objectContaining({
            title: project.title,
            notes: project.notes,
            status: project.status,
            manufacturer: project.manufacturer,
            faction: project.faction,
            scale: project.scale,
            paintingStatus: "COMPLETE",
          }),
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /Complete$/ })).toHaveAttribute("aria-current", "step"),
    );
  },
};
export const RecipeStepSave: Story = {
  render: (args) => (
    <ProjectConnection>
      <ApolloProjectDrawer {...args} />
    </ProjectConnection>
  ),
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await userEvent.click(await screen.findByRole("button", { name: "Edit recipe" }));
    await userEvent.click(screen.getByRole("button", { name: "Add a step" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(saved).toHaveBeenCalledWith(
        "SetProjectRecipe",
        expect.objectContaining({
          entries: [{ id: "entry0", paintId: "blue", step: "BASECOAT", notes: "Recipe note", sortOrder: 0 }],
          steps: expect.arrayContaining(["BASECOAT"]),
        }),
      ),
    );
  },
};
