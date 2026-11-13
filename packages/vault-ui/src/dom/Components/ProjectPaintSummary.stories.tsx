import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { column } from "../storybook/decorators";
import { paints } from "../storybook/fixtures";

import { ProjectPaintSummary } from "./ProjectPaintSummary";

const required = [paints.black, paints.crimson, paints.scarlet, paints.gold, paints.blackWash];

const meta = {
  title: "Components/ProjectPaintSummary",
  component: ProjectPaintSummary,
  args: {
    required,
    // Scarlet Layer is already on the wishlist in the sample vault.
    missing: [paints.scarlet, paints.gold, paints.blackWash],
    onOpenPaint: fn(),
    onAddAllToWishlist: fn(),
  },
  decorators: [column(720)],
} satisfies Meta<typeof ProjectPaintSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PaintsToGather: Story = {};

export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { expanded: false }));
    await expect(await within(canvasElement).findByText("On your wishlist")).toBeVisible();
  },
};

export const PaletteReady: Story = { args: { missing: [] } };

// Renders nothing for a miniature without a recipe.
export const NoRecipe: Story = { args: { required: [], missing: [] } };
