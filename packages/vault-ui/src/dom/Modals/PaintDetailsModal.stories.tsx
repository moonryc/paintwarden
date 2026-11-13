import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";

import { paints, vault } from "../storybook/fixtures";

import { PaintDetailsModal } from "./PaintDetailsModal";

const meta = {
  title: "Dialogs/PaintDetailsModal",
  component: PaintDetailsModal,
  args: { paint: paints.royalBlue, onClose: fn(), openMini: fn(), onEdit: fn() },
  parameters: { docs: { story: { inline: false, iframeHeight: 640 } } },
} satisfies Meta<typeof PaintDetailsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const BrokenSubstitution: Story = {
  parameters: {
    vault: {
      ...vault,
      paintSubstitutionIngredients: [],
      paintRecords: {
        ...vault.paintRecords,
        [paints.royalBlue.id]: { state: "OWNED", stockLevel: "FULL", quantity: 2 },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const alert = page.getByRole("alert");
    const button = page.getByRole("button", { name: "Paint substitutions (1)" });
    await expect(alert).toHaveTextContent("Broken substitution: empty recipe.");
    await expect(alert).toHaveClass("MuiAlert-colorError");
    await expect(alert.nextElementSibling).toContainElement(button);
    await expect(page.getByRole("textbox", { name: `${paints.royalBlue.name} quantity` })).toHaveValue("2");
    await expect(page.getByRole("button", { name: "Paint substitutions (1)" })).toBeEnabled();
  },
};

export const CircularRecipeOriginalOwned: Story = {
  parameters: {
    vault: {
      ...vault,
      paintRecords: {
        ...vault.paintRecords,
        [paints.royalBlue.id]: { state: "OWNED", stockLevel: "FULL", quantity: 1 },
      },
      paintSubstitutions: [
        ...vault.paintSubstitutions,
        { id: "sky-cycle", targetPaintId: paints.skyBlue.id, name: "Blue cycle", isDefault: true },
      ],
      paintSubstitutionIngredients: [
        {
          substitutionId: vault.paintSubstitutions[0].id,
          paintId: paints.skyBlue.id,
          parts: 1,
          sortOrder: 0,
        },
        { substitutionId: "sky-cycle", paintId: paints.royalBlue.id, parts: 1, sortOrder: 0 },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const alert = page.getByRole("alert");
    await expect(alert).toHaveTextContent("Broken substitution: circular recipe.");
    await expect(alert).toHaveClass("MuiAlert-colorError");
    await expect(alert.nextElementSibling).toContainElement(
      page.getByRole("button", { name: "Paint substitutions (1)" }),
    );
    await expect(page.queryByText(/Available through/)).not.toBeInTheDocument();
  },
};

export const InactiveBrokenRecipe: Story = {
  parameters: {
    vault: {
      ...vault,
      paintSubstitutions: vault.paintSubstitutions.map((mix) => ({ ...mix, isDefault: false })),
      paintSubstitutionIngredients: [],
    },
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(page.queryByRole("alert")).not.toBeInTheDocument();
    await expect(page.getByRole("button", { name: "Paint substitutions (1)" })).toBeEnabled();
  },
};
