import { Box } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";

import { NavPanel } from "./NavPanel";

const meta = {
  title: "Layout/NavPanel",
  component: NavPanel,
  args: {
    tab: "dashboard",
    go: fn(),
    counts: {},
    displayName: "Sample owner",
    onAddMiniature: fn(),
    onAddPaint: fn(),
    onAddScheme: fn(),
    onAccount: fn(),
  },
  decorators: [
    (Story) => (
      <Box component="main" sx={{ width: 280 }}>
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof NavPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

const noQuickAdd: Story["play"] = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(canvas.queryByRole("group", { name: "Add to vault" })).not.toBeInTheDocument();
  await expect(canvas.queryByRole("button", { name: "Miniature" })).not.toBeInTheDocument();
};
export const WorkbenchUsesPageAdd: Story = { play: noQuickAdd };
export const MiniaturesUsesPageAdd: Story = { args: { tab: "miniatures" }, play: noQuickAdd };
export const TemplatesUsesPageAdd: Story = { args: { tab: "templates" }, play: noQuickAdd };
export const OtherPagesKeepQuickAdd: Story = {
  args: { tab: "paints" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "Miniature" })).toBeInTheDocument();
  },
};
