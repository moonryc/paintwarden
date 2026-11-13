import DnsOutlinedIcon from "@mui/icons-material/DnsOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import LaptopMacOutlinedIcon from "@mui/icons-material/LaptopMacOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import SystemUpdateAltOutlinedIcon from "@mui/icons-material/SystemUpdateAltOutlined";
import { Alert, Button, Chip, Switch } from "@mui/material";
import Box from "@mui/material/Box";
import { useEffect, useRef, useState } from "react";

import { PageHeader } from "../../Components/PageHeader";
import { FALLBACK_OWNER_NAME, UserAvatar } from "../../Layout/UserAvatar";
import { Download, Extension, FileUp } from "../../icons";
import { useVaultStore } from "../../store/hooks";
import type { AuthStatus } from "../../types";
import { exportBackupFile } from "../../utils/backup-export";
import { summarizeBackup } from "../../utils/backup-summary";
import { describeUpdate, useDesktopUpdate } from "../../utils/desktop-update";

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
  const [serverAddress, setServerAddress] = useState(window.location.origin);
  const [localServer, setLocalServer] = useState(false);
  useEffect(() => {
    if (!window.paintVaultDesktop) return;
    void window.paintVaultDesktop
      .getConnection()
      .then((choice) => {
        setLocalServer(choice.mode !== "remote");
        setServerAddress(choice.mode === "remote" ? (choice.serverUrl ?? "Remote server") : "This computer");
      })
      .catch(() => setServerAddress("Desktop connection"));
  }, []);
  const update = useDesktopUpdate();
  const requireSignIn = Boolean(auth?.requireSignIn);
  const username = auth?.username || FALLBACK_OWNER_NAME;
  const serverVersion = useServerVersion();

  async function exportBackup() {
    setExporting(true);
    try {
      if (await saveBackup()) setLastExport(new Date());
    } catch (error) {
      notify(error instanceof Error ? error.message : "Export failed", "error");
    } finally {
      setExporting(false);
    }
  }
  async function saveBackup() {
    if (!(await exportBackupFile(authHeaders))) return false;
    notify("Backup exported");
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
      if (!response.ok) throw new Error(result.error || "Could not update account");
      if (result.token) setToken(result.token);
      await refresh();
      notify(
        path === "password"
          ? "Password changed"
          : path === "username"
            ? "Username changed"
            : requireSignIn
              ? "Sign-in no longer required"
              : "Sign-in now required",
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
      if (!response.ok) throw new Error("Could not sign out");
      setToken("");
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not sign out", "error");
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
        const { error } = await window.paintVaultDesktop.restoreBackup(pendingBackup.file, {
          mode,
          authorization: authHeaders().authorization,
        });
        if (error) {
          notify(error, "error");
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
      notify(mode === "replace" ? "Vault replaced from backup" : "Backup merged into vault");
    } catch {
      // The shared API helper already displays the error.
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box component="div" sx={{ width: "100%", minWidth: 0, display: "grid", gap: { xs: 3, md: 3.5 } }}>
      <PageHeader
        eyebrow="Your data"
        title="Data & settings"
        body="Manage the connection, plugins, who can open the vault, and backups."
      />

      <SettingsSection title="Connection">
        <SettingsRow
          icon={localServer ? <LaptopMacOutlinedIcon /> : <DnsOutlinedIcon />}
          title={
            <Box
              component="span"
              sx={{ display: "inline-flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}
            >
              Vault server
              <Chip
                size="small"
                label={connected ? "Connected" : "Not connected"}
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
              {serverAddress}
              {serverVersion && ` · Version ${serverVersion}`}
            </Box>
          }
          action={
            onChangeServer && (
              <Button variant="outlined" size="small" onClick={onChangeServer}>
                Change server
              </Button>
            )
          }
        />
        {update.state && (
          <SettingsRow
            icon={<SystemUpdateAltOutlinedIcon />}
            title="Desktop app"
            description={describeUpdate(update.state)}
            action={
              update.state.status === "ready" ? (
                <Button variant="contained" size="small" onClick={() => void update.install()}>
                  Restart to update
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  disabled={["disabled", "checking", "downloading"].includes(update.state.status)}
                  onClick={() => void update.check()}
                >
                  Check for updates
                </Button>
              )
            }
          />
        )}
      </SettingsSection>

      <SettingsSection title="Catalog">
        <SettingsRow
          icon={<Extension size={20} />}
          title="Plugins"
          description="Install catalogs of paints, schemes, and templates from GitHub, or package your own to share."
          action={
            <Button variant="outlined" size="small" onClick={openPlugins}>
              Manage plugins
            </Button>
          }
        />
      </SettingsSection>

      <SettingsSection title="Account and security">
        <SettingsRow
          icon={<UserAvatar name={username} size={40} />}
          title={username}
          description={auth?.authenticated ? "Vault owner · signed in on this device" : "Vault owner"}
          action={
            requireSignIn &&
            auth?.authenticated && (
              <Button
                variant="text"
                size="small"
                startIcon={<LogoutOutlinedIcon />}
                onClick={() => void signOut()}
              >
                Sign out
              </Button>
            )
          }
        />
        <SettingsRow
          icon={<LockOutlinedIcon />}
          title="Require sign-in"
          description={
            requireSignIn
              ? "Visitors must sign in before they can see or change vault data."
              : "Anyone who can reach this server can open the vault. Use only on a trusted network."
          }
          action={
            <Switch
              checked={requireSignIn}
              disabled={busy}
              onChange={() => setSignInDialogOpen(true)}
              slotProps={{ input: { "aria-label": "Require sign-in" } }}
            />
          }
        >
          {!requireSignIn && (
            <Alert severity="warning" sx={{ py: 0, fontSize: 12.5, borderRadius: 2 }}>
              Sign-in is off. Turn it on before exposing this server beyond your home network.
            </Alert>
          )}
        </SettingsRow>
        <SettingsRow
          icon={<PersonOutlineOutlinedIcon />}
          title="Username"
          description={`You sign in as ${username}.`}
          action={
            <Button
              variant="outlined"
              size="small"
              disabled={busy}
              onClick={() => setUsernameDialogOpen(true)}
            >
              Change username
            </Button>
          }
        />
        <SettingsRow
          icon={<KeyOutlinedIcon />}
          title="Password"
          description="Use at least 12 characters."
          action={
            <Button
              variant="outlined"
              size="small"
              disabled={busy}
              onClick={() => setPasswordDialogOpen(true)}
            >
              Change password
            </Button>
          }
        />
      </SettingsSection>

      <SettingsSection
        title="Backups"
        description="A backup is one .zip file with everything in this vault: miniatures and photos, paints, recipes, schemes, templates and installed plugins."
      >
        <SettingsRow
          icon={<Download size={20} />}
          title="Export a backup"
          description={
            lastExport
              ? `Saved a backup at ${lastExport.toLocaleTimeString(undefined, { timeStyle: "short" })}.`
              : "Your account and password aren't included."
          }
          action={
            <Button
              variant="contained"
              size="small"
              disabled={busy || exporting}
              startIcon={<Download size={16} />}
              onClick={() => void exportBackup()}
            >
              {exporting ? "Exporting…" : "Export"}
            </Button>
          }
        />
        <SettingsRow
          icon={<FileUp size={20} />}
          title="Restore from a backup"
          description="You'll see what the backup contains and choose how to restore it before anything changes."
          action={
            <Button
              variant="outlined"
              size="small"
              disabled={busy}
              startIcon={<FileUp size={16} />}
              onClick={() => inputRef.current?.click()}
            >
              Choose file
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

// The connected server's Paint Vault version, for bug reports and matching the desktop app.
function useServerVersion() {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    fetch("/api/version", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<{ version?: unknown }>) : null))
      .then((body) => {
        if (current && typeof body?.version === "string") setVersion(body.version);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, []);
  return version;
}
