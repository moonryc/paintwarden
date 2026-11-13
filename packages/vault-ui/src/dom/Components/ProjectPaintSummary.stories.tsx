import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { column } from "../storybook/decorators";
import { miniatures, paints, requirements, vault } from "../storybook/fixtures";

import { ProjectPaintSummary, ProjectPaintSummaryView } from "./ProjectPaintSummary";

const required = [paints.black, paints.crimson, paints.scarlet, paints.gold, paints.blackWash];

const meta = {
  title: "Components/ProjectPaintSummary",
  component: ProjectPaintSummaryView,
  args: {
    required,
    paintStates: vault.paintStates,
    onSetPaintState: fn(),
    // Scarlet Layer is already on the wishlist in the sample vault.
    missing: [paints.scarlet, paints.gold, paints.blackWash],
    onOpenPaint: fn(),
    onAddAllToWishlist: fn(),
  },
  decorators: [column(720)],
} satisfies Meta<typeof ProjectPaintSummaryView>;

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

// An empty active default remains broken even when the original bottle is on hand.
export const OwnedButBroken: Story = {
  args: {
    miniatureId: miniatures.knight.id,
    paintStates: { ...vault.paintStates, [paints.royalBlue.id]: "OWNED" },
    issues: new Map([[paints.royalBlue.id, new Set(["brokenSubstitution" as const])]]),
    required: [paints.royalBlue],
    missing: [paints.royalBlue],
  },
  parameters: {
    vault: {
      ...vault,
      requirements: [requirements.royalBlue],
      miniatureColorSchemes: [],
      paintStates: { ...vault.paintStates, [paints.royalBlue.id]: "OWNED" },
      paintRecords: {
        ...vault.paintRecords,
        [paints.royalBlue.id]: { state: "OWNED", stockLevel: "FULL", quantity: 1 },
      },
      paintSubstitutionIngredients: [],
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("Palette ready — go paint!")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { expanded: false }));
    await expect(canvas.getByText("Broken substitution")).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: `Add ${paints.royalBlue.name} to wishlist` }),
    ).toBeNull();
    await expect(canvas.getByRole("button", { name: "Wishlist all" })).toBeDisabled();
    await userEvent.click(
      canvas.getByRole("button", { name: `Fix substitution for ${paints.royalBlue.name}` }),
    );
    const dialog = await within(document.body).findByRole("dialog", {
      name: `Substitute ${paints.royalBlue.name}`,
    });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(args.onAddAllToWishlist).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).toBeNull());
  },
};

export const WishlistAction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { expanded: false }));
    await userEvent.click(canvas.getByRole("button", { name: `Add ${paints.gold.name} to wishlist` }));
    await expect(args.onSetPaintState).toHaveBeenCalledWith(paints.gold.id, "WISHLIST");
    await userEvent.click(
      canvas.getByRole("button", { name: `Remove ${paints.scarlet.name} from wishlist` }),
    );
    await expect(args.onSetPaintState).toHaveBeenCalledWith(paints.scarlet.id, null);
    await userEvent.click(canvas.getByRole("button", { name: "Wishlist all" }));
    await expect(args.onAddAllToWishlist).toHaveBeenCalledWith([paints.gold, paints.blackWash]);
  },
};

export const LegacyWrapper: Story = { render: (args) => <ProjectPaintSummary {...args} /> };
