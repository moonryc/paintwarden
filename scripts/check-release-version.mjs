// Fails unless the release tag, all root/workspace manifests, and their root lockfile
// versions agree. Desktop and server compatibility requires a coordinated workspace release.
//   node scripts/check-release-version.mjs v1.2.3
import { globSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");

export function checkReleaseVersion(
  tag,
  readJson = (file) => JSON.parse(readFileSync(path.join(root, file), "utf8")),
  findWorkspaceManifests = (pattern) =>
    globSync(`${pattern}/package.json`, {
      cwd: root,
      exclude: ["**/node_modules/**", "**/.git/**"],
    }),
) {
  const expected = tag.replace(/^v/, "");
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/.test(expected) ||
    expected.trim() !== expected
  ) {
    return { errors: [`Release tags look like v1.2.3 or v1.2.3-beta.1, not "${tag}".`] };
  }

  const errors = [];
  function load(file) {
    try {
      return readJson(file);
    } catch (error) {
      errors.push(`Cannot read ${file}: ${error.message}`);
      return undefined;
    }
  }
  function check(label, version) {
    if (version !== expected) {
      errors.push(`${label} is ${version ?? "missing"}, but the tag is ${tag}.`);
    }
  }

  const manifest = load("package.json");
  check("package.json version", manifest?.version);
  const patterns = Array.isArray(manifest?.workspaces) ? manifest.workspaces : manifest?.workspaces?.packages;
  const workspacePaths = new Set();
  if (!Array.isArray(patterns)) {
    errors.push("package.json workspaces must declare the release workspace patterns.");
  } else {
    for (const pattern of patterns) {
      if (typeof pattern !== "string" || !pattern.trim()) {
        errors.push("package.json workspaces must contain non-empty string patterns.");
        continue;
      }
      try {
        // Discover manifests on disk, not from the lockfile: a newly added workspace
        // must be checked even when its lock entry has not been generated yet.
        const files = findWorkspaceManifests(pattern);
        if (!files.length) errors.push(`No workspace package.json matches ${JSON.stringify(pattern)}.`);
        for (const file of files) workspacePaths.add(path.posix.dirname(file.replaceAll("\\", "/")));
      } catch (error) {
        errors.push(`Cannot discover workspaces matching ${JSON.stringify(pattern)}: ${error.message}`);
      }
    }
  }
  for (const directory of [...workspacePaths].sort()) {
    const file = `${directory}/package.json`;
    check(`${file} version`, load(file)?.version);
  }
  const lockfile = load("package-lock.json");
  check("package-lock.json version", lockfile?.version);
  for (const directory of ["", ...workspacePaths]) {
    check(
      `package-lock.json packages[${JSON.stringify(directory)}] version`,
      lockfile?.packages?.[directory]?.version,
    );
  }
  return { expected, errors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const { expected, errors } = checkReleaseVersion(process.argv[2] ?? process.env.GITHUB_REF_NAME ?? "");
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log(`All root/workspace packages and root lockfile versions are at ${expected}.`);
  }
}
