import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState, type ReactNode } from "react";
import { Observable } from "rxjs";
import { expect, fn, screen, waitFor } from "storybook/test";

import { VaultInvalidationController } from "../graphql/invalidation";
import { VaultGraphQLContext } from "../graphql/provider";
import { paints, vault } from "../storybook/fixtures";

import { SubstitutionDialog } from "./SubstitutionDialog";

const meta = {
  title: "Dialogs/SubstitutionDialog",
  component: SubstitutionDialog,
  args: { paint: paints.royalBlue, onClose: fn() },
  argTypes: { paint: { control: false } },
  parameters: { docs: { story: { inline: false, iframeHeight: 640 } } },
} satisfies Meta<typeof SubstitutionDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// Royal Blue has a saved mix in the sample vault.
export const WithSavedMix: Story = {};

export const NoMixes: Story = { args: { paint: paints.gold } };

export const BuildSubstitution: Story = {
  args: { paint: paints.gold },
  play: async ({ userEvent }) => {
    const save = screen.getByRole("button", { name: "Save substitution" });
    await expect(save).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox", { name: "Recipe name" }), "New two-paint mix");
    const picker = screen.getByRole("combobox", { name: "Ingredient paint" });
    await userEvent.type(picker, paints.skyBlue.name);
    await userEvent.click(
      await screen.findByRole("option", { name: `${paints.skyBlue.name} · ${paints.skyBlue.brand}` }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await expect(screen.getByRole("spinbutton", { name: "Parts" })).toHaveValue(1);
    await expect(save).toBeEnabled();
    await userEvent.clear(screen.getByRole("spinbutton", { name: "Parts" }));
    await userEvent.type(screen.getByRole("spinbutton", { name: "Parts" }), "3");
    await expect(screen.getByRole("spinbutton", { name: "Parts" })).toHaveValue(13);
    await userEvent.click(screen.getByRole("button", { name: `Remove ${paints.skyBlue.name}` }));
    await expect(save).toBeDisabled();
  },
};

const serverPaint = {
  ...paints.skyBlue,
  id: "server-ingredient",
  name: "Server-only ingredient",
  sourceName: null,
  sourceLogoUrl: null,
  inventory: null,
  available: true,
  hasActiveSubstitution: false,
  brokenReason: null,
  missingStock: false,
  brokenSubstitution: false,
  activeSubstitution: null,
};
const extraPaint = { ...serverPaint, id: "extra-ingredient", name: "Extra ingredient" };
const revision = { epoch: "storybook", seq: "1" };
const pageInfo = (hasNextPage = false) => ({ hasNextPage, endCursor: hasNextPage ? "next" : null });
const ingredientsPage = (complete: boolean) => ({
  nodes: [
    { paint: serverPaint, parts: 2, sortOrder: 0 },
    ...(complete ? [{ paint: extraPaint, parts: 1, sortOrder: 1 }] : []),
  ],
  totalCount: 2,
  pageInfo: pageInfo(!complete),
});

function ApolloFixture({ children, failFirst = false }: { children: ReactNode; failFirst?: boolean }) {
  const [failure] = useState(() => ({ remaining: failFirst ? 1 : 0 }));
  const [scope] = useState(() => ({
    controller: new VaultInvalidationController(),
    client: new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink(
        (operation) =>
          new Observable((observer) => {
            if (failure.remaining > 0 && operation.operationName === "PaintDetails") {
              failure.remaining -= 1;
              observer.error(new Error("Could not load saved substitutions"));
              return;
            }
            const laterPage = !!operation.variables.substitutionsAfter;
            const mix = {
              id: laterPage ? "late-default" : "server-mix",
              targetPaintId: paints.royalBlue.id,
              name: laterPage ? "Late default mix" : "Server mix",
              isDefault: laterPage,
              available: true,
              brokenReason: null,
              ingredients: ingredientsPage(false),
            };
            let data;
            if (operation.operationName === "PaintPickerOptions") {
              const excludes = operation.variables.excludeIds as string[];
              data = {
                paintOptions: { revision, items: excludes.includes(serverPaint.id) ? [] : [serverPaint] },
              };
            } else if (operation.operationName === "PaintSubstitutionIngredients") {
              data = {
                substitution: {
                  revision,
                  substitution: {
                    id: String(operation.variables.id),
                    ingredients: {
                      nodes: [{ paint: extraPaint, parts: 1, sortOrder: 1 }],
                      totalCount: 2,
                      pageInfo: pageInfo(),
                    },
                  },
                },
              };
            } else {
              data = {
                paint: {
                  revision,
                  paint: {
                    ...serverPaint,
                    ...paints.royalBlue,
                    activeSubstitution: { id: "late-default", name: "Late default mix" },
                  },
                  substitutions: { nodes: [mix], totalCount: 2, pageInfo: pageInfo(!laterPage) },
                  usedBy: { nodes: [], totalCount: 0, pageInfo: pageInfo() },
                },
              };
            }
            observer.next({ data });
            observer.complete();
          }),
      ),
    }),
  }));
  useEffect(
    () => () => {
      scope.client.stop();
      scope.controller.dispose();
    },
    [scope],
  );
  return <VaultGraphQLContext.Provider value={scope}>{children}</VaultGraphQLContext.Provider>;
}

export const ApolloServerData: Story = {
  decorators: [
    (Story) => (
      <ApolloFixture>
        <Story />
      </ApolloFixture>
    ),
  ],
  parameters: { vault: { ...vault, catalog: [], paintSubstitutions: [], paintSubstitutionIngredients: [] } },
  play: async ({ userEvent }) => {
    await waitFor(() => expect(screen.getByText("Server mix")).toBeVisible());
    // The original default action remains enabled even when the active mix is on a later page.
    await expect(screen.getAllByRole("button", { name: "Make default" })[0]).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Load more ingredients" }));
    await expect(await screen.findByText("2× Server-only ingredient + 1× Extra ingredient")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Load more substitutions" }));
    await expect(await screen.findByText("Late default mix")).toBeVisible();
    await expect(screen.queryByRole("button", { name: "Load more substitutions" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Recipe name" }), "New server mix");
    await userEvent.type(screen.getByRole("combobox", { name: "Ingredient paint" }), "Server");
    await userEvent.click(
      await screen.findByRole("option", { name: `${serverPaint.name} · ${serverPaint.brand}` }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    // Selected paints remain local after the server excludes them from the next options result.
    await expect(screen.getByRole("button", { name: `Remove ${serverPaint.name}` })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Save substitution" }));
    await expect(screen.getByRole("textbox", { name: "Recipe name" })).toHaveValue("");
    await expect(
      screen.queryByRole("button", { name: `Remove ${serverPaint.name}` }),
    ).not.toBeInTheDocument();
  },
};

export const ApolloRetry: Story = {
  decorators: [
    (Story) => (
      <ApolloFixture failFirst>
        <Story />
      </ApolloFixture>
    ),
  ],
  play: async ({ userEvent }) => {
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Could not load saved substitutions"),
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("Server mix")).toBeVisible());
    await expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  },
};
