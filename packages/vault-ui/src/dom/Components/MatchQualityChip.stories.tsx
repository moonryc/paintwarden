import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { MatchQualityChip } from "./MatchQualityChip";

const meta = {
  title: "Components/MatchQualityChip",
  component: MatchQualityChip,
  args: { deltaE: 1.24 },
} satisfies Meta<typeof MatchQualityChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NearExact: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Near-exact · ΔE 1.2")).toBeInTheDocument();
  },
};

export const VeryClose: Story = { args: { deltaE: 4.4 } };

export const Similar: Story = { args: { deltaE: 8.75 } };

export const Loose: Story = {
  args: { deltaE: 31.37 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Loose match · ΔE 31.4")).toBeInTheDocument();
  },
};
