import { cp, lstat, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.argv[2] !== "electron") {
  throw new Error("Usage: node scripts/package-desktop-server.mjs electron");
}

// The bundled server runs on a copy of this Node binary, so build only with the pinned version.
const pinned = (await readFile(path.join(root, ".nvmrc"), "utf8")).trim().replace(/^v/, "");
if (process.versions.node !== pinned) {
  throw new Error(
    `Desktop server must be packaged with Node ${pinned} (from .nvmrc), but this is Node ${process.versions.node}. Run \`nvm use\` first.`,
  );
}

const output = path.join(root, "apps/paint-vault-electron/desktop-server");
const dist = path.join(root, "apps/paint-vault/dist");
await readFile(path.join(dist, "server.mjs"));

// Install the server's production dependencies from the root lockfile, the same versions the web
// server and Docker image use, in a staging copy of the workspace manifests.
const lockfile = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
const workspaces = Object.keys(lockfile.packages).filter((key) => key && !key.includes("node_modules"));
const staging = await mkdtemp(path.join(os.tmpdir(), "paint-vault-desktop-server-"));
try {
  await cp(path.join(root, "package.json"), path.join(staging, "package.json"));
  await cp(path.join(root, "package-lock.json"), path.join(staging, "package-lock.json"));
  for (const workspace of workspaces) {
    await mkdir(path.join(staging, workspace), { recursive: true });
    await cp(path.join(root, workspace, "package.json"), path.join(staging, workspace, "package.json"));
  }
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(
    npm,
    // Omitting optional packages also drops build tools such as esbuild and tsx, which the lockfile
    // marks as both dev and optional; the server needs neither.
    ["ci", "--omit=dev", "--omit=optional", "--workspace", "paint-vault", "--no-audit", "--no-fund"],
    { cwd: staging, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (result.status !== 0) throw new Error("Desktop server dependency install failed");

  // Workspace packages are bundled into server.mjs; drop their links into the staging folders.
  const modules = path.join(staging, "node_modules");
  await removeWorkspaceLinks(modules);

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(modules, path.join(output, "node_modules"), { recursive: true, verbatimSymlinks: true });
} finally {
  await rm(staging, { recursive: true, force: true });
}

await cp(path.join(root, "apps/paint-vault/package.json"), path.join(output, "package.json"));
await cp(path.join(dist, "server.mjs"), path.join(output, "server.mjs"));
await cp(path.join(dist, "web-dist"), path.join(output, "web-dist"), { recursive: true });
await cp(path.join(dist, "drizzle"), path.join(output, "drizzle"), { recursive: true });

const executable = process.platform === "win32" ? "node.exe" : "node";
await cp(process.execPath, path.join(output, executable));
const sqliteCheck = spawnSync(
  path.join(output, executable),
  [
    "-e",
    "const Database=require('better-sqlite3');const db=new Database(':memory:');if(db.prepare('select 1 as value').get().value!==1)process.exit(1)",
  ],
  { cwd: output, stdio: "inherit" },
);
if (sqliteCheck.status !== 0) throw new Error("Bundled SQLite native binary failed its smoke test");
await writeFile(
  path.join(output, "README.txt"),
  "Paint Vault local server. Data is stored outside this application folder.\n",
);
console.log(`Packaged Electron server at ${output}`);

async function removeWorkspaceLinks(directory) {
  for (const entry of await readdir(directory)) {
    const entryPath = path.join(directory, entry);
    if (entry.startsWith("@")) {
      await removeWorkspaceLinks(entryPath);
    } else if ((await lstat(entryPath)).isSymbolicLink()) {
      await rm(entryPath, { recursive: true, force: true });
    }
  }
}
