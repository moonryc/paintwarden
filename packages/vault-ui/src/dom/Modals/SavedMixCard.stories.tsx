import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";

import { column } from "../storybook/decorators";
import { vault } from "../storybook/fixtures";

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
    await expect(canvas.getByRole("alert")).toHaveTextContent("Broken substitution");
    await expect(canvas.getByRole("button", { name: "Make default" })).toBeEnabled();
  },
};
