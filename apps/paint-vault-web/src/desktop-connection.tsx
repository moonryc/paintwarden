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
import Vault from "@paint-vault/ui";
import { colors } from "@paint-vault/ui/theme-tokens";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";

// Set when the saved remote server runs a different Paint Vault version than this app.
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
export type PaintVaultDesktopBridge = {
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

export default function DesktopConnection({ bridge }: { bridge: PaintVaultDesktopBridge }) {
  const [choice, setChoice] = useState<ConnectionChoice | null>(null);
  const [editing, setEditing] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let mounted = true;
    bridge.getConnection().then(
      (result) => {
        if (mounted) setChoice(result);
      },
      (cause: unknown) => {
        if (!mounted) return;
        setChoice({ mode: null });
        setError(errorMessage(cause, "Could not load the saved connection."));
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
        setError(errorMessage(cause, "Could not save the connection."));
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
                  {problem.update === "server" ? "Update the server" : "Update this app"}
                </Typography>
                <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                  {choice.serverUrl}
                </Typography>
              </Box>
              <Alert severity="warning">{problem.message}</Alert>
              <Typography color="text.secondary">
                The app and the server must run the same version of Paint Vault. Your vault data is safe and
                unchanged.
              </Typography>
              <Button variant="contained" size="large" disabled={checking} onClick={() => void handleRetry()}>
                {checking ? "Checking…" : "Check again"}
              </Button>
              <Button disabled={checking} onClick={handleChangeServer}>
                Use a different server
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
                Connect to Paint Vault
              </Typography>
              <Typography color="text.secondary">
                Choose where this app stores and reads your vault.
              </Typography>
            </Box>

            {choice === null ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <CircularProgress aria-label="Loading saved connection" />
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
                  Use this computer
                </Button>
                <Typography color="text.secondary">Or connect to an existing server:</Typography>
                <Box component="form" onSubmit={handleRemoteSubmit}>
                  <Stack spacing={2}>
                    <TextField
                      label="Server URL"
                      placeholder="https://vault.example.com"
                      type="url"
                      autoComplete="url"
                      fullWidth
                      value={remoteUrl}
                      onChange={handleRemoteUrlChange}
                    />
                    {remoteUrl.trim().startsWith("http://") && (
                      <Alert severity="warning">
                        HTTP sends your password and vault data without encryption. Use HTTPS outside a
                        trusted network.
                      </Alert>
                    )}
                    <Button
                      type="submit"
                      variant="outlined"
                      size="large"
                      startIcon={<LanguageOutlinedIcon />}
                      disabled={busy || !remoteUrl.trim()}
                    >
                      Connect to server
                    </Button>
                  </Stack>
                </Box>
                {editing && (
                  <Button disabled={busy} onClick={handleCancel}>
                    Cancel
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
