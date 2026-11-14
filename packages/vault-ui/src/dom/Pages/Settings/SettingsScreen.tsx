import DnsOutlinedIcon from "@mui/icons-material/DnsOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import LaptopMacOutlinedIcon from "@mui/icons-material/LaptopMacOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import SystemUpdateAltOutlinedIcon from "@mui/icons-material/SystemUpdateAltOutlined";
import { Alert, Button, Chip, Switch } from "@mui/material";
import Box from "@mui/material/Box";
import { translateServerError } from "@paint-vault/i18n/runtime";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { HelpAbout } from "../../Components/HelpAbout";
import { PageHeader } from "../../Components/PageHeader";
import { dialogPreloadHandlers } from "../../dialog-preload";
import { Download, Extension, FileUp } from "../../icons";
import { LanguagePicker } from "../../LanguagePicker";
import { FALLBACK_OWNER_NAME, UserAvatar } from "../../Layout/UserAvatar";
import { useVaultStore } from "../../store/hooks";
import type { AuthStatus } from "../../types";
import { exportBackupFile } from "../../utils/backup-export";
import { summarizeBackup } from "../../utils/backup-summary";
import { describeUpdate, useDesktopUpdate } from "../../utils/desktop-update";
import { PublicError, publicErrorMessage } from "../../utils/public-error";

import { ChangePasswordDialog, ChangeUsernameDialog, SignInSettingDialog } from "./AccountDialogs";
import { type PendingBackup, type RestoreMode, RestoreBackupDialog } from "./RestoreBackupDialog";
import { SettingsSection, SettingsRow } from "./SettingsSection";

export function SettingsScreen({
  auth,
  connected,
  onChangeServer,
}: {
  auth: AuthStatus | null;
  connected: boolean;
  onChangeServer?: () => void;
}) {
  const { t, i18n } = useTranslation("pages");
  const setToken = useVaultStore((s) => s.setToken);
  const api = useVaultStore((s) => s.api);
  const notify = useVaultStore((s) => s.notify);
  const authHeaders = useVaultStore((s) => s.authHeaders);
  const refresh = useVaultStore((s) => s.refresh);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [signInDialogOpen, setSignInDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [usernameDialogOpen, setUsernameDialogOpen] = useState(false);
  const openPlugins = useVaultStore((s) => s.openPlugins);
  const [pendingBackup, setPendingBackup] = useState<PendingBackup | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("merge");
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<Date | null>(null);
  const [serverAddress, setServerAddress] = useState<string>(window.location.origin);
  const [localServer, setLocalServer] = useState(false);
  useEffect(() => {
    if (!window.paintVaultDesktop) return;
    void window.paintVaultDesktop
      .getConnection()
      .then((choice) => {
        setLocalServer(choice.mode !== "remote");
        setServerAddress(choice.mode === "remote" ? (choice.serverUrl ?? "remote") : "local");
      })
      .catch(() => setServerAddress("desktop"));
  }, []);
  const update = useDesktopUpdate();
  const requireSignIn = Boolean(auth?.requireSignIn);
  const username = auth?.username || t(FALLBACK_OWNER_NAME);

  async function exportBackup() {
    setExporting(true);
    try {
      if (await saveBackup()) setLastExport(new Date());
    } catch (error) {
      notify(publicErrorMessage(error, t("settingsExportFailed")), "error");
    } finally {
      setExporting(false);
    }
  }
  async function saveBackup() {
    if (!(await exportBackupFile(authHeaders))) return false;
    notify(t("settingsBackupExported"));
    return true;
  }
  async function changeAccount(path: "settings" | "password" | "username", extra: object, password: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ password, ...extra }),
      });
      const result = (await response.json()) as { error?: string; token?: string };
      if (!response.ok) throw new PublicError(translateServerError(result));
      if (result.token) setToken(result.token);
      await refresh();
      notify(
        path === "password"
          ? t("settingsPasswordChanged")
          : path === "username"
            ? t("settingsUsernameChanged")
            : requireSignIn
              ? t("settingsSignInNoLongerRequired")
              : t("settingsSignInNowRequired"),
      );
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: "{}",
      });
      if (!response.ok) throw new PublicError(t("settingsSignOutFailed"));
      setToken("");
      await refresh();
    } catch (error) {
      notify(publicErrorMessage(error, t("settingsSignOutFailed")), "error");
    }
  }
  async function stageBackup(file: File) {
    const summary = await summarizeBackup(file);
    if (!summary.ok) {
      notify(summary.error, "error");
      return;
    }
    setRestoreMode("merge");
    setPendingBackup({ file, summary });
  }
  async function restoreBackup() {
    if (!pendingBackup) return;
    const mode = pendingBackup.summary.legacy ? "merge" : restoreMode;
    setBusy(true);
    try {
      if (window.paintVaultDesktop) {
        const result = await window.paintVaultDesktop.restoreBackup(pendingBackup.file, {
          mode,
          authorization: authHeaders().authorization,
        });
        if (result.error || result.errorCode) {
          notify(translateServerError(result), "error");
          return;
        }
      } else
        await api(`/api/backup?mode=${mode}`, {
          method: "POST",
          body: pendingBackup.file,
          headers: { "content-type": pendingBackup.summary.legacy ? "application/json" : "application/zip" },
        });
      setPendingBackup(null);
      // A restore can change any part of the vault, so it is reloaded in full.
      await refresh();
      notify(mode === "replace" ? t("settingsVaultReplaced") : t("settingsBackupMerged"));
    } catch (cause) {
      // Browser restores are reported by the shared API helper. Desktop failures
      // can instead reject at the bridge, before any HTTP response is available.
      if (window.paintVaultDesktop) notify(publicErrorMessage(cause, translateServerError({})), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box component="div" sx={{ width: "100%", minWidth: 0, display: "grid", gap: { xs: 3, md: 3.5 } }}>
      <PageHeader eyebrow={t("settingsYourData")} title={t("settingsTitle")} body={t("settingsBody")} />

      <SettingsSection title={t("settingsConnection")}>
        <SettingsRow
          icon={localServer ? <LaptopMacOutlinedIcon /> : <DnsOutlinedIcon />}
          title={
            <Box
              component="span"
              sx={{ display: "inline-flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}
            >
              {t("settingsVaultServer")}
              <Chip
                size="small"
                label={connected ? t("settingsConnected") : t("settingsNotConnected")}
                icon={
                  <Box
                    component="span"
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      bgcolor: connected ? "var(--ok)" : "var(--rust)",
                      // Beats the chip's icon margin, which uses a more specific selector.
                      ml: "8px !important",
                    }}
                  />
                }
                sx={{
                  height: 20,
                  fontSize: 11,
                  fontWeight: 600,
                  bgcolor: connected ? "var(--ok-soft)" : "var(--rust-soft)",
                  color: connected ? "var(--ok)" : "var(--rust)",
                }}
              />
            </Box>
          }
          description={
            <Box component="span" sx={{ color: "var(--ink-soft)", overflowWrap: "anywhere" }}>
              {serverAddress === "remote"
                ? t("settingsRemoteServer")
                : serverAddress === "local"
                  ? t("settingsThisComputer")
                  : serverAddress === "desktop"
                    ? t("settingsDesktopConnection")
                    : serverAddress}
            </Box>
          }
          action={
            onChangeServer && (
              <Button variant="outlined" size="small" onClick={onChangeServer}>
                {t("settingsChangeServer")}
              </Button>
            )
          }
        />
        {update.state && (
          <SettingsRow
            icon={<SystemUpdateAltOutlinedIcon />}
            title={t("settingsDesktopApp")}
            description={describeUpdate(update.state)}
            action={
              update.state.status === "ready" ? (
                <Button variant="contained" size="small" onClick={() => void update.install()}>
                  {t("settingsRestartToUpdate")}
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  disabled={["disabled", "checking", "downloading"].includes(update.state.status)}
                  onClick={() => void update.check()}
                >
                  {t("settingsCheckForUpdates")}
                </Button>
              )
            }
          />
        )}
      </SettingsSection>

      <HelpAbout />

      <LanguagePicker />

      <SettingsSection title={t("settingsCatalog")}>
        <SettingsRow
          icon={<Extension size={20} />}
          title={t("settingsPlugins")}
          description={t("settingsPluginsDescription")}
          action={
            <Button
              variant="outlined"
              size="small"
              {...dialogPreloadHandlers("plugins")}
              onClick={openPlugins}
            >
              {t("settingsManagePlugins")}
            </Button>
          }
        />
      </SettingsSection>

      <SettingsSection title={t("settingsAccountSecurity")}>
        <SettingsRow
          icon={<UserAvatar name={username} size={40} />}
          title={username}
          description={auth?.authenticated ? t("settingsOwnerSignedIn") : t("settingsOwner")}
          action={
            requireSignIn &&
            auth?.authenticated && (
              <Button
                variant="text"
                size="small"
                startIcon={<LogoutOutlinedIcon />}
                onClick={() => void signOut()}
              >
                {t("settingsSignOut")}
              </Button>
            )
          }
        />
        <SettingsRow
          icon={<LockOutlinedIcon />}
          title={t("settingsRequireSignIn")}
          description={
            requireSignIn ? t("settingsSignInRequiredDescription") : t("settingsSignInOffDescription")
          }
          action={
            <Switch
              checked={requireSignIn}
              disabled={busy}
              onChange={() => setSignInDialogOpen(true)}
              slotProps={{ input: { "aria-label": t("settingsRequireSignIn") } }}
            />
          }
        >
          {!requireSignIn && (
            <Alert severity="warning" sx={{ py: 0, fontSize: 12.5, borderRadius: 2 }}>
              {t("settingsSignInOffWarning")}
            </Alert>
          )}
        </SettingsRow>
        <SettingsRow
          icon={<PersonOutlineOutlinedIcon />}
          title={t("settingsUsername")}
          description={t("settingsSignedInAs", { username })}
          action={
            <Button
              variant="outlined"
              size="small"
              disabled={busy}
              onClick={() => setUsernameDialogOpen(true)}
            >
              {t("settingsChangeUsername")}
            </Button>
          }
        />
        <SettingsRow
          icon={<KeyOutlinedIcon />}
          title={t("settingsPassword")}
          description={t("settingsPasswordDescription")}
          action={
            <Button
              variant="outlined"
              size="small"
              disabled={busy}
              onClick={() => setPasswordDialogOpen(true)}
            >
              {t("settingsChangePassword")}
            </Button>
          }
        />
      </SettingsSection>

      <SettingsSection title={t("settingsBackups")} description={t("settingsBackupsDescription")}>
        <SettingsRow
          icon={<Download size={20} />}
          title={t("settingsExportBackup")}
          description={
            lastExport
              ? t("settingsLastBackup", {
                  time: new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
                    timeStyle: "short",
                  }).format(lastExport),
                })
              : t("settingsAccountExcluded")
          }
          action={
            <Button
              variant="contained"
              size="small"
              disabled={busy || exporting}
              startIcon={<Download size={16} />}
              onClick={() => void exportBackup()}
            >
              {exporting ? t("settingsExporting") : t("settingsExport")}
            </Button>
          }
        />
        <SettingsRow
          icon={<FileUp size={20} />}
          title={t("settingsRestoreBackup")}
          description={t("settingsRestoreDescription")}
          action={
            <Button
              variant="outlined"
              size="small"
              disabled={busy}
              startIcon={<FileUp size={16} />}
              onClick={() => inputRef.current?.click()}
            >
              {t("settingsChooseFile")}
            </Button>
          }
        />
        <input
          ref={inputRef}
          hidden
          type="file"
          accept=".zip,application/zip,.json,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void stageBackup(file);
          }}
        />
      </SettingsSection>
      {pendingBackup && (
        <RestoreBackupDialog
          pending={pendingBackup}
          mode={pendingBackup.summary.legacy ? "merge" : restoreMode}
          busy={busy}
          onModeChange={setRestoreMode}
          onRestore={() => void restoreBackup()}
          onClose={() => !busy && setPendingBackup(null)}
        />
      )}

      <SignInSettingDialog
        open={signInDialogOpen}
        requireSignIn={requireSignIn}
        needsPassword={!auth?.authenticated}
        busy={busy}
        onClose={() => setSignInDialogOpen(false)}
        onConfirm={(password) => changeAccount("settings", { requireSignIn: !requireSignIn }, password)}
      />
      <ChangeUsernameDialog
        open={usernameDialogOpen}
        username={auth?.username ?? ""}
        busy={busy}
        onClose={() => setUsernameDialogOpen(false)}
        onConfirm={(current, next) => changeAccount("username", { newUsername: next }, current)}
      />
      <ChangePasswordDialog
        open={passwordDialogOpen}
        busy={busy}
        onClose={() => setPasswordDialogOpen(false)}
        onConfirm={(current, next) => changeAccount("password", { newPassword: next }, current)}
      />
    </Box>
  );
}
