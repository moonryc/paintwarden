import type { Meta, StoryObj } from "@storybook/react-vite";

import { ColorMatchSwatch } from "./ColorMatchSwatch";

const meta = {
  title: "Components/ColorMatchSwatch",
  component: ColorMatchSwatch,
  args: { target: "#D9B72B", paint: "#E1C03A" },
} satisfies Meta<typeof ColorMatchSwatch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CloseMatch: Story = {};

export const DistantMatch: Story = { args: { target: "#D9B72B", paint: "#2266AA" } };

export const Large: Story = { args: { size: 72 } };

export const TargetOnly: Story = { args: { paint: null } };
