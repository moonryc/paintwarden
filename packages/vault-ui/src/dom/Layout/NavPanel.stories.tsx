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
    onAccount: fn(),
  },
  decorators: [
    (Story) => (
      <Box component="main" sx={{ width: 264, maxWidth: "100%" }}>
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof NavPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

// Adding happens on each page (add tiles, Add paint, New scheme), so the sidebar has no add button.
const noQuickAdd: Story["play"] = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const tools = canvas.getByRole("button", { name: "Paint Tools Beta", exact: true });
  await expect(tools.querySelectorAll(".MuiChip-root")).toHaveLength(1);
  await expect(tools.scrollWidth).toBeLessThanOrEqual(tools.clientWidth);
  await expect(canvas.queryByRole("group", { name: "Add to vault" })).not.toBeInTheDocument();
  await expect(canvas.queryByRole("button", { name: "Miniature" })).not.toBeInTheDocument();
};
export const Workbench: Story = { play: noQuickAdd };
export const Paints: Story = { args: { tab: "paints" }, play: noQuickAdd };

export const PhoneDrawer: Story = { args: { tab: "paint-tools", onClose: fn() }, play: noQuickAdd };
