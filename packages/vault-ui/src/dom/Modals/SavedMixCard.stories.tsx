import { isPaintAvailable } from "@paint-vault/core/paint-substitutions";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";

import { column } from "../storybook/decorators";
import { paints, vault } from "../storybook/fixtures";

import { SavedMixCard } from "./SavedMixCard";

const mix = vault.paintSubstitutions[0];
const meta = {
  title: "Modals/SavedMixCard",
  component: SavedMixCard,
  args: { mix, onToggleDefault: fn(), onDelete: fn() },
  decorators: [column(720)],
} satisfies Meta<typeof SavedMixCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const BrokenNonDefault: Story = {
  args: { mix: { ...mix, isDefault: false } },
  parameters: {
    vault: { ...vault, paintSubstitutions: [{ ...mix, isDefault: false }], paintSubstitutionIngredients: [] },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Broken substitution: empty recipe.");
    await expect(canvas.getByRole("alert")).toHaveClass("MuiAlert-colorError");
    await expect(
      isPaintAvailable(
        { ...vault, paintSubstitutions: [{ ...mix, isDefault: false }], paintSubstitutionIngredients: [] },
        { ...vault.paintRecords, [paints.royalBlue.id]: { state: "OWNED", stockLevel: "FULL", quantity: 1 } },
        paints.royalBlue.id,
      ),
    ).toBe(true);
    await expect(canvas.getByRole("button", { name: "Make default" })).toBeEnabled();
  },
};

export const CircularRecipe: Story = {
  parameters: {
    vault: {
      ...vault,
      paintSubstitutions: [
        ...vault.paintSubstitutions,
        { id: "sky-cycle", targetPaintId: paints.skyBlue.id, name: "Blue cycle", isDefault: true },
      ],
      paintSubstitutionIngredients: [
        { substitutionId: mix.id, paintId: paints.skyBlue.id, parts: 1, sortOrder: 0 },
        { substitutionId: "sky-cycle", paintId: paints.royalBlue.id, parts: 1, sortOrder: 0 },
      ],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Broken substitution: circular recipe.");
    await expect(canvas.getByRole("alert")).toHaveClass("MuiAlert-colorError");
  },
};
