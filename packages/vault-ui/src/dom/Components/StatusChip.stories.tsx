import type { Meta, StoryObj } from "@storybook/react-vite";

import { StatusChip } from "./StatusChip";

const meta = {
  title: "Components/StatusChip",
  component: StatusChip,
  args: { tone: "gold", children: "Restock" },
  argTypes: { tone: { control: "inline-radio", options: ["rust", "ok", "gold", "wishlist", "muted"] } },
} satisfies Meta<typeof StatusChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gold: Story = {};

export const Ok: Story = { args: { tone: "ok", children: "Packed" } };

export const Rust: Story = { args: { tone: "rust", children: "3 missing" } };

export const Muted: Story = { args: { tone: "muted", children: "No recipe" } };

export const Wishlist: Story = { args: { tone: "wishlist", children: "Wishlisted" } };
