import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import DesktopConnection from "../../../../../apps/paint-vault-web/src/desktop-connection";
import { desktopBridge } from "../storybook/decorators";

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
  render: () => <DesktopConnection bridge={window.paintVaultDesktop!} />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Failed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Your vault could not start" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Report a bug" }));
    await expect(openBugReport).toHaveBeenCalledWith("en");
    await userEvent.click(await canvas.findByRole("button", { name: "Save support bundle" }));
    const dialog = within(
      await within(document.body).findByRole("dialog", { name: "Review support bundle" }),
    );
    await expect(saveSupportBundle).not.toHaveBeenCalled();
    await waitFor(() => expect(dialog.getByText(/Free-text details are omitted/)).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await expect(await canvas.findByRole("button", { name: "Save support bundle" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Open logs folder" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Could not complete this support action.",
    );
    await expect(canvas.queryByText(/Private log path/)).not.toBeInTheDocument();
  },
};
