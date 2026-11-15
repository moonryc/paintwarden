import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { open, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkPackagedIcons } from "./check-packaged-icons.mjs";

export function assessUnsigned(result) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  assert.equal(result.status, 3, `Expected Gatekeeper rejection (exit 3): ${output}`);
  assert.match(output, /: rejected(?:\r?\n|$)/);
  assert.doesNotMatch(output, /damaged|invalid|resource envelope|obsolete|unsealed/i);
  return output.trim();
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  assert.ifError(result.error);
  return result;
}
function verify(file) {
  const result = run("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=2", file]);
  assert.equal(result.status, 0, `${file}: ${result.stderr}`);
}

// Do not follow framework symlinks or check only the outer seal: native server
// binaries/.node/dylibs in Resources also need their own real (non-linker) seals.
async function nativeFiles(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await nativeFiles(file)));
    else if (entry.isFile()) {
      const handle = await open(file, "r");
      const header = Buffer.alloc(4);
      try {
        await handle.read(header, 0, 4, 0);
      } finally {
        await handle.close();
      }
      if (
        [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0xbebafeca].includes(
          header.readUInt32BE(),
        )
      )
        found.push(file);
    }
  }
  return found;
}

export async function checkMacSignature(app, { adhoc = false } = {}) {
  assert.equal(process.platform, "darwin", "macOS signature verification requires macOS");
  verify(app);
  console.log("Verified packaged macOS icons:", await checkPackagedIcons(app));
  const files = await nativeFiles(path.join(app, "Contents"));
  assert.ok(
    files.some((file) => file.endsWith("/Resources/server/node")),
    "Missing native server",
  );
  assert.ok(
    files.some((file) => file.endsWith(".node")),
    "Missing native addons",
  );
  assert.ok(
    files.some((file) => /vips.*\.dylib$/.test(file)),
    "Missing separate libvips dylib",
  );
  for (const file of [app, ...files]) {
    verify(file);
    const signature = run("/usr/bin/codesign", ["--display", "--verbose=4", file]);
    assert.equal(signature.status, 0, signature.stderr);
    assert.doesNotMatch(signature.stderr, /linker-signed/, `Stale linker signature: ${file}`);
    assert.match(signature.stderr, /flags=.*runtime/, `Missing hardened runtime: ${file}`);
    if (adhoc) assert.match(signature.stderr, /Signature=adhoc/, `Expected ad-hoc signature: ${file}`);
    if (file === app || file.endsWith("/node") || /Helper[^/]*\.app\/Contents\/MacOS\//.test(file)) {
      const entitlements = run("/usr/bin/codesign", ["--display", "--entitlements", ":-", file]);
      assert.equal(entitlements.status, 0, entitlements.stderr);
      for (const key of ["allow-jit", "allow-unsigned-executable-memory", "disable-library-validation"])
        assert.match(
          entitlements.stdout,
          new RegExp(`<key>com\\.apple\\.security\\.cs\\.${key}</key>\\s*<true\\s*/>`),
          `Missing V8/native-loading entitlement ${key}: ${file}`,
        );
    }
  }
  if (adhoc) {
    console.log(
      assessUnsigned(run("/usr/sbin/spctl", ["--assess", "--type", "execute", "--verbose=4", app])),
    );
  }
  console.log(
    `Verified ${adhoc ? "ad-hoc" : "signed"} macOS bundle and ${files.length} native files: ${app}`,
  );
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(
    args.length >= 1 && args.length <= 2 && (!args[1] || args[1] === "--adhoc"),
    "Usage: node scripts/check-mac-signature.mjs <app> [--adhoc]",
  );
  await checkMacSignature(path.resolve(args[0]), { adhoc: args[1] === "--adhoc" });
}
