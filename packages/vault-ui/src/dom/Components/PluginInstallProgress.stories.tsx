import { Box } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { PluginInstallProgress } from "./PluginInstallProgress";

const meta = {
  title: "Components/PluginInstallProgress",
  component: PluginInstallProgress,
  args: {
    job: { id: "install-1", stage: "READING", done: 2, total: 10, percent: 20, cancellable: true },
    onCancel: fn(),
  },
  parameters: { a11y: { test: "error" } },
} satisfies Meta<typeof PluginInstallProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reading: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const progress = canvas.getByRole("progressbar");
    await expect(progress).toHaveAccessibleName();
    await expect(progress).toHaveAttribute("aria-valuenow", "20");
    await expect(canvas.getByRole("status")).toHaveAttribute("aria-live", "polite");
    await expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
  },
};
export const Checking: Story = {
  args: { job: { ...meta.args.job, stage: "CHECKING", percent: 30 } },
};
export const Images: Story = {
  args: { job: { ...meta.args.job, stage: "IMAGES", percent: 50 } },
};
export const Preparing: Story = {
  args: { job: { ...meta.args.job, stage: "PREPARING", percent: 75 } },
};
export const Committing: Story = {
  // Even a stale caller flag must not allow cancellation during commit.
  args: { job: { ...meta.args.job, stage: "COMMITTING", percent: 95 } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button")).not.toBeInTheDocument();
  },
};
export const Succeeded: Story = {
  args: { job: { ...meta.args.job, stage: "SUCCEEDED", done: 10, percent: 120 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};
export const Failed: Story = {
  args: {
    job: {
      ...meta.args.job,
      stage: "FAILED",
      error: "The source could not be read. Please try again. <source>",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("The source could not be read. Please try again. <source>")).toBeVisible();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
    await expect(canvasElement.querySelector("source")).toBeNull();
  },
};
export const Cancelled: Story = {
  args: { job: { ...meta.args.job, stage: "CANCELLED", percent: -10 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};
export const Cancellation: Story = {
  render: function CancellationExample(args) {
    const [cancelling, setCancelling] = useState(false);
    return (
      <PluginInstallProgress
        {...args}
        cancelling={cancelling}
        onCancel={() => {
          args.onCancel();
          setCancelling(true);
        }}
      />
    );
  },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button");
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
    await expect(button).toBeDisabled();
  },
};
export const CompactPhone: Story = {
  args: { compact: true, job: { ...meta.args.job, stage: "IMAGES" } },
  render: (args) => (
    <Box sx={{ width: 272, maxWidth: "100%" }}>
      <PluginInstallProgress {...args} />
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement).getByRole("region");
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
  },
};

export const ReadingUnknownTotal: Story = {
  args: { job: { ...meta.args.job, done: 0, total: 0, percent: 0 } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  },
};
export const CheckingUnknownTotal: Story = {
  ...ReadingUnknownTotal,
  args: { job: { ...meta.args.job, stage: "CHECKING", done: 0, total: 0, percent: 5 } },
};
export const FailedUnknownTotal: Story = {
  args: { job: { ...meta.args.job, stage: "FAILED", done: 0, total: 0, percent: 0 } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  },
};
