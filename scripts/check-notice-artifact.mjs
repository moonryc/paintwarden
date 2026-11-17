import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repository = path.resolve(import.meta.dirname, "..");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function files(directory, prefix = "", strict = true) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, item.name);
    if (item.isDirectory()) result.push(...(await files(path.join(directory, item.name), relative, strict)));
    else {
      assert.ok(
        item.isFile() || (!strict && item.isSymbolicLink()),
        `Unexpected symlink/special file in artifact: ${relative}`,
      );
      result.push(relative);
    }
  }
  return result.sort();
}

export async function checkNoticeCopies(destination, root = repository) {
  for (const file of ["LICENSE", "THIRD_PARTY_NOTICES.txt"]) {
    assert.equal(
      hash(await readFile(path.join(destination, file))),
      hash(await readFile(path.join(root, file))),
      `Stale or modified ${file}`,
    );
  }
  const expected = await files(path.join(root, "third-party"));
  assert.ok(expected.length > 0, "Source third-party inventory is empty");
  assert.deepEqual(
    await files(path.join(destination, "third-party")),
    expected,
    "Incomplete third-party inventory",
  );
  for (const file of expected) {
    assert.equal(
      hash(await readFile(path.join(destination, "third-party", file))),
      hash(await readFile(path.join(root, "third-party", file))),
      `Stale or modified third-party/${file}`,
    );
  }
  assert.ok(
    (await readFile(path.join(destination, "third-party/runtime/node-LICENSE.txt"))).length > 0,
    "Missing Node license",
  );
}

const cString = (buffer, offset) => buffer.toString("utf8", offset, buffer.indexOf(0, offset));

// Read the actual dynamic-loader tables, rather than accepting a filename or a
// coincidental 'libvips' string in a statically linked binary. Works cross-host,
// without requiring Visual Studio dumpbin or binutils in the Docker image.
export function dynamicLibraries(buffer) {
  const magic = buffer.readUInt32LE(0);
  if (magic === 0xfeedfacf || magic === 0xfeedface) {
    const imports = [];
    let offset = magic === 0xfeedfacf ? 32 : 28;
    for (let i = 0; i < buffer.readUInt32LE(16); i++) {
      const command = buffer.readUInt32LE(offset) & 0x7fffffff;
      const size = buffer.readUInt32LE(offset + 4);
      assert.ok(size >= 8 && offset + size <= buffer.length, "Invalid Mach-O load command");
      if ([0xc, 0x18, 0x1f, 0x23].includes(command))
        imports.push(cString(buffer, offset + buffer.readUInt32LE(offset + 8)));
      offset += size;
    }
    return imports;
  }
  if (buffer.toString("ascii", 0, 4) === "\x7fELF") {
    assert.equal(buffer[5], 1, "Only little-endian ELF is supported");
    const wide = buffer[4] === 2;
    const word = (offset) => (wide ? Number(buffer.readBigUInt64LE(offset)) : buffer.readUInt32LE(offset));
    const phoff = word(wide ? 32 : 28);
    const phsize = buffer.readUInt16LE(wide ? 54 : 42);
    const phnum = buffer.readUInt16LE(wide ? 56 : 44);
    const segments = [];
    for (let i = 0; i < phnum; i++) {
      const p = phoff + i * phsize;
      segments.push({
        type: buffer.readUInt32LE(p),
        offset: word(p + (wide ? 8 : 4)),
        address: word(p + (wide ? 16 : 8)),
        size: word(p + (wide ? 32 : 16)),
      });
    }
    const dynamic = segments.find((segment) => segment.type === 2);
    assert.ok(dynamic, "ELF has no dynamic loader table");
    const needed = [];
    let strings;
    for (let p = dynamic.offset; p < dynamic.offset + dynamic.size; p += wide ? 16 : 8) {
      const type = word(p);
      const value = word(p + (wide ? 8 : 4));
      if (type === 0) break;
      if (type === 1) needed.push(value);
      if (type === 5) strings = value;
    }
    const load = segments.find(
      (segment) =>
        segment.type === 1 && strings >= segment.address && strings < segment.address + segment.size,
    );
    assert.ok(load, "ELF dynamic string table is missing");
    return needed.map((offset) => cString(buffer, load.offset + strings - load.address + offset));
  }
  if (buffer.toString("ascii", 0, 2) === "MZ") {
    const pe = buffer.readUInt32LE(0x3c);
    assert.equal(buffer.toString("ascii", pe, pe + 4), "PE\0\0", "Invalid PE signature");
    const optional = pe + 24;
    const sections = optional + buffer.readUInt16LE(pe + 20);
    const rvaOffset = (rva) => {
      for (let i = 0; i < buffer.readUInt16LE(pe + 6); i++) {
        const s = sections + i * 40;
        const start = buffer.readUInt32LE(s + 12);
        const size = Math.max(buffer.readUInt32LE(s + 8), buffer.readUInt32LE(s + 16));
        if (rva >= start && rva < start + size) return buffer.readUInt32LE(s + 20) + rva - start;
      }
      throw new Error(`Unmapped PE import RVA ${rva}`);
    };
    const data = optional + (buffer.readUInt16LE(optional) === 0x20b ? 112 : 96);
    const imports = [];
    const table = buffer.readUInt32LE(data + 8);
    if (!table) return imports;
    for (let p = rvaOffset(table); buffer.readUInt32LE(p + 12); p += 20)
      imports.push(cString(buffer, rvaOffset(buffer.readUInt32LE(p + 12))));
    return imports;
  }
  throw new Error("Unrecognized native binary (expected Mach-O, ELF or PE)");
}

const isPackageManifest = (file) =>
  /(?:^|\/)node_modules\/(?:@[^/]+\/)?[^/]+\/package\.json$/.test(file.replaceAll("\\", "/"));

function assertInventoried(manifest, location, inventory) {
  // GHSA-fc5q-39xc-vjpf is exempt only for trusted build tooling. A newly
  // shipped runtime copy must fail even if its license is already inventoried.
  assert.notEqual(manifest.name, "picomatch", `Build-only picomatch must not ship at runtime (${location})`);
  const own =
    manifest.private === true && (manifest.name === "paintwarden" || /^paintwarden-/.test(manifest.name));
  assert.ok(
    own || inventory.has(`${manifest.name}@${manifest.version}`),
    `Shipped npm package is missing from reviewed notice inventory: ${manifest.name}@${manifest.version} (${location})`,
  );
}

export async function checkPhysicalPackageInventory(directory, inventory) {
  let count = 0;
  for (const file of await files(directory, "", false)) {
    if (!isPackageManifest(file)) continue;
    assertInventoried(JSON.parse(await readFile(path.join(directory, file), "utf8")), file, inventory);
    count++;
  }
  return count;
}

async function checkAsarInventory(archive, inventory) {
  // Use the archive reader already pinned through electron-builder. This also
  // reads unpacked package manifests referenced by the actual ASAR header.
  const { listPackage, extractFile, uncache } = await import("@electron/asar");
  uncache(archive);
  let count = 0;
  for (const file of listPackage(archive)) {
    assert.ok(!/\.wasm$/i.test(file), `Unreviewed physical WASM binary must not ship in app.asar: ${file}`);
    if (file.replaceAll("\\", "/") !== "/package.json" && !isPackageManifest(file)) continue;
    assertInventoried(
      JSON.parse(extractFile(archive, file.replace(/^[\\/]+/, "")).toString("utf8")),
      `app.asar:${file}`,
      inventory,
    );
    count++;
  }
  assert.ok(count > 0, "Packaged app.asar has no package manifests");
  return count;
}

async function checkNativeServer(server) {
  const inventory = await files(server, "", false);
  assert.ok(
    !inventory.some((file) => /(?:^|[/\\])sharp-(?:freebsd-|webcontainers-)?wasm32(?:[/\\-]|$)/i.test(file)),
    "Unused sharp WASM fallback must not ship (static LGPL binary)",
  );
  assert.ok(
    !inventory.some((file) => /\.wasm$/i.test(file)),
    "Unreviewed physical WASM binary must not ship",
  );
  const addons = inventory.filter((file) => /sharp.*\.node$/.test(path.basename(file)));
  assert.ok(addons.length > 0, "Missing native sharp addon");
  const libraries = inventory.filter((file) =>
    /(?:lib)?vips.*(?:\.dylib|\.dll|\.so(?:\.\d+)*)$/i.test(path.basename(file)),
  );
  assert.ok(libraries.length > 0, "Missing separate replaceable libvips dylib/dll/so");
  for (const library of libraries) {
    const binary = await readFile(path.join(server, library));
    dynamicLibraries(binary); // Reject text placeholders and unrecognized binaries.
    const magic = binary.readUInt32LE(0);
    if (magic === 0xfeedfacf || magic === 0xfeedface)
      assert.equal(binary.readUInt32LE(12), 6, "libvips must be a Mach-O dylib");
    else if (binary.toString("ascii", 0, 4) === "\x7fELF")
      assert.equal(binary.readUInt16LE(16), 3, "libvips must be an ELF shared object");
    else assert.ok(binary.readUInt16LE(binary.readUInt32LE(0x3c) + 22) & 0x2000, "libvips must be a PE DLL");
  }
  for (const addon of addons) {
    const imports = dynamicLibraries(await readFile(path.join(server, addon)));
    const vipsImports = imports.filter((name) => /(?:lib)?vips/i.test(name));
    assert.ok(
      vipsImports.length > 0 &&
        vipsImports.every((name) =>
          libraries.some(
            (file) => path.basename(file).toLowerCase() === name.split(/[\\/]/).at(-1).toLowerCase(),
          ),
        ),
      `Native addon does not dynamically load the shipped libvips: ${addon}`,
    );
  }
  return { addons, libraries };
}

export async function checkNoticeArtifact({ resources, dockerRoot, webRoot, root = repository }) {
  const destination = resources || dockerRoot || webRoot;
  assert.ok(destination, "An artifact directory is required");
  await checkNoticeCopies(destination, root);
  if (webRoot) {
    assert.ok(
      !(await files(webRoot, "", false)).some((file) => /\.wasm$/i.test(file)),
      "Unreviewed physical WASM binary must not ship in web output",
    );
    return { webRoot };
  }
  if (resources) {
    await checkNoticeCopies(path.join(resources, "web-dist"), root);
    await checkNoticeCopies(path.join(resources, "server", "web-dist"), root);
  } else {
    await checkNoticeCopies(path.join(dockerRoot, "apps", "paintwarden", "dist", "web-dist"), root);
  }
  const server = resources ? path.join(resources, "server") : dockerRoot;
  const native = await checkNativeServer(server);
  const reviewed = JSON.parse(await readFile(path.join(root, "third-party/inventory.json"), "utf8"));
  const inventory = new Set(reviewed.packages.map((item) => `${item.name}@${item.version}`));
  native.npmPackages = await checkPhysicalPackageInventory(server, inventory);
  if (resources) {
    native.asarPackages = await checkAsarInventory(path.join(resources, "app.asar"), inventory);
    // Permit cross-host inspection of Windows artifacts on macOS and vice versa.
    const nodes = await Promise.all(
      ["node", "node.exe"].map((name) => lstat(path.join(server, name)).catch(() => null)),
    );
    assert.ok(
      nodes.some((stat) => stat?.isFile()),
      "Missing bundled Node runtime",
    );
    const chromium = [
      path.join(resources, "LICENSES.chromium.html"),
      path.join(resources, "..", "LICENSES.chromium.html"),
      path.join(
        resources,
        "..",
        "Frameworks",
        "Electron Framework.framework",
        "Versions",
        "A",
        "Resources",
        "LICENSES.chromium.html",
      ),
      path.join(
        resources,
        "..",
        "Frameworks",
        "Electron Framework.framework",
        "Resources",
        "LICENSES.chromium.html",
      ),
    ];
    let found = false;
    for (const file of chromium) {
      const bytes = await readFile(file).catch(() => null);
      if (bytes && bytes.length > 1000 && /<html|<!doctype/i.test(bytes.toString("utf8"))) found = true;
    }
    assert.ok(found, "Missing actual Electron LICENSES.chromium.html outside app.asar");
  }
  return native;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {};
  const keys = {
    "--resources": "resources",
    "--docker-root": "dockerRoot",
    "--web-root": "webRoot",
    "--root": "root",
  };
  for (let i = 2; i < process.argv.length; i += 2) {
    assert.ok(
      keys[process.argv[i]] && process.argv[i + 1],
      "Usage: node scripts/check-notice-artifact.mjs (--resources <resources> | --docker-root <app> | --web-root <dist>) [--root <repo>]",
    );
    options[keys[process.argv[i]]] = path.resolve(process.argv[i + 1]);
  }
  assert.equal(
    [options.resources, options.dockerRoot, options.webRoot].filter(Boolean).length,
    1,
    "Select exactly one artifact kind",
  );
  console.log("Verified packaged third-party notices:", await checkNoticeArtifact(options));
}
