import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { AppErrorBoundary, CrashScreen } from "./AppErrorBoundary";

const meta = {
  title: "Components/CrashScreen",
  component: CrashScreen,
  args: { error: new Error("Cannot read properties of undefined (reading 'name')") },
} satisfies Meta<typeof CrashScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

function Broken(): never {
  throw new Error("This component failed to render");
}

// A child that throws is replaced by the crash screen instead of blanking the app.
export const CatchesRenderErrors: Story = {
  render: () => (
    <AppErrorBoundary>
      <Broken />
    </AppErrorBoundary>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    await expect(canvas.getByText("This component failed to render")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  },
};
