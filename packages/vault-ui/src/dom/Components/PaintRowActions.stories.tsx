import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { PaintRowActions } from "./PaintRowActions";

const wishlist = { label: "Add Crimson Base to wishlist", title: "Add to wishlist", onClick: fn() };
const add = { label: "Mark Crimson Base as owned", title: "Mark as owned", onClick: fn() };

const meta = {
  title: "Components/PaintRowActions",
  component: PaintRowActions,
} satisfies Meta<typeof PaintRowActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WishlistAndAdd: Story = { args: { wishlist, add } };

export const Wishlisted: Story = {
  args: {
    wishlist: {
      ...wishlist,
      active: true,
      label: "Remove Crimson Base from wishlist",
      title: "Remove from wishlist",
    },
  },
};

export const AddDisabled: Story = {
  args: { add: { ...add, disabled: true, title: "Unavailable through Teal Mix" } },
};

export const QuantityAndRemove: Story = {
  args: {
    quantity: { paintName: "Crimson Base", value: 2, onChange: fn() },
    remove: { label: "Set Crimson Base quantity to 0", title: "Remove from paint library", onClick: fn() },
  },
};

// Controls appear only when they're passed.
export const NoActions: Story = { args: {} };
