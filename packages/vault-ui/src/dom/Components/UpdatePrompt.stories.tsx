import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { desktopBridge } from "../storybook/decorators";
import type { DesktopUpdateState } from "../types";

import { UpdatePrompt } from "./UpdatePrompt";

// The bridge is global, so docs render each story in its own frame.
const meta = {
  title: "Components/UpdatePrompt",
  component: UpdatePrompt,
  parameters: { docs: { story: { inline: false, iframeHeight: 520 } } },
} satisfies Meta<typeof UpdatePrompt>;

export default meta;
type Story = StoryObj<typeof meta>;

const consent: DesktopUpdateState = {
  status: "consent-required",
  currentVersion: "1.0.0",
  version: "2.0.0",
  serverVersion: "1.0.0",
  consentId: "remote-a-update-2",
  progress: null,
  error: null,
};
const title = "Update may disconnect from server";

export const ReadyToInstall: Story = {
  decorators: [
    desktopBridge({ status: "ready", currentVersion: "1.0.0", version: "1.1.0", progress: 100, error: null }),
  ],
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await body.findByText("Paintwarden 1.1.0 is ready to install.");
    const install = fn(window.paintwardenDesktop!.installUpdate.bind(window.paintwardenDesktop));
    window.paintwardenDesktop!.installUpdate = install;
    await userEvent.click(body.getByRole("button", { name: "Later" }));
    await expect(install).not.toHaveBeenCalled();
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
  },
};

// Nothing shows while the update is still downloading.
export const Downloading: Story = {
  decorators: [
    desktopBridge({
      status: "downloading",
      currentVersion: "1.0.0",
      version: "1.1.0",
      progress: 42,
      error: null,
    }),
  ],
};

export const RemoteConsent: Story = {
  decorators: [desktopBridge(consent)],
  play: async ({ canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: title });
    await expect(dialog).toHaveTextContent("Server 1.0.0 · App update 2.0.0");
    await expect(dialog).toHaveTextContent(
      "Updating to 2.0.0 may disconnect this app from server 1.0.0 until the server is upgraded.",
    );
    await expect(dialog).toHaveTextContent("next scheduled or manual update check");
    await expect(within(dialog).getByRole("button", { name: "Update anyway" })).toBeEnabled();
    await expect(within(dialog).getByRole("button", { name: "Not now" })).toBeEnabled();
  },
};

export const UpdateAnyway: Story = {
  decorators: [desktopBridge(consent)],
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: title });
    const respond = fn(window.paintwardenDesktop!.respondToUpdate.bind(window.paintwardenDesktop));
    window.paintwardenDesktop!.respondToUpdate = respond;
    await userEvent.click(within(dialog).getByRole("button", { name: "Update anyway" }));
    await expect(respond).toHaveBeenCalledTimes(1);
    await expect(respond).toHaveBeenCalledWith({
      version: "2.0.0",
      consentId: "remote-a-update-2",
      action: "download",
    });
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await expect((await window.paintwardenDesktop!.getUpdateState()).status).toBe("downloading");
  },
};

export const NotNowAndRemindAgain: Story = {
  decorators: [desktopBridge(consent)],
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: title });
    const respond = fn(window.paintwardenDesktop!.respondToUpdate.bind(window.paintwardenDesktop));
    window.paintwardenDesktop!.respondToUpdate = respond;
    await userEvent.click(within(dialog).getByRole("button", { name: "Not now" }));
    await expect(respond).toHaveBeenCalledTimes(1);
    await expect(respond).toHaveBeenCalledWith({
      version: "2.0.0",
      consentId: "remote-a-update-2",
      action: "defer",
    });
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await expect((await window.paintwardenDesktop!.getUpdateState()).status).toBe("deferred");
    await window.paintwardenDesktop!.checkForUpdates();
    await body.findByRole("dialog", { name: title });
  },
};

export const EscapeDefers: Story = {
  decorators: [desktopBridge(consent)],
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await body.findByRole("dialog", { name: title });
    const respond = fn(window.paintwardenDesktop!.respondToUpdate.bind(window.paintwardenDesktop));
    window.paintwardenDesktop!.respondToUpdate = respond;
    await userEvent.keyboard("{Escape}");
    await expect(respond).toHaveBeenCalledTimes(1);
    await expect(respond).toHaveBeenCalledWith({
      version: "2.0.0",
      consentId: "remote-a-update-2",
      action: "defer",
    });
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
  },
};

export const CloseDefers: Story = {
  decorators: [desktopBridge(consent)],
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: title });
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await expect((await window.paintwardenDesktop!.getUpdateState()).status).toBe("deferred");
  },
};

export const UnknownServerVersion: Story = {
  decorators: [desktopBridge({ ...consent, serverVersion: null })],
};

export const ConsentFailure: Story = {
  decorators: [
    desktopBridge(consent, {
      respondToUpdate: () => Promise.reject(new Error("IPC unavailable")),
    }),
  ],
  play: async ({ canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: title });
    await userEvent.click(within(dialog).getByRole("button", { name: "Update anyway" }));
    await within(dialog).findByText("Could not save your choice. Please try again.");
    await expect(within(dialog).getByRole("button", { name: "Update anyway" })).toBeEnabled();
    await expect(within(dialog).getByRole("button", { name: "Not now" })).toBeEnabled();
  },
};

// A newer IPC event must win over an older getUpdateState reply on initial mount.
let resolveInitial: (state: DesktopUpdateState) => void;
export const NewerStateWins: Story = {
  decorators: [
    desktopBridge(consent, {
      getUpdateState: () => new Promise((resolve) => (resolveInitial = resolve)),
      onUpdateState: (listener) => {
        listener({ ...consent, serverVersion: "1.2.0", consentId: "remote-b-update-2" });
        resolveInitial(consent);
        return () => undefined;
      },
    }),
  ],
  play: async ({ canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: title });
    await expect(dialog).toHaveTextContent("Server 1.2.0 · App update 2.0.0");
    const respond = fn(window.paintwardenDesktop!.respondToUpdate.bind(window.paintwardenDesktop));
    window.paintwardenDesktop!.respondToUpdate = respond;
    await userEvent.click(within(dialog).getByRole("button", { name: "Update anyway" }));
    await expect(respond).toHaveBeenCalledTimes(1);
    await expect(respond).toHaveBeenCalledWith({
      version: "2.0.0",
      consentId: "remote-b-update-2",
      action: "download",
    });
  },
};

let publishState: (state: DesktopUpdateState) => void;
let resolveResponse: (state: DesktopUpdateState) => void;
export const PendingResponseAndServerSwitch: Story = {
  decorators: [
    desktopBridge(consent, {
      onUpdateState: (listener) => {
        publishState = listener;
        return () => undefined;
      },
      respondToUpdate: () => new Promise((resolve) => (resolveResponse = resolve)),
    }),
  ],
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: title });
    const respond = fn(window.paintwardenDesktop!.respondToUpdate.bind(window.paintwardenDesktop));
    window.paintwardenDesktop!.respondToUpdate = respond;
    await userEvent.click(within(dialog).getByRole("button", { name: "Update anyway" }));
    await expect(within(dialog).getByRole("button", { name: "Update anyway" })).toBeDisabled();
    await expect(within(dialog).getByRole("button", { name: "Not now" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    await expect(respond).toHaveBeenCalledTimes(1);

    // The same release on a different server needs fresh consent, not the pending answer.
    publishState({ ...consent, serverVersion: "1.2.0", consentId: "remote-b-update-2" });
    const next = await body.findByText("Server 1.2.0 · App update 2.0.0");
    await waitFor(() => expect(next).toBeVisible());
    resolveResponse({ ...consent, status: "deferred" });
    const newDialog = body.getByRole("dialog", { name: title });
    await expect(within(newDialog).getByRole("button", { name: "Update anyway" })).toBeEnabled();
    await userEvent.click(within(newDialog).getByRole("button", { name: "Not now" }));
    await expect(respond).toHaveBeenLastCalledWith({
      version: "2.0.0",
      consentId: "remote-b-update-2",
      action: "defer",
    });
    resolveResponse({ ...consent, status: "deferred" });
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
  },
};

export const GermanRemoteConsent: Story = {
  decorators: [desktopBridge(consent)],
  parameters: { locale: "de" },
};
