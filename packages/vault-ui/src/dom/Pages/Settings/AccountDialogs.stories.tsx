import { translateServerError } from "@paint-vault/i18n/runtime";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { PublicError } from "../../utils/public-error";

import { ChangePasswordDialog, ChangeUsernameDialog, SignInSettingDialog } from "./AccountDialogs";

const meta = {
  title: "Dialogs/AccountDialogs",
  component: SignInSettingDialog,
  args: { open: true, requireSignIn: false, busy: false, onClose: fn(), onConfirm: fn(async () => {}) },
  parameters: { docs: { story: { inline: false, iframeHeight: 420 } } },
} satisfies Meta<typeof SignInSettingDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TurnOnSignIn: Story = {};

export const TurnOffSignIn: Story = { args: { requireSignIn: true } };

// A failed change keeps the dialog open and shows why.
export const SignInError: Story = {
  args: { onConfirm: fn(async () => Promise.reject(new Error("The server could not save the setting"))) },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole("button", { name: "Turn on" }));
    // The dialog fades in, so wait for the message to show rather than just exist.
    await waitFor(() => expect(body.getByText("Could not update account")).toBeVisible());
    await expect(body.queryByText("The server could not save the setting")).not.toBeInTheDocument();
  },
};

// Without a session, the change is sent with the current password.
export const SignInNeedsPassword: Story = {
  args: { needsPassword: true, onConfirm: fn(async () => {}) },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const submit = await body.findByRole("button", { name: "Turn on" });
    await expect(submit).toBeDisabled();
    await userEvent.type(body.getByLabelText(/Current password/), "long safe password");
    await userEvent.click(submit);
    await waitFor(() => expect(args.onConfirm).toHaveBeenCalledWith("long safe password"));
  },
};

export const ChangePassword: Story = {
  render: (args) => (
    <ChangePasswordDialog open busy={false} onClose={args.onClose} onConfirm={fn(async () => {})} />
  ),
};

// The new name is sent with the current password, trimmed.
export const ChangeUsername: Story = {
  args: { onConfirm: fn(async () => {}) },
  render: (args) => (
    <ChangeUsernameDialog
      open
      username="painter"
      busy={false}
      onClose={args.onClose}
      onConfirm={args.onConfirm}
    />
  ),
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const submit = await body.findByRole("button", { name: "Change username" });
    await userEvent.type(body.getByLabelText(/New username/), "  brush ");
    await userEvent.type(body.getByLabelText(/Current password/), "long safe password");
    await userEvent.click(submit);
    await waitFor(() => expect(args.onConfirm).toHaveBeenCalledWith("long safe password", "brush"));
  },
};

// Stable server codes carry translated detail; legacy/network Error messages do not.
export const StableCodeError: Story = {
  args: {
    onConfirm: fn(async () => {
      throw new PublicError(translateServerError({ errorCode: "FORBIDDEN" }));
    }),
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole("button", { name: "Turn on" }));
    await waitFor(() => expect(body.getByText("You do not have access to this vault.")).toBeVisible());
  },
};
