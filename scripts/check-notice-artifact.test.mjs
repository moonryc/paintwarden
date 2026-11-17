import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  checkNoticeArtifact,
  checkPhysicalPackageInventory,
  dynamicLibraries,
} from "./check-notice-artifact.mjs";
import { createPackage } from "@electron/asar";
import { copyThirdPartyNotices } from "./copy-third-party-notices.mjs";
import { pruneSharpWasm } from "./prune-sharp-wasm.mjs";

async function write(root, name, content) {
  await mkdir(path.dirname(path.join(root, name)), { recursive: true });
  await writeFile(path.join(root, name), content);
}

function machO(dependency, type = 8) {
  const name = Buffer.from(`${dependency}\0`);
  const size = Math.ceil((24 + name.length) / 8) * 8;
  const bytes = Buffer.alloc(32 + size);
  bytes.writeUInt32LE(0xfeedfacf, 0);
  bytes.writeUInt32LE(type, 12);
  bytes.writeUInt32LE(1, 16);
  bytes.writeUInt32LE(size, 20);
  bytes.writeUInt32LE(0xc, 32);
  bytes.writeUInt32LE(size, 36);
  bytes.writeUInt32LE(24, 40);
  name.copy(bytes, 56);
  return bytes;
}

function elf(dependency) {
  const bytes = Buffer.alloc(512);
  bytes.write("\x7fELF", 0, "ascii");
  bytes[4] = 2;
  bytes[5] = 1;
  bytes.writeUInt16LE(3, 16);
  bytes.writeBigUInt64LE(64n, 32);
  bytes.writeUInt16LE(56, 54);
  bytes.writeUInt16LE(2, 56);
  bytes.writeUInt32LE(1, 64); // PT_LOAD, maps whole fixture at 0x1000
  bytes.writeBigUInt64LE(0x1000n, 80);
  bytes.writeBigUInt64LE(512n, 96);
  bytes.writeUInt32LE(2, 120); // PT_DYNAMIC
  bytes.writeBigUInt64LE(256n, 128);
  bytes.writeBigUInt64LE(48n, 152);
  bytes.writeBigUInt64LE(5n, 256); // DT_STRTAB
  bytes.writeBigUInt64LE(0x1180n, 264);
  bytes.writeBigUInt64LE(1n, 272); // DT_NEEDED, offset 1
  bytes.writeBigUInt64LE(1n, 280);
  bytes.write(`${dependency}\0`, 385);
  return bytes;
}

function pe(dependency) {
  const bytes = Buffer.alloc(1024);
  bytes.write("MZ", 0);
  bytes.writeUInt32LE(64, 0x3c);
  bytes.write("PE\0\0", 64);
  bytes.writeUInt16LE(1, 70);
  bytes.writeUInt16LE(240, 84);
  bytes.writeUInt16LE(0x2000, 86); // IMAGE_FILE_DLL
  bytes.writeUInt16LE(0x20b, 88);
  bytes.writeUInt32LE(0x1000, 208); // import table RVA
  const section = 328;
  bytes.writeUInt32LE(512, section + 8);
  bytes.writeUInt32LE(0x1000, section + 12);
  bytes.writeUInt32LE(512, section + 16);
  bytes.writeUInt32LE(512, section + 20);
  bytes.writeUInt32LE(0x1080, 524); // import descriptor name RVA
  bytes.write(`${dependency}\0`, 640);
  return bytes;
}

for (const [kind, binary, name] of [
  ["Mach-O", machO, "@rpath/libvips-cpp.8.dylib"],
  ["ELF", elf, "libvips-cpp.so.8"],
  ["PE", pe, "libvips-42.dll"],
]) {
  test(`${kind} dynamic import table is read without platform tools`, () => {
    assert.deepEqual(dynamicLibraries(binary(name)), [name]);
  });
}
test("a libvips string is not evidence of a dynamically linked binary", () => {
  assert.throws(() => dynamicLibraries(Buffer.from("fake static libvips-cpp.so.8")), /Unrecognized/);
});

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "paintwarden-notices-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  const output = path.join(root, "output");
  await write(source, "LICENSE", "project license\n");
  await write(source, "THIRD_PARTY_NOTICES.txt", "full notices\n");
  await write(source, "third-party/runtime/node-LICENSE.txt", "full Node license\n");
  await write(source, "third-party/texts/example.txt", "verbatim example\n");
  await write(
    source,
    "third-party/inventory.json",
    JSON.stringify({ packages: [{ name: "reviewed", version: "1.0.0" }] }),
  );
  await copyThirdPartyNotices(output, source);
  return { source, output };
}

test("offline copies require exact bytes and the complete source/text tree", async (t) => {
  const { source, output } = await fixture(t);
  const check = () => checkNoticeArtifact({ root: source, webRoot: output });
  await check();
  await write(output, "THIRD_PARTY_NOTICES.txt", "full notices\r\n");
  await assert.rejects(check, /Stale or modified THIRD_PARTY_NOTICES/);
  await copyThirdPartyNotices(output, source);
  await write(output, "third-party/texts/example.txt", "changed");
  await assert.rejects(check, /Stale or modified third-party/);
  await copyThirdPartyNotices(output, source);
  await rm(path.join(output, "third-party/runtime/node-LICENSE.txt"));
  await assert.rejects(check, /Incomplete third-party/);
  await copyThirdPartyNotices(output, source);
  await write(output, "third-party/untracked.txt", "stale extra");
  await assert.rejects(check, /Incomplete third-party/);
  await copyThirdPartyNotices(output, source);
  await write(output, "assets/new-runtime.wasm", "WASM");
  await assert.rejects(check, /WASM binary must not ship in web output/);
});

test("native artifacts require separate dynamically linked libvips and reject sharp WASM", async (t) => {
  const { source, output } = await fixture(t);
  await copyThirdPartyNotices(path.join(output, "apps/paintwarden/dist/web-dist"), source);
  const addon = "node_modules/@img/sharp-darwin-arm64/lib/sharp.node";
  const library = "node_modules/@img/sharp-libvips-darwin-arm64/lib/libvips-cpp.8.dylib";
  await write(output, addon, machO("@rpath/libvips-cpp.8.dylib"));
  await write(output, library, machO("/usr/lib/libSystem.B.dylib", 6));
  const check = () => checkNoticeArtifact({ root: source, dockerRoot: output });
  await check();
  await write(output, addon, machO("/usr/lib/libSystem.B.dylib"));
  await assert.rejects(check, /does not dynamically load/);
  await write(output, addon, machO("@rpath/libvips-cpp.8.dylib"));
  await rm(path.join(output, library));
  await assert.rejects(check, /Missing separate replaceable libvips/);
  await write(output, library, machO("/usr/lib/libSystem.B.dylib", 6));
  await write(output, "node_modules/@img/sharp-wasm32/lib/sharp.node.wasm", "wasm");
  await assert.rejects(check, /WASM fallback must not ship/);
  await rm(path.join(output, "node_modules/@img/sharp-wasm32"), { recursive: true });
  await write(output, "node_modules/another-module/runtime.wasm", "wasm");
  await assert.rejects(check, /Unreviewed physical WASM/);
});

test("desktop artifacts must retain the actual Chromium notices outside asar", async (t) => {
  const { source, output } = await fixture(t);
  const server = path.join(output, "server");
  await copyThirdPartyNotices(path.join(output, "web-dist"), source);
  await copyThirdPartyNotices(path.join(server, "web-dist"), source);
  await write(server, "node_modules/@img/sharp-win32-x64/lib/sharp.node", pe("libvips-42.dll"));
  await write(server, "node_modules/@img/sharp-win32-x64/lib/libvips-42.dll", pe("KERNEL32.dll"));
  await write(server, "node.exe", "test runtime");
  const asarSource = path.join(path.dirname(output), "asar-source");
  await write(
    asarSource,
    "package.json",
    JSON.stringify({ name: "paintwarden-electron", version: "1.0.0", private: true }),
  );
  await write(
    asarSource,
    "node_modules/reviewed/package.json",
    JSON.stringify({ name: "reviewed", version: "1.0.0" }),
  );
  await createPackage(asarSource, path.join(output, "app.asar"));
  const check = () => checkNoticeArtifact({ root: source, resources: output });
  await assert.rejects(check, /Missing actual Electron LICENSES/);
  await write(path.dirname(output), "LICENSES.chromium.html", `<html>${"license text\n".repeat(100)}</html>`);
  await check();
  await write(
    asarSource,
    "node_modules/unreviewed/package.json",
    JSON.stringify({ name: "unreviewed", version: "1.0.0" }),
  );
  await createPackage(asarSource, path.join(output, "app.asar"));
  await assert.rejects(check, /missing from reviewed notice inventory/);
  await rm(path.join(asarSource, "node_modules/unreviewed"), { recursive: true });
  await write(asarSource, "node_modules/reviewed/runtime.wasm", "WASM");
  await createPackage(asarSource, path.join(output, "app.asar"));
  await assert.rejects(check, /WASM binary must not ship in app.asar/);
  await rm(path.join(asarSource, "node_modules/reviewed/runtime.wasm"));
  await createPackage(asarSource, path.join(output, "app.asar"));
  await rm(path.join(server, "node.exe"));
  await assert.rejects(check, /Missing bundled Node runtime/);
});

test("every physically shipped npm version must have reviewed notices", async (t) => {
  const { output } = await fixture(t);
  const inventory = new Set(["reviewed@1.0.0"]);
  await write(
    output,
    "node_modules/reviewed/package.json",
    JSON.stringify({ name: "reviewed", version: "1.0.0" }),
  );
  assert.equal(await checkPhysicalPackageInventory(output, inventory), 1);
  await write(
    output,
    "apps/server/node_modules/reviewed/package.json",
    JSON.stringify({ name: "reviewed", version: "2.0.0" }),
  );
  await assert.rejects(() => checkPhysicalPackageInventory(output, inventory), /reviewed@2.0.0/);
  inventory.add("reviewed@2.0.0");
  assert.equal(await checkPhysicalPackageInventory(output, inventory), 2);
  await write(
    output,
    "node_modules/paintwarden-fake/package.json",
    JSON.stringify({ name: "paintwarden-fake", version: "1.0.0" }),
  );
  await assert.rejects(() => checkPhysicalPackageInventory(output, inventory), /paintwarden-fake/);
});

test("WASM pruner removes nested fallbacks and orphan helpers, preserving native and other consumers", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "paintwarden-prune-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  async function pkg(name, dependencies, prefix = "") {
    const location = path.join(prefix, "node_modules", name, "package.json");
    await write(root, location, JSON.stringify({ name, dependencies }));
  }
  await pkg("@img/sharp-wasm32", { "@emnapi/runtime": "1" });
  await pkg("@emnapi/runtime", { "@tybys/wasm-util": "1" });
  await pkg("@tybys/wasm-util", {});
  await pkg("@img/sharp-darwin-arm64", {});
  await pkg("@img/sharp-wasm32", {}, "apps/server");
  const removed = await pruneSharpWasm(root);
  assert.equal(removed.length, 4);
  assert.ok(await readFile(path.join(root, "node_modules/@img/sharp-darwin-arm64/package.json")));
  await pkg("@emnapi/runtime", {});
  await pkg("unrelated-wasm-consumer", { "@emnapi/runtime": "1" });
  assert.deepEqual(await pruneSharpWasm(root), []);
});

test("build-only picomatch exception never permits a shipped runtime package", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "paintwarden-picomatch-runtime-"));
  try {
    const target = path.join(directory, "node_modules/picomatch");
    await mkdir(target, { recursive: true });
    await writeFile(
      path.join(target, "package.json"),
      JSON.stringify({ name: "picomatch", version: "4.0.7" }),
    );
    await assert.rejects(
      checkPhysicalPackageInventory(directory, new Set(["picomatch@4.0.7"])),
      /Build-only picomatch must not ship at runtime/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
