import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { classify, lockedPackages, root, sha256 } from "./generate-notices.mjs";

test("license policy rejects unknown and GPL/AGPL, but retains LGPL/MPL/OFL distinctions", () => {
  for (const license of [
    "GPL-2.0-only",
    "AGPL-3.0-or-later",
    "MIT OR GPL-3.0-only",
    "Future-1.0",
    "UNKNOWN",
  ]) {
    assert.throws(() => classify(license));
  }
  assert.equal(classify("LGPL-3.0-or-later"), "library-copyleft");
  assert.equal(classify("MPL-2.0"), "file-copyleft");
  assert.equal(classify("OFL-1.1"), "font");
  assert.equal(classify("MIT"), "permissive");
});

test("inventory retains non-installed platform options and physically staged dev tools", () => {
  const packages = lockedPackages({
    packages: {
      "node_modules/native-win": { version: "1", license: "MIT", optional: true, os: ["win32"] },
      "node_modules/native-linux": { version: "1", license: "MIT", optional: true, os: ["linux"] },
      "node_modules/typescript": { version: "1", license: "Apache-2.0", dev: true },
      "node_modules/unshipped-dev": { version: "1", license: "MIT", dev: true },
      "node_modules/workspace": { link: true },
    },
  });
  assert.deepEqual(
    packages.map((p) => p.name),
    ["native-linux", "native-win", "typescript"],
  );
});

async function fixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "notices-generator-test-"));
  try {
    await mkdir(path.join(directory, "scripts"));
    await cp(
      path.join(root, "scripts/generate-notices.mjs"),
      path.join(directory, "scripts/generate-notices.mjs"),
    );
    const file = "npm/@img__sharp-libvips-test@1.3.4/LICENSE";
    await mkdir(path.dirname(path.join(directory, "third-party", file)), { recursive: true });
    await writeFile(path.join(directory, "third-party", file), "Test LGPL material\n");
    await writeFile(path.join(directory, "third-party/README.txt"), "Fixture notices\n");
    await writeFile(
      path.join(directory, "third-party/sources.json"),
      JSON.stringify({
        nodeVersion: "22.22.2",
        electronVersion: "45.1.0",
        sharpLibvipsVersion: "1.3.4",
        files: [{ path: file, sha256: sha256("Test LGPL material\n") }],
      }),
    );
    await writeFile(path.join(directory, ".nvmrc"), "22.22.2\n");
    const lock = {
      packages: {
        "node_modules/electron": { dev: true, version: "45.1.0" },
        "node_modules/@img/sharp-libvips-test": { version: "1.3.4", license: "LGPL-3.0-or-later" },
      },
    };
    await writeFile(path.join(directory, "package-lock.json"), JSON.stringify(lock));
    const execute = (...args) =>
      spawnSync(process.execPath, [path.join(directory, "scripts/generate-notices.mjs"), ...args], {
        encoding: "utf8",
      });
    await run({ directory, lock, execute, file });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("offline generator is deterministic and detects lock-only drift", async () =>
  fixture(async ({ directory, lock, execute }) => {
    assert.equal(execute().status, 0);
    const first = await readFile(path.join(directory, "THIRD_PARTY_NOTICES.txt"));
    assert.equal(execute().status, 0);
    assert.deepEqual(await readFile(path.join(directory, "THIRD_PARTY_NOTICES.txt")), first);
    assert.equal(execute("--check").status, 0);
    lock.packages["node_modules/unrelated-dev"] = { version: "1", dev: true };
    await writeFile(path.join(directory, "package-lock.json"), JSON.stringify(lock));
    const stale = execute("--check");
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /Stale third-party\/inventory.json/);
  }));

test("offline generator fails for tampered/missing reviewed source texts", async () =>
  fixture(async ({ directory, execute, file }) => {
    assert.equal(execute().status, 0);
    await writeFile(path.join(directory, "third-party", file), "altered");
    assert.match(execute("--check").stderr, /Reviewed source changed\/missing/);
    await rm(path.join(directory, "third-party", file));
    assert.notEqual(execute("--check").status, 0);
  }));

test("a new native version requires corresponding source review", async () =>
  fixture(async ({ directory, lock, execute }) => {
    lock.packages["node_modules/@img/sharp-libvips-test"].version = "2.0.0";
    await writeFile(path.join(directory, "package-lock.json"), JSON.stringify(lock));
    assert.match(execute().stderr, /Native sources must be reviewed/);
  }));

test("Nx invalidates frontend and story builds when root legal materials change", async () => {
  const nx = JSON.parse(await readFile(path.join(root, "nx.json"), "utf8"));
  for (const target of ["build", "test", "storybook:build"]) {
    assert.ok(nx.targetDefaults[target].inputs.includes("legal"), `${target} lacks legal inputs`);
  }
  for (const input of [
    "{workspaceRoot}/LICENSE",
    "{workspaceRoot}/THIRD_PARTY_NOTICES.txt",
    "{workspaceRoot}/third-party/**/*",
  ]) {
    assert.ok(nx.namedInputs.legal.includes(input), `Missing legal cache input ${input}`);
  }
});
