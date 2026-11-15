import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { AppBanner } from "./AppBanner";

const meta = {
  title: "Components/AppBanner",
  component: AppBanner,
  args: {
    children: "Live updates are unavailable. Your loaded work is still available.",
    onRetry: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof AppBanner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Warning: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
    await expect(canvas.getByRole("status")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Close" }));
    await expect(args.onClose).toHaveBeenCalledOnce();
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
  },
};
export const Error: Story = { args: { severity: "error" } };
export const LongMessage: Story = {
  args: { children: `Could not reconnect: ${"very-long-server-diagnostic/".repeat(12)}` },
};
