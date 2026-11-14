import { lstatSync } from "node:fs";
import path from "node:path";

function exists(file: string) {
  try {
    lstatSync(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

// Read the legacy filename in place: renaming an open SQLite file or separating
// its WAL/SHM sidecars could lose data. Profile migration moves the whole folder.
export function databaseFile(dataDir: string, override?: string) {
  if (override) return override;
  const current = path.join(dataDir, "paintwarden.sqlite");
  const legacy = path.join(dataDir, "paint-vault.sqlite");
  const oldExists = exists(legacy);
  if (oldExists && exists(current))
    throw new Error(
      "Both current and legacy vault databases exist; stop the server and recover the intended vault before retrying.",
    );
  return oldExists ? legacy : current;
}
