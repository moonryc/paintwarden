import ComputerOutlinedIcon from "@mui/icons-material/ComputerOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  CssBaseline,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
  createTheme,
} from "@mui/material";
import { i18n } from "@paintwarden/i18n/runtime";
import Vault from "@paintwarden/ui";
import { colors } from "@paintwarden/ui/theme-tokens";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { HelpAbout } from "../../../packages/vault-ui/src/dom/Components/HelpAbout";
import type { PhoneAccessState } from "../../../packages/vault-ui/src/dom/types";

// Set when the saved remote server runs a different Paintwarden version than this app.
export type VersionProblem = {
  update: "server" | "app";
  appVersion: string;
  serverVersion: string | null;
  message: string;
};
export type ConnectionChoice = {
  mode: "local" | "remote" | null;
  serverUrl?: string;
  versionProblem?: VersionProblem;
};
type StartupState = { phase: "idle" | "starting" | "backing-up" | "migrating" | "ready" | "failed" };
export type PaintwardenDesktopBridge = {
  getPhoneAccess(): Promise<PhoneAccessState>;
  setPhoneAccess(enabled: boolean): Promise<PhoneAccessState>;
  getStartupState?(): Promise<StartupState>;
  onStartupState?(listener: (state: StartupState) => void): () => void;
  openLogsFolder?(): Promise<string>;
  getLanguage(): Promise<string>;
  setLanguage(language: string): Promise<string>;
  getConnection(): Promise<ConnectionChoice>;
  setConnection(choice: { mode: "local" | "remote"; serverUrl?: string }): Promise<ConnectionChoice>;
  saveBinary(input: { bytes: Uint8Array; filename: string; title?: string }): Promise<boolean>;
  saveBackup(input: { filename: string; authorization?: string }): Promise<boolean>;
  restoreBackup(
    file: File,
    input: { mode: "replace" | "merge"; authorization?: string },
  ): Promise<{ error?: string }>;
};

// Electron wraps errors from the main process as "Error invoking remote method 'x': Error: …".
const errorMessage = (cause: unknown, fallback: string) =>
  cause instanceof Error
    ? cause.message.replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, "")
    : fallback;

const connectionTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: colors.brandText },
    background: { default: colors.canvas, paper: colors.surface },
    text: { primary: colors.ink, secondary: colors.inkSoft },
  },
  typography: { fontFamily: "Inter, sans-serif" },
  shape: { borderRadius: 12 },
});

export default function DesktopConnection({ bridge }: { bridge: PaintwardenDesktopBridge }) {
  useTranslation("shell");
  const [choice, setChoice] = useState<ConnectionChoice | null>(null);
  const [editing, setEditing] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [checking, setChecking] = useState(false);
  const [startup, setStartup] = useState<StartupState>({ phase: "idle" });
  useEffect(() => {
    let mounted = true;
    let received = false;
    const unsubscribe = bridge.onStartupState?.((state) => {
      received = true;
      if (mounted) setStartup(state);
    });
    void bridge.getStartupState?.().then((state) => {
      if (mounted && !received) setStartup(state);
    });
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [bridge]);

  useEffect(() => {
    let mounted = true;
    bridge.getConnection().then(
      (result) => {
        if (mounted) setChoice(result);
      },
      (cause: unknown) => {
        if (!mounted) return;
        setChoice({ mode: null });
        setError(errorMessage(cause, i18n.t("shell:couldNotLoadTheSavedConnection")));
      },
    );
    return () => {
      mounted = false;
    };
  }, [bridge]);

  // Checks the saved server's version again, after the server or this app has been updated.
  const handleRetry = useCallback(async () => {
    setChecking(true);
    try {
      setChoice(await bridge.getConnection());
    } finally {
      setChecking(false);
    }
  }, [bridge]);

  const save = useCallback(
    async (next: { mode: "local" | "remote"; serverUrl?: string }) => {
      setBusy(true);
      setError("");
      try {
        const saved = await bridge.setConnection(next);
        setChoice(saved);
        setEditing(false);
      } catch (cause) {
        setError(errorMessage(cause, i18n.t("shell:couldNotSaveTheConnection")));
      } finally {
        setBusy(false);
      }
    },
    [bridge],
  );

  const handleChangeServer = useCallback(() => {
    setRemoteUrl(choice?.mode === "remote" ? (choice.serverUrl ?? "") : "");
    setEditing(true);
  }, [choice]);
  const handleLocal = useCallback(() => {
    void save({ mode: "local" });
  }, [save]);
  const handleRemoteSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (remoteUrl.trim()) void save({ mode: "remote", serverUrl: remoteUrl.trim() });
    },
    [remoteUrl, save],
  );
  const handleRemoteUrlChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setRemoteUrl(event.target.value);
  }, []);
  const handleCancel = useCallback(() => setEditing(false), []);

  const updating = ["backing-up", "migrating"].includes(startup.phase);
  const starting = startup.phase === "starting";
  const failed = startup.phase === "failed";
  if ((updating || starting || failed) && (choice?.mode !== "remote" || busy)) {
    return (
      <ThemeProvider theme={connectionTheme}>
        <CssBaseline />
        <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", p: 3 }}>
          <Card sx={{ width: "100%", maxWidth: 480, p: { xs: 3, sm: 4 } }} aria-busy={!failed}>
            <Stack spacing={2.5}>
              <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
                {failed
                  ? i18n.t("shell:vaultStartupFailed")
                  : updating
                    ? i18n.t("shell:updatingYourVault")
                    : i18n.t("shell:startingYourVault")}
              </Typography>
              <Typography role="status" aria-live="polite" color="text.secondary">
                {failed ? i18n.t("shell:vaultStartupRecovery") : i18n.t("shell:vaultStartupPleaseWait")}
              </Typography>
              {failed && (
                <>
                  <Button variant="contained" onClick={handleLocal} disabled={busy}>
                    {i18n.t("shell:retryVaultStartup")}
                  </Button>
                  {bridge.openLogsFolder && (
                    <Button
                      onClick={() =>
                        void bridge
                          .openLogsFolder?.()
                          .catch(() => setError(i18n.t("components:supportFailure")))
                      }
                    >
                      {i18n.t("shell:openLogsFolder")}
                    </Button>
                  )}
                  {error && <Alert severity="error">{error}</Alert>}
                  <HelpAbout desktop embedded />
                </>
              )}
            </Stack>
          </Card>
        </Box>
      </ThemeProvider>
    );
  }

  if (choice?.mode && !choice.versionProblem && !editing) {
    return <Vault key={`${choice.mode}:${choice.serverUrl ?? ""}`} onChangeServer={handleChangeServer} />;
  }

  if (choice?.versionProblem && !editing) {
    const problem = choice.versionProblem;
    return (
      <ThemeProvider theme={connectionTheme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: "100dvh",
            display: "grid",
            placeItems: "center",
            p: 3,
            backgroundColor: "background.default",
          }}
        >
          <Card sx={{ width: "100%", maxWidth: 480, p: { xs: 3, sm: 4 } }}>
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }} gutterBottom>
                  {problem.update === "server"
                    ? i18n.t("shell:updateTheServer")
                    : i18n.t("shell:updateThisApp")}
                </Typography>
                <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                  {choice.serverUrl}
                </Typography>
              </Box>
              <Alert severity="warning">{problem.message}</Alert>
              <Typography color="text.secondary">
                {i18n.t("shell:theAppAndTheServerMustRunTheSame")}
              </Typography>
              <Button variant="contained" size="large" disabled={checking} onClick={() => void handleRetry()}>
                {checking ? i18n.t("shell:checking") : i18n.t("shell:checkAgain")}
              </Button>
              <Button disabled={checking} onClick={handleChangeServer}>
                {i18n.t("shell:useADifferentServer")}
              </Button>
            </Stack>
          </Card>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={connectionTheme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          p: 3,
          backgroundColor: "background.default",
        }}
      >
        <Card sx={{ width: "100%", maxWidth: 480, p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }} gutterBottom>
                {i18n.t("shell:connectToPaintwarden")}
              </Typography>
              <Typography color="text.secondary">
                {i18n.t("shell:chooseWhereThisAppStoresAndReadsYourVault")}
              </Typography>
            </Box>

            {choice === null ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <CircularProgress aria-label={i18n.t("shell:loadingSavedConnection")} />
              </Box>
            ) : (
              <>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<ComputerOutlinedIcon />}
                  disabled={busy}
                  onClick={handleLocal}
                >
                  {i18n.t("shell:useThisComputer")}
                </Button>
                <Typography color="text.secondary">{i18n.t("shell:orConnectToAnExistingServer")}</Typography>
                <Box component="form" onSubmit={handleRemoteSubmit}>
                  <Stack spacing={2}>
                    <TextField
                      label={i18n.t("shell:serverUrl")}
                      placeholder="https://vault.example.com"
                      type="url"
                      autoComplete="url"
                      fullWidth
                      value={remoteUrl}
                      onChange={handleRemoteUrlChange}
                    />
                    {remoteUrl.trim().startsWith("http://") && (
                      <Alert severity="warning">
                        {i18n.t("shell:httpSendsYourPasswordAndVaultDataWithoutEncryption")}
                      </Alert>
                    )}
                    <Button
                      type="submit"
                      variant="outlined"
                      size="large"
                      startIcon={<LanguageOutlinedIcon />}
                      disabled={busy || !remoteUrl.trim()}
                    >
                      {i18n.t("shell:connectToServer")}
                    </Button>
                  </Stack>
                </Box>
                {editing && (
                  <Button disabled={busy} onClick={handleCancel}>
                    {i18n.t("shell:cancel")}
                  </Button>
                )}
              </>
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </Card>
      </Box>
    </ThemeProvider>
  );
}
