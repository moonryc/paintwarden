import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { list } from "../storybook/decorators";
import { paints } from "../storybook/fixtures";

import { WishlistPaintRow } from "./WishlistPaintRow";

const meta = {
  title: "Components/WishlistPaintRow",
  component: WishlistPaintRow,
  args: {
    paint: paints.gold,
    restock: false,
    onBought: fn(),
    onQuantityChange: fn(),
    onRemove: fn(),
    onOpenPaint: fn(),
  },
  decorators: [list()],
} satisfies Meta<typeof WishlistPaintRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ToBuy: Story = {};

export const Restock: Story = { args: { paint: paints.boneWhite, restock: true } };

// Just bought: the row stays with a quantity counter until the list is left.
export const Bought: Story = { args: { quantity: 2 } };

export const BrokenSubstitution: Story = {
  args: { reasons: ["missingStock", "brokenSubstitution"], onFix: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Broken substitution")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: `Fix substitution for ${args.paint.name}` }));
    await expect(args.onFix).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: `Mark ${args.paint.name} as bought` }));
    await expect(args.onBought).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: `Remove ${args.paint.name} from wishlist` }));
    await expect(args.onRemove).toHaveBeenCalled();
  },
};

export const BoughtWithBrokenSubstitution: Story = {
  args: { quantity: 2, reasons: ["brokenSubstitution"], onFix: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Broken substitution")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: `Fix substitution for ${args.paint.name}` }));
    await expect(args.onFix).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: `Increase ${args.paint.name} quantity` }));
    await expect(args.onQuantityChange).toHaveBeenCalledWith(3);
    await expect(canvas.queryByRole("button", { name: `Mark ${args.paint.name} as bought` })).toBeNull();
  },
};

export const CircularProjectCount: Story = {
  args: { projectCount: 1234, onProjects: fn() },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button", { name: "99+ · Used in 1,234 projects" });
    await expect(button).toHaveTextContent("99+");
    const bought = within(canvasElement).getByRole("button", { name: `Mark ${args.paint.name} as bought` });
    const b = button.getBoundingClientRect();
    const a = bought.getBoundingClientRect();
    await expect(b.width).toBe(a.width);
    await expect(b.height).toBe(a.height);
    await expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth);
    await userEvent.click(button);
    await expect(args.onProjects).toHaveBeenCalledOnce();
  },
};
