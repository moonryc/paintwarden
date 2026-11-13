import { Alert, Box, Button, Card } from "@mui/material";
import { Component, type ReactNode, useState } from "react";

import { Download, RotateCw } from "../icons";
import { useVaultStore } from "../store/hooks";
import { exportBackupFile } from "../utils/backup-export";

// Catches a rendering error anywhere in the app and shows a recovery screen instead of a blank
// window. The vault data is safe on the server, so the screen offers a reload and a backup.
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    return this.state.error ? <CrashScreen error={this.state.error} /> : this.props.children;
  }
}

export function CrashScreen({ error }: { error: Error }) {
  const authHeaders = useVaultStore((s) => s.authHeaders);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<"saved" | "failed" | null>(null);
  async function exportBackup() {
    setExporting(true);
    setExportResult(null);
    try {
      if (await exportBackupFile(authHeaders)) setExportResult("saved");
    } catch {
      setExportResult("failed");
    } finally {
      setExporting(false);
    }
  }
  return (
    <Box
      component="main"
      sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", p: 2, bgcolor: "var(--canvas)" }}
    >
      <Card role="alert" sx={{ width: "100%", maxWidth: 480, p: { xs: 3, sm: 4 }, display: "grid", gap: 2 }}>
        <Box
          component="h1"
          sx={{ m: 0, fontFamily: "var(--font-serif)", fontSize: "1.5rem", letterSpacing: "-0.02em" }}
        >
          Something went wrong
        </Box>
        <Box component="p" sx={{ m: 0, color: "var(--ink-faint)", fontSize: 14, lineHeight: 1.5 }}>
          Paint Vault hit an error and couldn&rsquo;t show this screen. Your vault is saved on the server.
          Reload to carry on, or export a backup first if you want a copy.
        </Box>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 1.5,
            borderRadius: 2,
            bgcolor: "var(--sunken)",
            color: "var(--ink-faint)",
            fontSize: 12,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            maxHeight: 160,
            overflow: "auto",
          }}
        >
          {error.message || String(error)}
        </Box>
        {exportResult === "saved" && <Alert severity="success">Backup exported.</Alert>}
        {exportResult === "failed" && (
          <Alert severity="error">
            The backup couldn&rsquo;t be exported. Reload and try from Data &amp; settings.
          </Alert>
        )}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, justifyContent: "flex-end" }}>
          <Button
            variant="outlined"
            startIcon={<Download size={16} />}
            loading={exporting}
            onClick={() => void exportBackup()}
          >
            Export backup
          </Button>
          <Button
            variant="contained"
            startIcon={<RotateCw size={16} />}
            onClick={() => window.location.reload()}
          >
            Reload
          </Button>
        </Box>
      </Card>
    </Box>
  );
}
