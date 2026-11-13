// Fails unless the release tag, all seven root/workspace manifests, and their root lockfile
// versions agree. Desktop and server compatibility requires a coordinated workspace release.
//   node scripts/check-release-version.mjs v1.2.3
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const workspacePaths = [
  "apps/paint-vault",
  "apps/paint-vault-web",
  "apps/paint-vault-site",
  "apps/paint-vault-electron",
  "packages/paint-core",
  "packages/vault-ui",
];

export function checkReleaseVersion(
  tag,
  readJson = (file) => JSON.parse(readFileSync(path.resolve(import.meta.dirname, "..", file), "utf8")),
) {
  const expected = tag.replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+$/.test(expected) || expected.trim() !== expected) {
    return { errors: [`Release tags look like v1.2.3, not "${tag}".`] };
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

  for (const directory of ["", ...workspacePaths]) {
    const file = directory ? `${directory}/package.json` : "package.json";
    const manifest = load(file);
    check(`${file} version`, manifest?.version);
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
    console.log(`All seven root/workspace packages and root lockfile versions are at ${expected}.`);
  }
}
