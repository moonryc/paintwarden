import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

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
