// node --import tsx scripts/benchmark-miniatures-bundle.mts baseline [evidence-directory]
// node --import tsx scripts/benchmark-miniatures-bundle.mts compare <baseline-dist> <candidate-dist> [report.json]
// Baseline reconstruction NEVER checks out a ref or writes the shared build output.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.version, "v22.22.2", "Use pinned Node 22.22.2");
const root = fileURLToPath(new URL("..", import.meta.url));
const mode = process.argv[2];
const baselineRef = "e1f345a";
if (mode === "baseline") {
  const evidence = path.resolve(
    process.argv[3] ?? mkdtempSync(path.join(tmpdir(), "paint-vault-phase3-bundle-")),
  );
  mkdirSync(evidence, { recursive: true });
  const tree = mkdtempSync(path.join(tmpdir(), "paint-vault-phase2-bundle-"));
  const archive = spawnSync("git", ["archive", baselineRef], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(archive.status, 0, archive.stderr.toString());
  const unpack = spawnSync("tar", ["-xf", "-", "-C", tree], { input: archive.stdout });
  assert.equal(unpack.status, 0, unpack.stderr.toString());
  // Dependency packages are read-only inputs. Local workspace imports must resolve
  // to archived sources, never the evolving shared workspace's @paint-vault links.
  const dependencies = path.join(tree, "node_modules");
  mkdirSync(dependencies);
  for (const name of readdirSync(path.join(root, "node_modules"))) {
    // Never link Vite/cache output directories: this build owns its scratch files.
    if (name === "@paint-vault" || name.startsWith(".")) continue;
    symlinkSync(path.join(root, "node_modules", name), path.join(dependencies, name));
  }
  mkdirSync(path.join(dependencies, "@paint-vault"));
  for (const name of readdirSync(path.join(root, "node_modules/@paint-vault"))) {
    const pkg = name === "core" ? "paint-core" : name === "ui" ? "vault-ui" : null;
    assert.ok(pkg, `Unexpected workspace dependency ${name}; explicitly map its archived source`);
    symlinkSync(path.join(tree, "packages", pkg), path.join(dependencies, "@paint-vault", name));
  }
  // npm can retain workspace-specific dependency versions below a package.
  for (const workspace of ["apps/paint-vault-web", "packages/vault-ui", "packages/paint-core"]) {
    const source = path.join(root, workspace, "node_modules");
    try {
      symlinkSync(source, path.join(tree, workspace, "node_modules"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  // Vite bundles config into root node_modules/.vite-temp; its app-local plugin
  // must therefore also be visible at the isolated dependency root.
  symlinkSync(
    path.join(root, "apps/paint-vault-web/node_modules/vite-plugin-react-click-to-component"),
    path.join(dependencies, "vite-plugin-react-click-to-component"),
  );
  const dist = path.join(tree, "apps/paint-vault-web/dist");
  const env = { ...process.env, NODE_ENV: "production" };
  delete env.VITE_GRAPHQL_LIBRARY_DEBUG;
  delete env.DATA_DIR;
  delete env.DATABASE_PATH;
  const build = spawnSync(
    process.execPath,
    [path.join(root, "node_modules/vite/bin/vite.js"), "build", "--emptyOutDir"],
    {
      cwd: path.join(tree, "apps/paint-vault-web"),
      env,
      encoding: "utf8",
      timeout: 240000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  writeFileSync(path.join(evidence, "phase2-build.log"), build.stdout + build.stderr);
  assert.equal(build.status, 0, build.stderr);
  const revision = spawnSync("git", ["rev-parse", baselineRef], { cwd: root, encoding: "utf8" });
  assert.equal(revision.status, 0);
  const report = {
    measuredAt: new Date().toISOString(),
    node: process.version,
    baselineRef: revision.stdout.trim(),
    tree,
    dist,
    method:
      "Clean git archive of Phase 2 e1f345a, isolated archived workspace links, shared immutable external dependencies; NODE_ENV=production default Vite build without debug flag. No shared dist or git ref modified.",
  };
  writeFileSync(path.join(evidence, "phase2-baseline.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} else {
  assert.equal(mode, "compare", "Expected baseline or compare mode");
  assert.ok(process.argv[3] && process.argv[4], "compare <baseline-dist> <candidate-dist> [report.json]");
  const measured = spawnSync(
    process.execPath,
    [path.join(root, "scripts/measure-web-bundle.mjs"), process.argv[3], process.argv[4]],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 30000,
    },
  );
  assert.equal(measured.status, 0, measured.stderr);
  const result = JSON.parse(measured.stdout);
  const identify = (build: { directory: string; files: { file: string; bytes: number }[] }) => {
    const files = build.files.map((file) => {
      const data = readFileSync(path.join(build.directory, "assets", file.file));
      assert.equal(data.length, file.bytes, "Build output changed during measurement");
      return { file: file.file, sha256: createHash("sha256").update(data).digest("hex") };
    });
    files.push({
      file: "../index.html",
      sha256: createHash("sha256")
        .update(readFileSync(path.join(build.directory, "index.html")))
        .digest("hex"),
    });
    return { sha256: createHash("sha256").update(JSON.stringify(files)).digest("hex"), files };
  };
  result.baselineArtifact = identify(result.baseline);
  result.candidateArtifact = identify(result.candidate);
  result.baselineSource = baselineRef;
  result.candidateSource = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).stdout.trim();
  result.candidateWorkingTree = spawnSync("git", ["status", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
  }).stdout;
  result.candidateMinusBaseline.entryJsBytes = result.candidate.entry.bytes - result.baseline.entry.bytes;
  result.candidateMinusBaseline.entryGzipBytes =
    result.candidate.entry.gzipBytes - result.baseline.entry.gzipBytes;
  // Inventory validation is delegated to the existing stale-output guard.
  assert.ok(
    readFileSync(path.join(result.candidate.directory, "index.html"), "utf8").includes(
      result.candidate.entry.file,
    ),
  );
  const text = JSON.stringify(result, null, 2) + "\n";
  if (process.argv[5]) writeFileSync(process.argv[5], text);
  process.stdout.write(text);
}
