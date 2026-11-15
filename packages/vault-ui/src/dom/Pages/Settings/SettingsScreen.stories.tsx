import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

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
