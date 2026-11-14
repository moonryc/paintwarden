import { i18n, i18nReady } from "@paint-vault/i18n/runtime";
import { isUserId } from "@paint-vault/core/vault-ids";
import { readZipDirectory, readZipEntryData, type ZipSource } from "@paint-vault/core/zip-reader";
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
      // Pre-release JSON backups hold only the owner's items and can only be merged.
      legacy: boolean;
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
  let zip = false;
  let body: unknown;
  try {
    const signature = await source.read(0, 2);
    zip = signature[0] === 0x50 && signature[1] === 0x4b;
    body = zip ? await readManifest(source) : JSON.parse(await file.text());
  } catch {
    return { ok: false, error: i18n.t("shell:backupChooseZip") };
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return { ok: false, error: i18n.t("shell:backupInvalid") };
  const record = body as Record<string, unknown>;
  if (record.format !== "paint-vault-backup") return { ok: false, error: i18n.t("shell:backupInvalid") };
  const legacy = !zip && (record.version === 3 || record.version === 4);
  if (!legacy && !(zip && record.version === 1)) return { ok: false, error: i18n.t("shell:backupVersion") };
  const exported = typeof record.exportedAt === "string" ? new Date(record.exportedAt) : null;
  const tables = (legacy ? record : (record.tables ?? {})) as Record<string, unknown>;
  const counts = legacy
    ? [
        plural(rows(tables.miniatures).length, "backupMiniature"),
        plural(rows(tables.customPaints).length, "backupCustomPaint"),
        plural(rows(tables.paintInventory).length, "backupPaintRecord"),
        // These backups marked source schemes instead of using `user:` IDs.
        plural(rows(tables.colorSchemes).filter((row) => row.isSystem !== true).length, "backupScheme"),
        plural(own(rows(tables.miniatureTemplates)), "backupTemplate"),
      ]
    : [
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
    legacy,
  };
}
