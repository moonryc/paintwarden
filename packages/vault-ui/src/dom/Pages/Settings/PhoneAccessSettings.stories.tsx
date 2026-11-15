import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { desktopBridge } from "../../storybook/decorators";
import type { DesktopBridge, PhoneAccessState } from "../../types";

import { PhoneAccessSettings } from "./PhoneAccessSettings";
import { SettingsSection } from "./SettingsSection";

const off: PhoneAccessState = {
  available: true,
  enabled: false,
  port: 3180,
  addresses: [],
  tailscale: false,
};
const on: PhoneAccessState = {
  ...off,
  enabled: true,
  addresses: ["http://192.168.1.10:3180", "http://100.100.1.2:3180"],
  tailscale: true,
};
const bridge = (overrides: Partial<DesktopBridge> = {}) =>
  desktopBridge(
    { status: "disabled", currentVersion: "1.0.0", version: null, progress: null, error: null },
    overrides,
  );
const label = "Allow access from my other devices";
const meta = {
  title: "Pages/Settings/Phone access",
  component: PhoneAccessSettings,
  parameters: { docs: { story: { inline: false } } },
  decorators: [
    (Story) => (
      <SettingsSection title="Connection">
        <Story />
      </SettingsSection>
    ),
  ],
} satisfies Meta<typeof PhoneAccessSettings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OffByDefault: Story = {
  decorators: [bridge()],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole("switch", { name: label })).toBeEnabled());
    await expect(canvas.getByRole("switch", { name: label })).not.toBeChecked();
    await expect(canvas.queryByRole("img")).not.toBeInTheDocument();
    await expect(canvas.getByText(/Anyone on your network/)).toBeVisible();
  },
};

export const EnableSelectCopyDisable: Story = {
  decorators: [bridge({ setPhoneAccess: async (enabled) => (enabled ? on : off) })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("switch", { name: label });
    await waitFor(() => expect(toggle).toBeEnabled());
    const originalSet = window.paintwardenDesktop!.setPhoneAccess.bind(window.paintwardenDesktop);
    const set = fn(originalSet);
    window.paintwardenDesktop!.setPhoneAccess = set;
    const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const writeText = fn(async (_text: string) => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    try {
      await userEvent.click(toggle);
      await expect(set).toHaveBeenCalledWith(true);
      await waitFor(() => expect(toggle).toBeChecked());
      await expect(
        await canvas.findByRole("img", { name: `QR code for ${on.addresses[0]}` }),
      ).toHaveAttribute("src", expect.stringMatching(/^data:image\/png;base64,/));
      await userEvent.click(canvas.getByRole("radio", { name: on.addresses[1] }));
      await expect(await canvas.findByRole("img", { name: `QR code for ${on.addresses[1]}` })).toBeVisible();
      await userEvent.click(canvas.getByRole("button", { name: `Copy address ${on.addresses[1]}` }));
      await expect(writeText).toHaveBeenLastCalledWith(on.addresses[1]);
      await expect(canvas.getByText("Copied to clipboard.")).toBeVisible();
      await userEvent.click(canvas.getByRole("button", { name: "Copy command" }));
      await expect(writeText).toHaveBeenLastCalledWith("tailscale serve http://127.0.0.1:3180");
      await userEvent.click(toggle);
      await expect(set).toHaveBeenLastCalledWith(false);
      await waitFor(() => expect(toggle).not.toBeChecked());
      await expect(canvas.queryByRole("img")).not.toBeInTheDocument();
      await expect(canvas.queryByRole("radio")).not.toBeInTheDocument();
    } finally {
      window.paintwardenDesktop!.setPhoneAccess = originalSet;
      if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  },
};

export const Enabled: Story = {
  decorators: [bridge({ getPhoneAccess: async () => on })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("img")).toBeVisible();
    await expect(canvas.getByText(/plain HTTP/)).toBeVisible();
    await expect(canvas.getByText(/macOS may ask/)).toBeVisible();
    await expect(canvas.getByText(/manually run this command/)).toBeVisible();
  },
};

export const Loading: Story = {
  decorators: [bridge({ getPhoneAccess: () => new Promise(() => undefined) })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("switch", { name: label })).toBeDisabled();
    await expect(canvas.getByText("Updating device access…")).toBeVisible();
  },
};

export const LoadingWhileEnabling: Story = {
  decorators: [bridge({ setPhoneAccess: () => new Promise(() => undefined) })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("switch", { name: label });
    await waitFor(() => expect(toggle).toBeEnabled());
    await userEvent.click(toggle);
    await expect(toggle).toBeDisabled();
    await expect(canvas.getByText("Updating device access…")).toBeVisible();
  },
};

export const BridgeFailureAndRetry: Story = {
  decorators: [
    bridge({
      getPhoneAccess: async () => {
        throw new Error("private diagnostic path");
      },
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Could not update device access. Try again.")).toBeVisible();
    await expect(canvas.queryByText(/private diagnostic/)).not.toBeInTheDocument();
    window.paintwardenDesktop!.getPhoneAccess = async () => off;
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(canvas.getByRole("switch", { name: label })).toBeEnabled());
    await expect(canvas.queryByText("Could not update device access. Try again.")).not.toBeInTheDocument();
  },
};

export const EnableFailure: Story = {
  decorators: [bridge({ setPhoneAccess: async () => ({ ...off, error: "private listener failure" }) })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("switch", { name: label });
    await waitFor(() => expect(toggle).toBeEnabled());
    await userEvent.click(toggle);
    await expect(await canvas.findByText("Could not update device access. Try again.")).toBeVisible();
    await expect(toggle).not.toBeChecked();
    await expect(canvas.queryByText(/private listener/)).not.toBeInTheDocument();
  },
};

export const ClipboardUnavailable: Story = {
  decorators: [bridge({ getPhoneAccess: async () => on })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("img")).toBeVisible();
    const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    });
    try {
      await userEvent.click(canvas.getByRole("button", { name: `Copy address ${on.addresses[0]}` }));
      await expect(
        await canvas.findByText("Could not copy. Select the address or command and copy it manually."),
      ).toBeVisible();
    } finally {
      if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  },
};

export const NoNetworkAddresses: Story = {
  decorators: [bridge({ getPhoneAccess: async () => ({ ...off, enabled: true }) })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/No network address found/)).toBeVisible();
    await expect(canvas.queryByRole("img")).not.toBeInTheDocument();
  },
};

export const RemoteModeUnavailable: Story = {
  decorators: [bridge({ getPhoneAccess: async () => ({ ...off, available: false }) })],
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(within(canvasElement).queryByRole("switch", { name: label })).not.toBeInTheDocument(),
    );
  },
};

export const BrowserUnavailable: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("switch", { name: label })).not.toBeInTheDocument();
  },
};

export const NarrowLayout: Story = {
  decorators: [
    bridge({ getPhoneAccess: async () => on }),
    (Story) => (
      <div style={{ width: 280, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("img")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Copy command" })).toBeVisible();
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth);
  },
};
