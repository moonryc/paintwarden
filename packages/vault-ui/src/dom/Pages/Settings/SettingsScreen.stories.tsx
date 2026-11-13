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
