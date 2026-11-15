// Assess the shipped disk image and ZIP, not just builder's staging directory.
// Every writable copy/profile is temporary; never install into /Applications.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkMacSignature } from "./check-mac-signature.mjs";
import { checkNoticeArtifact } from "./check-notice-artifact.mjs";

assert.equal(process.platform, "darwin");
const output = path.resolve(process.argv[2] ?? "dist/electron");
const evidence = path.resolve(process.env.E2E_ARTIFACTS_DIR ?? "outputs/mac-installers");
const temporary = await mkdtemp(path.join(tmpdir(), "paintwarden-installers-"));
console.log(`Isolated installer copies: ${temporary}`);
function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "pipe", maxBuffer: 16 * 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${command}: ${result.stdout}\n${result.stderr}`);
  if (result.stdout) console.log(result.stdout);
  return result;
}
const files = await readdir(output);
for (const extension of ["dmg", "zip"]) {
  const matches = files.filter((file) => file.endsWith(`.${extension}`));
  assert.equal(matches.length, 1, `Expected one ${extension}`);
  const installer = path.join(output, matches[0]);
  const quarantine = `0083;${Math.floor(Date.now() / 1000).toString(16)};PaintwardenInstallerTest;`;
  const app = path.join(temporary, extension, "Paintwarden.app");
  if (extension === "dmg") {
    // Do not mutate the build artifact; quarantine a copy as a browser would.
    const disk = path.join(temporary, "download.dmg");
    run("/usr/bin/ditto", [installer, disk]);
    run("/usr/bin/xattr", ["-w", "com.apple.quarantine", quarantine, disk]);
    const mount = path.join(temporary, "mounted");
    run("/usr/bin/hdiutil", ["attach", "-readonly", "-nobrowse", "-mountpoint", mount, disk]);
    try {
      run("/usr/bin/ditto", [path.join(mount, "Paintwarden.app"), app]);
    } finally {
      run("/usr/bin/hdiutil", ["detach", mount]);
    }
  } else {
    run("/usr/bin/ditto", ["-x", "-k", installer, path.dirname(app)]);
  }
  run("/usr/bin/xattr", ["-w", "com.apple.quarantine", quarantine, app]);
  console.log(run("/usr/bin/xattr", ["-p", "com.apple.quarantine", app]).stdout);
  const signature = run("/usr/bin/codesign", ["--display", "--verbose=4", app]);
  await checkMacSignature(app, { adhoc: /Signature=adhoc/.test(signature.stderr) });
  console.log(await checkNoticeArtifact({ resources: path.join(app, "Contents/Resources") }));
  if (extension === "dmg") {
    // Rejection above is intentional. CI cannot grant the user's Open Anyway
    // consent. Remove quarantine ONLY from this verified disposable copy for
    // the automated runtime smoke; never change system policy or real installs.
    console.log(
      "Quarantined assessment complete; clearing fixture-only quarantine for automated launch (not a Gatekeeper consent test).",
    );
    run("/usr/bin/xattr", ["-d", "com.apple.quarantine", app]);
    run(process.execPath, [
      "e2e/native-smoke.mjs",
      "--executable",
      path.join(app, "Contents/MacOS/Paintwarden"),
      "--artifacts",
      evidence,
    ]);
  }
}
