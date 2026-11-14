import { Alert, Box, Button, TextField } from "@mui/material";
import type { FormEvent, ReactNode } from "react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { Modal } from "../../Components/Modal";
import { PasswordField } from "../../Components/PasswordField";
import { i18n } from "../../i18n";
import { publicErrorMessage } from "../../utils/public-error";

const errorMessage = (cause: unknown) =>
  publicErrorMessage(cause, i18n.t("pages:settingsAccountUpdateError"));

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
  const { t } = useTranslation("pages");
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
      title={requireSignIn ? t("settingsTurnOffSignInTitle") : t("settingsRequireSignInTitle")}
      subtitle={requireSignIn ? t("settingsTurnOffSignInDescription") : t("settingsRequireSignInDescription")}
      error={error}
      onSubmit={() => {
        if (!ready) return;
        onConfirm(password).then(close, (cause) => setError(errorMessage(cause)));
      }}
      actions={(formId) => (
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, width: "100%" }}>
          <Button type="button" variant="outlined" disabled={busy} onClick={close}>
            {t("settingsCancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="contained"
            color={requireSignIn ? "error" : "primary"}
            disabled={!ready}
          >
            {requireSignIn ? t("settingsTurnOff") : t("settingsTurnOn")}
          </Button>
        </Box>
      )}
    >
      {needsPassword && (
        <PasswordField
          fullWidth
          required
          label={t("settingsCurrentPassword")}
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
  const { t } = useTranslation("pages");
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
      title={t("settingsChangePassword")}
      subtitle={t("settingsChangePasswordDescription")}
      error={error}
      onSubmit={() => {
        if (!ready) return;
        onConfirm(current, newPassword).then(close, (cause) => setError(errorMessage(cause)));
      }}
      actions={(formId) => (
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, width: "100%" }}>
          <Button type="button" variant="outlined" disabled={busy} onClick={close}>
            {t("settingsCancel")}
          </Button>
          <Button type="submit" form={formId} variant="contained" disabled={!ready}>
            {t("settingsChangePassword")}
          </Button>
        </Box>
      )}
    >
      <PasswordField
        fullWidth
        required
        label={t("settingsCurrentPassword")}
        autoComplete="current-password"
        value={current}
        onChange={edit(setCurrent)}
      />
      <PasswordField
        fullWidth
        required
        label={t("settingsNewPassword")}
        autoComplete="new-password"
        helperText={
          newPassword && remaining > 0
            ? t("settingsPasswordCharactersRemaining", { count: remaining })
            : t("settingsPasswordMinimumLength")
        }
        value={newPassword}
        onChange={edit(setNewPassword)}
      />
      <PasswordField
        fullWidth
        required
        label={t("settingsConfirmNewPassword")}
        autoComplete="new-password"
        error={Boolean(confirmPassword && confirmPassword !== newPassword)}
        helperText={
          confirmPassword && confirmPassword !== newPassword ? t("settingsPasswordsDoNotMatch") : undefined
        }
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
  const { t } = useTranslation("pages");
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
      title={t("settingsChangeUsername")}
      subtitle={t("settingsChangeUsernameDescription")}
      error={error}
      onSubmit={() => {
        if (!ready) return;
        onConfirm(current, trimmed).then(close, (cause) => setError(errorMessage(cause)));
      }}
      actions={(formId) => (
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, width: "100%" }}>
          <Button type="button" variant="outlined" disabled={busy} onClick={close}>
            {t("settingsCancel")}
          </Button>
          <Button type="submit" form={formId} variant="contained" disabled={!ready}>
            {t("settingsChangeUsername")}
          </Button>
        </Box>
      )}
    >
      <TextField
        fullWidth
        required
        label={t("settingsNewUsername")}
        autoComplete="username"
        placeholder={username}
        error={Boolean(trimmed && !lengthOk)}
        helperText={
          trimmed && !lengthOk
            ? t("settingsUsernameLengthError")
            : trimmed === username
              ? t("settingsUsernameUnchanged")
              : t("settingsUsernameLength")
        }
        value={newUsername}
        onChange={edit(setNewUsername)}
      />
      <PasswordField
        fullWidth
        required
        label={t("settingsCurrentPassword")}
        autoComplete="current-password"
        value={current}
        onChange={edit(setCurrent)}
      />
    </AccountDialog>
  );
}
