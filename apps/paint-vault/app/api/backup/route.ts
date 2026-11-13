import {
  BackupError,
  createBackup,
  removeBackupUpload,
  restoreBackup,
  saveBackupUpload,
} from "../../../lib/backup";

export function GET() {
  return new Response(createBackup(), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="paint-vault-${new Date().toISOString().slice(0, 10)}.zip"`,
      "cache-control": "no-store",
    },
  });
}

// The body is the backup file. `mode` chooses whether it replaces the vault or merges into it.
export async function POST(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode");
  if (mode !== "replace" && mode !== "merge")
    return Response.json({ error: "Choose whether to replace or merge" }, { status: 400 });
  if (!request.body) return Response.json({ error: "Choose a backup file" }, { status: 400 });
  const file = await saveBackupUpload(request.body);
  try {
    return Response.json(await restoreBackup(file, mode));
  } catch (error) {
    if (error instanceof BackupError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  } finally {
    await removeBackupUpload(file);
  }
}
