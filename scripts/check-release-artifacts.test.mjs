import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import yaml from "js-yaml";

import { checkReleaseArtifacts } from "./check-release-artifacts.mjs";

for (const version of ["1.0.0-beta.1", "1.0.0"]) {
  for (const platform of ["mac", "win"]) {
    test(`release ${version} ${platform} metadata is exact and fails closed`, () => {
      const dir = mkdtempSync(path.join(tmpdir(), "paintwarden-metadata-"));
      try {
        const asset = `Paintwarden-${version}-${platform}-arm64.${platform === "mac" ? "zip" : "exe"}`;
        const bytes = Buffer.from("synthetic installer");
        writeFileSync(path.join(dir, asset), bytes);
        const checksum = createHash("sha512").update(bytes).digest("base64");
        const channel = version.includes("beta") ? "beta" : "latest";
        const filename = `${channel}${platform === "mac" ? "-mac" : ""}.yml`;
        const data = {
          version,
          files: [{ url: asset, size: bytes.length, sha512: checksum }],
          path: asset,
          sha512: checksum,
          releaseNotes: "Exact notes\n",
        };
        const write = (value) => writeFileSync(path.join(dir, filename), yaml.dump(value));
        write(data);
        writeFileSync(path.join(dir, "builder-debug.yml"), "arch: arm64\n");
        assert.deepEqual(checkReleaseArtifacts(dir, version, "Exact notes\n"), [filename]);
        for (const bad of [
          { ...data, version: "9.0.0" },
          { ...data, releaseNotes: "Wrong notes" },
          { ...data, files: [] },
          { ...data, files: [{ ...data.files[0], size: 0 }] },
          { ...data, files: [{ ...data.files[0], sha512: "incorrect" }] },
          { ...data, files: [{ ...data.files[0], url: `../${asset}` }] },
          { ...data, path: "wrong.zip" },
        ]) {
          write(bad);
          assert.throws(() => checkReleaseArtifacts(dir, version, "Exact notes\n"));
        }
        write(data);
        writeFileSync(path.join(dir, `${channel === "beta" ? "latest" : "beta"}.yml`), yaml.dump(data));
        assert.throws(() => checkReleaseArtifacts(dir, version, "Exact notes\n"), /Wrong update channel/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
}
