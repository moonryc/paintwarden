import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { schemes } from "../storybook/fixtures";

import { SchemeChip } from "./SchemeChip";

const meta = {
  title: "Components/SchemeChip",
  component: SchemeChip,
  args: { scheme: schemes.crimsonArmour },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md"] },
  },
} satisfies Meta<typeof SchemeChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Small: Story = {};

export const Medium: Story = { args: { size: "md", scheme: schemes.oceanCloak } };

export const Removable: Story = { args: { size: "md", onRemove: fn() } };

export const NoPaints: Story = { args: { scheme: schemes.empty } };
