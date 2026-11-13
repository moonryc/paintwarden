import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { column } from "../storybook/decorators";

import { ModalHeader } from "./ModalHeader";
import { PluginChip } from "./PluginChip";

const meta = {
  title: "Components/ModalHeader",
  component: ModalHeader,
  args: { title: "Edit miniature", subtitle: "Crimson Knight Captain", onClose: fn() },
  decorators: [column(560)],
} satisfies Meta<typeof ModalHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Medium: Story = { args: { size: "md" } };

export const WithBadge: Story = {
  args: {
    title: "Crimson armour",
    subtitle: "Color scheme",
    badge: <PluginChip name="Example paint source" />,
  },
};

export const TitleOnly: Story = { args: { subtitle: undefined } };
