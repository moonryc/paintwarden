import { i18n, i18nReady } from "@paintwarden/i18n/runtime";
import { isUserId } from "@paintwarden/core/vault-ids";
import { readZipDirectory, readZipEntryData, type ZipSource } from "@paintwarden/core/zip-reader";
import { inflateSync, strFromU8 } from "fflate";

export type BackupSummary =
  | {
      ok: true;
      exportedAt: Date | null;
      counts: {
        label: string;
        count: number;
        key?:
          | "backupMiniature"
          | "backupCustomPaint"
          | "backupPaintRecord"
          | "backupScheme"
          | "backupTemplate"
          | "backupImage"
          | "backupPlugin";
      }[];
    }
  | { ok: false; error: string };

const MANIFEST = "backup.json";

type Rows = Record<string, unknown>[];
const rows = (value: unknown): Rows =>
  Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    : [];
const own = (list: Rows) => list.filter((row) => typeof row.id === "string" && isUserId(row.id)).length;
const plural = (
  count: number,
  key:
    | "backupMiniature"
    | "backupCustomPaint"
    | "backupPaintRecord"
    | "backupScheme"
    | "backupTemplate"
    | "backupImage"
    | "backupPlugin",
) => ({
  label: i18n.t(`shell:${key}`, { count }),
  count,
  key,
});

// Only the ZIP's directory and manifest are read, so previewing a large backup stays quick.
async function readManifest(source: ZipSource): Promise<unknown> {
  const entry = (await readZipDirectory(source)).find((file) => file.name === MANIFEST);
  if (!entry) throw new Error("missing");
  const stored = await readZipEntryData(source, entry);
  return JSON.parse(strFromU8(entry.method === 0 ? stored : inflateSync(stored)));
}

// Mirrors the server's accepted formats so an unsupported file is caught before it is uploaded.
export async function summarizeBackup(file: Blob): Promise<BackupSummary> {
  await i18nReady;
  const source: ZipSource = {
    size: file.size,
    read: async (offset, length) => new Uint8Array(await file.slice(offset, offset + length).arrayBuffer()),
  };
  let body: unknown;
  try {
    const signature = await source.read(0, 2);
    if (signature[0] !== 0x50 || signature[1] !== 0x4b) throw new Error("not a ZIP");
    body = await readManifest(source);
  } catch {
    return { ok: false, error: i18n.t("shell:backupChooseZip") };
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return { ok: false, error: i18n.t("shell:backupInvalid") };
  const record = body as Record<string, unknown>;
  if (record.format !== "paintwarden-backup") return { ok: false, error: i18n.t("shell:backupInvalid") };
  if (record.version !== 1 && record.version !== 2)
    return { ok: false, error: i18n.t("shell:backupVersion") };
  const exported = typeof record.exportedAt === "string" ? new Date(record.exportedAt) : null;
  const tables = (record.tables ?? {}) as Record<string, unknown>;
  const counts = [
    plural(rows(tables.miniatures).length, "backupMiniature"),
    plural(Array.isArray(record.images) ? record.images.length : 0, "backupImage"),
    plural(rows(tables.plugins).length, "backupPlugin"),
    plural(own(rows(tables.paints)), "backupCustomPaint"),
    plural(rows(tables.paintInventory).length, "backupPaintRecord"),
    plural(own(rows(tables.schemes)), "backupScheme"),
    plural(own(rows(tables.templates)), "backupTemplate"),
  ];
  return {
    ok: true,
    exportedAt: exported && !Number.isNaN(exported.getTime()) ? exported : null,
    counts: counts.filter(({ count }) => count > 0),
  };
}
