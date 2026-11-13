import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { VaultLoadError } from "./VaultLoadError";

const meta = {
  title: "Components/VaultLoadError",
  component: VaultLoadError,
  args: { message: "Could not load your vault", onRetry: fn() },
} satisfies Meta<typeof VaultLoadError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent("Could not load your vault");
    await expect(canvas.queryByRole("button", { name: "Change server" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};

// The desktop app passes `onChangeServer`, so an unreachable server can be replaced from here.
export const Desktop: Story = {
  args: { onChangeServer: fn() },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Change server" }));
    await expect(args.onChangeServer).toHaveBeenCalledOnce();
  },
};
