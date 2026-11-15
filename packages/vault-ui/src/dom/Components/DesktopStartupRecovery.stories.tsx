import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import DesktopConnection from "../../../../../apps/paintwarden-web/src/desktop-connection";
import { desktopBridge } from "../storybook/decorators";
import { waitForDialogEntered } from "../storybook/dialog";

const openBugReport = fn(async () => true);
const saveSupportBundle = fn(async () => true);
const openLogsFolder = fn(async () => {
  throw new Error("Private log path must not be displayed");
});
const meta = {
  title: "Components/DesktopStartupRecovery",
  parameters: { docs: { story: { inline: false, iframeHeight: 900 } } },
  decorators: [
    desktopBridge(
      { status: "disabled", currentVersion: "1.0.0", version: null, progress: null, error: null },
      {
        getStartupState: async () => ({ phase: "failed" }),
        getConnection: async () => ({ mode: "local" }),
        openBugReport,
        saveSupportBundle,
        openLogsFolder,
      },
    ),
  ],
  render: () => <DesktopConnection bridge={window.paintwardenDesktop!} />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Failed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Your vault could not start" })).toBeVisible();
    const reportRow = canvas.getByRole("button", { name: /^Report a bug/ });
    await userEvent.click(reportRow);
    const reportElement = await within(document.body).findByRole("dialog", { name: "Report a bug" });
    await waitForDialogEntered(reportElement);
    await expect(openBugReport).not.toHaveBeenCalled();
    await userEvent.click(within(reportElement).getByRole("button", { name: "Report a bug" }));
    await expect(openBugReport).toHaveBeenCalledWith("en");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(reportElement).not.toBeInTheDocument());
    await expect(reportRow).toHaveFocus();
    const supportRow = canvas.getByRole("button", { name: /^Save support bundle/ });
    await userEvent.click(supportRow);
    const preview = await within(document.body).findByRole("dialog", { name: "Review support bundle" });
    await waitForDialogEntered(preview);
    const dialog = within(preview);
    await expect(saveSupportBundle).not.toHaveBeenCalled();
    await expect(dialog.getByText(/Free-text details are omitted/)).toBeVisible();
    await expect(await dialog.findByText(/"version": "1.0.0"/)).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(preview).not.toBeInTheDocument());
    await expect(supportRow).toHaveFocus();
    await expect(saveSupportBundle).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Open logs folder" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Could not complete this support action.",
    );
    await expect(canvas.queryByText(/Private log path/)).not.toBeInTheDocument();
  },
};
