import { Alert, Box, Button, TextField } from "@mui/material";
import type { FormEvent, ReactNode } from "react";
import { useId, useState } from "react";

import { Modal } from "../../Components/Modal";
import { PasswordField } from "../../Components/PasswordField";

const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : "Could not update account";

// Field change handlers that also clear the last attempt's error.
const fieldEditor =
  (setError: (value: string) => void) =>
  (set: (value: string) => void) =>
  (event: { target: { value: string } }) => {
    set(event.target.value);
    setError("");
  };

// The confirmation dialogs behind the account settings: the shared Modal holding a form, with
// any error from the last attempt above its fields, and Cancel and submit in the footer.
function AccountDialog({
  open,
  onClose,
  title,
  subtitle,
  error,
  onSubmit,
  children,
  actions,
}: {
  open: boolean;
  onClose(): void;
  title: string;
  subtitle: string;
  error: string;
  onSubmit(): void;
  children?: ReactNode;
  // Cancel and submit buttons; the submit button names this form with formId.
  actions(formId: string): ReactNode;
}) {
  const formId = useId();
  if (!open) return null;
  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} footer={actions(formId)}>
      <Box
        component="form"
        id={formId}
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {error && <Alert severity="error">{error}</Alert>}
        {children}
      </Box>
    </Modal>
  );
}

// Turns the "require sign-in" setting on or off.
export function SignInSettingDialog({
  open,
  requireSignIn,
  needsPassword = false,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  requireSignIn: boolean;
  // Without a session, the owner proves who they are with the current password.
  needsPassword?: boolean;
  busy: boolean;
  onClose(): void;
  // Rejects with the reason the change failed.
  onConfirm(currentPassword: string): Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const ready = (!needsPassword || Boolean(password)) && !busy;
  const close = () => {
    setPassword("");
    setError("");
    onClose();
  };
  return (
    <AccountDialog
      open={open}
      onClose={() => !busy && close()}
      title={requireSignIn ? "Turn off sign-in?" : "Require sign-in?"}
      subtitle={
        requireSignIn
          ? "Anyone who can reach this server will be able to open and change the vault."
          : "Visitors will need your username and password to open the vault."
      }
      error={error}
      onSubmit={() => {
        if (!ready) return;
        onConfirm(password).then(close, (cause) => setError(errorMessage(cause)));
      }}
      actions={(formId) => (
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, width: "100%" }}>
          <Button type="button" variant="outlined" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="contained"
            color={requireSignIn ? "error" : "primary"}
            disabled={!ready}
          >
            {requireSignIn ? "Turn off" : "Turn on"}
          </Button>
        </Box>
      )}
    >
      {needsPassword && (
        <PasswordField
          fullWidth
          required
          label="Current password"
          autoComplete="current-password"
          value={password}
          onChange={fieldEditor(setError)(setPassword)}
        />
      )}
    </AccountDialog>
  );
}

// Changes the owner's password after checking the current one.
export function ChangePasswordDialog({
  open,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  onClose(): void;
  // Rejects with the reason the change failed.
  onConfirm(currentPassword: string, newPassword: string): Promise<void>;
}) {
  const [current, setCurrent] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const ready = Boolean(current) && newPassword.length >= 12 && newPassword === confirmPassword && !busy;
  const close = () => {
    setCurrent("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    onClose();
  };
  const edit = fieldEditor(setError);
  const remaining = 12 - newPassword.length;
  return (
    <AccountDialog
      open={open}
      onClose={() => !busy && close()}
      title="Change password"
      subtitle="Enter your current password to set a new one."
      error={error}
      onSubmit={() => {
        if (!ready) return;
        onConfirm(current, newPassword).then(close, (cause) => setError(errorMessage(cause)));
      }}
      actions={(formId) => (
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, width: "100%" }}>
          <Button type="button" variant="outlined" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="contained" disabled={!ready}>
            Change password
          </Button>
        </Box>
      )}
    >
      <PasswordField
        fullWidth
        required
        label="Current password"
        autoComplete="current-password"
        value={current}
        onChange={edit(setCurrent)}
      />
      <PasswordField
        fullWidth
        required
        label="New password"
        autoComplete="new-password"
        helperText={
          newPassword && remaining > 0
            ? `${remaining} more character${remaining === 1 ? "" : "s"} needed`
            : "At least 12 characters"
        }
        value={newPassword}
        onChange={edit(setNewPassword)}
      />
      <PasswordField
        fullWidth
        required
        label="Confirm new password"
        autoComplete="new-password"
        error={Boolean(confirmPassword && confirmPassword !== newPassword)}
        helperText={confirmPassword && confirmPassword !== newPassword ? "Passwords do not match" : undefined}
        value={confirmPassword}
        onChange={edit(setConfirmPassword)}
      />
    </AccountDialog>
  );
}

// Changes the owner's sign-in name after checking the current password.
export function ChangeUsernameDialog({
  open,
  username,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  username: string;
  busy: boolean;
  onClose(): void;
  // Rejects with the reason the change failed.
  onConfirm(currentPassword: string, newUsername: string): Promise<void>;
}) {
  const [current, setCurrent] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [error, setError] = useState("");
  const trimmed = newUsername.trim();
  const lengthOk = trimmed.length >= 2 && trimmed.length <= 64;
  const ready = Boolean(current) && lengthOk && trimmed !== username && !busy;
  const close = () => {
    setCurrent("");
    setNewUsername("");
    setError("");
    onClose();
  };
  const edit = fieldEditor(setError);
  return (
    <AccountDialog
      open={open}
      onClose={() => !busy && close()}
      title="Change username"
      subtitle="Enter your current password to choose a new username. You stay signed in on this device."
      error={error}
      onSubmit={() => {
        if (!ready) return;
        onConfirm(current, trimmed).then(close, (cause) => setError(errorMessage(cause)));
      }}
      actions={(formId) => (
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, width: "100%" }}>
          <Button type="button" variant="outlined" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="contained" disabled={!ready}>
            Change username
          </Button>
        </Box>
      )}
    >
      <TextField
        fullWidth
        required
        label="New username"
        autoComplete="username"
        placeholder={username}
        error={Boolean(trimmed && !lengthOk)}
        helperText={
          trimmed && !lengthOk
            ? "Use 2–64 characters"
            : trimmed === username
              ? "This is already your username"
              : "2–64 characters"
        }
        value={newUsername}
        onChange={edit(setNewUsername)}
      />
      <PasswordField
        fullWidth
        required
        label="Current password"
        autoComplete="current-password"
        value={current}
        onChange={edit(setCurrent)}
      />
    </AccountDialog>
  );
}
