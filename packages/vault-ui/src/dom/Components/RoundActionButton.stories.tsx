import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Check, Heart, X } from "../icons";

import { RoundActionButton } from "./RoundActionButton";

const meta = {
  title: "Components/RoundActionButton",
  component: RoundActionButton,
  args: {
    label: "Add Crimson Base to wishlist",
    title: "Add to wishlist",
    tone: "wishlist",
    onClick: fn(),
    children: <Heart size={15} />,
  },
  argTypes: {
    tone: { control: "inline-radio", options: ["rust", "ok", "wishlist"] },
    children: { control: false },
  },
} satisfies Meta<typeof RoundActionButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Wishlist: Story = {};

export const WishlistActive: Story = {
  args: { active: true, children: <Heart size={15} fill="currentColor" /> },
};

export const Owned: Story = {
  args: {
    tone: "ok",
    label: "Mark Crimson Base as owned",
    title: "Mark as owned",
    children: <Check size={15} />,
  },
};

export const Remove: Story = {
  args: { tone: "rust", label: "Remove Crimson Base", title: "Remove", children: <X size={15} /> },
};

export const Disabled: Story = { args: { tone: "ok", disabled: true, children: <Check size={15} /> } };

export const Medium: Story = { args: { size: "md" } };
