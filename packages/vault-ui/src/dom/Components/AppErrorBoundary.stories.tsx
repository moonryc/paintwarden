import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { desktopBridge } from "../storybook/decorators";
import { waitForDialogEntered } from "../storybook/dialog";

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

const report = fn(async () => true);
export const SupportExcludesRenderingError: Story = {
  args: { error: new Error("private-render-context /Users/example/vault.sqlite") },
  decorators: [
    desktopBridge(
      { status: "disabled", currentVersion: "1.0.0", version: null, progress: null, error: null },
      { openBugReport: report },
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const reportRow = canvas.getByRole("button", { name: /^Report a bug\b/ });
    await userEvent.click(reportRow);
    const reportElement = await within(document.body).findByRole("dialog", { name: "Report a bug" });
    await waitForDialogEntered(reportElement);
    const reportDialog = within(reportElement);
    await expect(report).not.toHaveBeenCalled();
    await expect(reportDialog.queryByText(/private-render-context|vault.sqlite/)).not.toBeInTheDocument();
    await userEvent.click(reportDialog.getByRole("button", { name: "Report a bug" }));
    await expect(report).toHaveBeenCalledWith("en");
    await userEvent.click(reportDialog.getByRole("button", { name: "Save support bundle" }));
    const preview = await within(document.body).findByRole("dialog", { name: "Review support bundle" });
    await waitForDialogEntered(preview);
    const dialog = within(preview);
    await expect(await dialog.findByText(/"version": "1.0.0"/)).toBeVisible();
    await expect(dialog.queryByText(/private-render-context/)).not.toBeInTheDocument();
    await expect(dialog.queryByText(/vault.sqlite/)).not.toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(preview).not.toBeInTheDocument());
    await expect(reportDialog.getByRole("button", { name: "Save support bundle" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(reportElement).not.toBeInTheDocument());
    await expect(reportRow).toHaveFocus();
  },
};
