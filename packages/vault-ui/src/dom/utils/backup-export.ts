import { i18n } from "@paintwarden/i18n/runtime";

import type { AuthHeaders } from "../types";

import { PublicError } from "./public-error";

// Downloads a backup .zip of the whole vault: through the desktop save dialog in the desktop app,
// or as a browser download. Returns false when the user cancels the desktop save dialog.
export async function exportBackupFile(authHeaders: AuthHeaders) {
  try {
    const filename = `paintwarden-${new Date().toISOString().slice(0, 10)}.zip`;
    const headers = authHeaders();
    if (window.paintwardenDesktop)
      return await window.paintwardenDesktop.saveBackup({ filename, authorization: headers.authorization });
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
  } catch (cause) {
    throw new PublicError(i18n.t("shell:exportFailed"), { cause });
  }
}
