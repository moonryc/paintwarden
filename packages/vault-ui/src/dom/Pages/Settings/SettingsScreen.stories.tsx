import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { desktopBridge } from "../../storybook/decorators";
import { SourcesApolloFixture } from "../../storybook/sources-apollo-fixture";

import { SettingsScreen } from "./SettingsScreen";

const meta = {
  title: "Pages/Settings",
  component: SettingsScreen,
  args: {
    auth: {
      setupRequired: false,
      setupCodeRequired: false,
      username: "painter",
      requireSignIn: false,
      authenticated: true,
    },
    connected: true,
    onChangeServer: fn(),
  },
  decorators: [
    (Story) => (
      <SourcesApolloFixture>
        <Story />
      </SourcesApolloFixture>
    ),
  ],
} satisfies Meta<typeof SettingsScreen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Connected: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Data & settings" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Manage plugins" })).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Help & About" })).toBeVisible();
    const help = within(canvas.getByRole("region", { name: "Help & About" }));
    await expect(help.getAllByRole("button")).toHaveLength(7);
    await expect(help.getByRole("button", { name: /^About Paintwarden/ })).toBeVisible();
    await expect(help.getByRole("button", { name: /^Report a bug/ })).toBeVisible();
    await expect(help.getByRole("button", { name: /^Save support bundle/ })).toBeVisible();
    await expect(help.queryByText("Channel", { exact: true })).not.toBeInTheDocument();
    await expect(help.queryByRole("link")).not.toBeInTheDocument();
    await expect(canvas.getByRole("switch", { name: "Require sign-in" })).not.toBeChecked();
  },
};
export const RequireSignIn: Story = {
  args: {
    auth: {
      setupRequired: false,
      setupCodeRequired: false,
      username: "painter",
      requireSignIn: true,
      authenticated: true,
    },
  },
};
export const Disconnected: Story = { args: { connected: false } };
export const PasswordDialog: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Change password" }));
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByLabelText(/Current password/)).toBeVisible());
    await expect(body.getByLabelText(/^New password/)).toHaveValue("");
  },
};

export const AccountErrorsAreLocalized: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const original = window.fetch.bind(window);
    const isAuthRequest = (input: RequestInfo | URL) =>
      new URL(input instanceof Request ? input.url : input, location.origin).pathname.startsWith(
        "/api/auth/",
      );
    try {
      window.fetch = async (input, init) => {
        if (isAuthRequest(input)) throw new TypeError("Failed to fetch private-host");
        return original(input, init);
      };
      await userEvent.click(canvas.getByRole("switch", { name: "Require sign-in" }));
      await userEvent.click(await body.findByRole("button", { name: "Turn on" }));
      await waitFor(() => expect(body.getByText("Could not update account")).toBeVisible());
      await expect(body.queryByText("Failed to fetch private-host")).not.toBeInTheDocument();
      window.fetch = async (input, init) =>
        isAuthRequest(input)
          ? Response.json({ error: "private legacy diagnostic", errorCode: "FORBIDDEN" }, { status: 403 })
          : original(input, init);
      await userEvent.click(body.getByRole("button", { name: "Turn on" }));
      await waitFor(() => expect(body.getByText("You do not have access to this vault.")).toBeVisible());
      await expect(body.queryByText("private legacy diagnostic")).not.toBeInTheDocument();
    } finally {
      window.fetch = original;
    }
  },
};

export const DesktopPhoneAccess: Story = {
  decorators: [
    desktopBridge({
      status: "disabled",
      currentVersion: "1.0.0",
      version: null,
      progress: null,
      error: null,
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole("switch", { name: "Allow access from my other devices" });
    await waitFor(() => expect(toggle).toBeEnabled());
    await expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    await expect(
      await canvas.findByRole("img", { name: "QR code for http://192.168.1.10:3180" }),
    ).toBeVisible();
    await userEvent.click(toggle);
    await waitFor(() => expect(canvas.queryByRole("img", { name: /QR code/ })).not.toBeInTheDocument());
  },
};

export const DesktopRemoteHasNoPhoneAccess: Story = {
  decorators: [
    desktopBridge(
      { status: "disabled", currentVersion: "1.0.0", version: null, progress: null, error: null },
      {
        getConnection: async () => ({ mode: "remote", serverUrl: "https://vault.example.test" }),
      },
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("https://vault.example.test")).toBeVisible();
    await expect(
      canvas.queryByRole("switch", { name: "Allow access from my other devices" }),
    ).not.toBeInTheDocument();
  },
};

// Settings has no query barrier: even an offline/pending connection leaves its shell usable.
export const Loading: Story = {
  args: { connected: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Data & settings" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Manage plugins" })).toBeEnabled();
    await expect(canvas.queryByRole("progressbar")).toBeNull();
  },
};

const delayedUpdate = {
  status: "idle" as const,
  currentVersion: "1.0.0",
  version: null,
  progress: null,
  error: null,
};
export const DesktopMetadataLoading: Story = {
  args: { desktopConnection: { mode: "remote", serverUrl: "https://example.test" } },
  decorators: [
    desktopBridge(delayedUpdate, {
      getUpdateState: () => new Promise((resolve) => setTimeout(() => resolve(delayedUpdate), 750)),
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const check = canvas.getByRole("button", { name: "Check for updates" });
    await expect(check).toBeDisabled();
    await expect(canvas.getByText("Loading…")).toBeVisible();
    const anchors = [
      canvas.getByRole("heading", { name: "Catalog" }),
      canvas.getByRole("heading", { name: "Account and security" }),
    ];
    const boxes = anchors.map((el) => el.getBoundingClientRect());
    await waitFor(() => expect(check).toBeEnabled());
    anchors.forEach((el, index) =>
      expect(Math.abs(el.getBoundingClientRect().y - boxes[index].y)).toBeLessThanOrEqual(1),
    );
  },
};

export const DesktopPhoneInitiallyEnabled: Story = {
  args: { desktopConnection: { mode: "local" } },
  decorators: [
    desktopBridge(delayedUpdate, {
      getPhoneAccess: () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                available: true,
                enabled: true,
                port: 3180,
                addresses: ["http://192.168.1.10:3180"],
                tailscale: false,
              }),
            750,
          ),
        ),
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const anchors = [
      canvas.getByRole("heading", { name: "Catalog" }),
      canvas.getByRole("heading", { name: "Account and security" }),
    ];
    const boxes = anchors.map((el) => el.getBoundingClientRect());
    await expect(
      await canvas.findByRole("img", { name: "QR code for http://192.168.1.10:3180" }),
    ).toBeVisible();
    anchors.forEach((el, index) =>
      expect(Math.abs(el.getBoundingClientRect().y - boxes[index].y)).toBeLessThanOrEqual(1),
    );
  },
};
