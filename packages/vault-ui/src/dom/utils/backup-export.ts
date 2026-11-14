import { i18n } from "@paint-vault/i18n/runtime";
import type { AuthHeaders } from "../types";

// Downloads a backup .zip of the whole vault: through the desktop save dialog in the desktop app,
// or as a browser download. Returns false when the user cancels the desktop save dialog.
export async function exportBackupFile(authHeaders: AuthHeaders) {
  const filename = `paint-vault-${new Date().toISOString().slice(0, 10)}.zip`;
  const headers = authHeaders();
  if (window.paintVaultDesktop)
    return window.paintVaultDesktop.saveBackup({ filename, authorization: headers.authorization });
  const response = await fetch("/api/backup", { headers });
  if (!response.ok) throw new Error(i18n.t("shell:exportFailed"));
  const blob = await response.blob();
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}
