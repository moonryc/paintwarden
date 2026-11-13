import type { Operation } from "@apollo/client";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, waitFor, within } from "storybook/test";

import { paints, vault } from "../storybook/fixtures";
import { StoryGraphQL } from "../storybook/graphql";

import { PaintDetailsModal } from "./PaintDetailsModal";

const meta = {
  title: "Dialogs/PaintDetailsModal",
  component: PaintDetailsModal,
  args: { paint: paints.royalBlue, onClose: fn(), openMini: fn(), onEdit: fn() },
  parameters: { docs: { story: { inline: false, iframeHeight: 640 } } },
} satisfies Meta<typeof PaintDetailsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

function detailsResponse(reason: "EMPTY" | "CYCLE") {
  let quantity = 2;
  let seq = 1;
  return (operation: Operation): Record<string, unknown> => {
    const paint = {
      __typename: "Paint",
      ...paints.royalBlue,
      isCustom: true,
      sourceName: null,
      sourceLogoUrl: null,
      inventory: { __typename: "Inventory", state: "OWNED", stockLevel: "FULL", quantity },
      available: false,
      hasActiveSubstitution: true,
      brokenReason: reason,
      missingStock: false,
      brokenSubstitution: true,
      activeSubstitution: { id: "broken", name: "Broken server recipe" },
    };
    if (operation.operationName === "SetPaintStock") {
      quantity = operation.variables.quantity as number;
      seq += 1;
      return {
        setPaintStock: {
          revision: { epoch: "story", seq: String(seq) },
          paint: { ...paint, inventory: { ...paint.inventory, quantity } },
          clientMutationId: operation.variables.clientMutationId as string,
          invalidatedFamilies: ["PAINT", "LIBRARY", "OPTIONS"],
        },
      };
    }
    const later = !!operation.variables.usedByAfter;
    return {
      paint: {
        revision: { epoch: "story", seq: String(seq) },
        paint,
        substitutions: { nodes: [], totalCount: 1, pageInfo: { hasNextPage: false, endCursor: null } },
        usedBy: {
          nodes: [
            {
              id: later ? "second-project" : "first-project",
              title: later ? "Second server project" : "First server project",
            },
          ],
          totalCount: 2,
          pageInfo: { hasNextPage: !later, endCursor: later ? null : "next" },
        },
      },
    };
  };
}

export const ApolloBrokenEmpty: Story = {
  decorators: [
    (Story) => (
      <StoryGraphQL respond={detailsResponse("EMPTY")}>
        <Story />
      </StoryGraphQL>
    ),
  ],
  parameters: {
    vault: {
      ...vault,
      catalog: [],
      paintSubstitutions: [],
      paintSubstitutionIngredients: [],
      paintRecords: {},
      miniatures: [],
    },
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByRole("alert")).toHaveTextContent("Broken substitution: empty recipe.");
    await expect(page.getByRole("alert")).toHaveClass("MuiAlert-colorError");
    await expect(page.getByRole("alert").nextElementSibling).toContainElement(
      page.getByRole("button", { name: "Paint substitutions (1)" }),
    );
    await expect(page.getByRole("textbox", { name: `${paints.royalBlue.name} quantity` })).toHaveValue("2");
    await userEvent.click(page.getByRole("button", { name: `Increase ${paints.royalBlue.name} quantity` }));
    await waitFor(() =>
      expect(page.getByRole("textbox", { name: `${paints.royalBlue.name} quantity` })).toHaveValue("3"),
    );
    await userEvent.click(page.getByRole("button", { name: "Load more projects" }));
    await expect(await page.findByRole("button", { name: "Second server project" })).toBeVisible();
    await expect(page.getByRole("button", { name: "First server project" })).toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "Second server project" }));
    await expect(args.openMini).toHaveBeenCalledWith("second-project");
    await userEvent.click(page.getByRole("button", { name: "Edit paint" }));
    await expect(args.onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: paints.royalBlue.id, name: paints.royalBlue.name, isCustom: true }),
    );
  },
};

export const ApolloBrokenCycle: Story = {
  decorators: [
    (Story) => (
      <StoryGraphQL respond={detailsResponse("CYCLE")}>
        <Story />
      </StoryGraphQL>
    ),
  ],
  parameters: ApolloBrokenEmpty.parameters,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByRole("alert")).toHaveTextContent("Broken substitution: circular recipe.");
    await expect(page.getByRole("alert")).toHaveClass("MuiAlert-colorError");
    await expect(page.queryByText(/Available through/)).not.toBeInTheDocument();
  },
};
