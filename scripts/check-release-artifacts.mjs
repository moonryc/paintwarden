import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

import { releaseNotes } from "./release-notes.mjs";

export function checkReleaseArtifacts(directory, version, notes) {
  const beta = version.includes("-beta.");
  const channel = beta ? "beta" : "latest";
  const names = readdirSync(directory);
  const metadata = names.filter((name) => name.endsWith(".yml") && name !== "builder-debug.yml");
  assert.ok(metadata.length, "Missing update metadata");
  for (const name of metadata) {
    assert.ok(name === `${channel}.yml` || name === `${channel}-mac.yml`, `Wrong update channel: ${name}`);
    const data = yaml.load(readFileSync(path.join(directory, name), "utf8"));
    assert.equal(data.version, version, `${name}: version`);
    assert.equal(data.releaseNotes.trim(), notes.trim(), `${name}: exact release notes`);
    assert.ok(Array.isArray(data.files) && data.files.length > 0, `${name}: empty files`);
    for (const file of data.files) {
      assert.equal(path.basename(file.url), file.url, `${name}: asset must be a local basename`);
      assert.ok(file.url.includes(`-${version}-`), `${name}: wrong asset version`);
      assert.ok(/\.(zip|dmg|exe)$/.test(file.url), `${name}: unexpected installer`);
      const bytes = readFileSync(path.join(directory, file.url));
      assert.equal(bytes.length, file.size, `${file.url}: size`);
      assert.equal(createHash("sha512").update(bytes).digest("base64"), file.sha512, `${file.url}: checksum`);
    }
    assert.equal(data.path, data.files[0].url, `${name}: primary path`);
    assert.equal(data.sha512, data.files[0].sha512, `${name}: primary checksum`);
  }
  return metadata;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const { version } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const notes = releaseNotes(readFileSync(path.join(root, "CHANGELOG.md"), "utf8"), version);
  console.log(
    "Verified release metadata, notes, sizes and SHA512:",
    checkReleaseArtifacts(process.argv[2] ?? "dist/electron", version, notes),
  );
}
