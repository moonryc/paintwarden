import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile, mkdtemp, realpath } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const allowed = new Set([
  "MIT",
  "Apache-2.0",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "BlueOak-1.0.0",
  "Python-2.0",
  "CC0-1.0",
  "OFL-1.1",
  "LGPL-3.0-or-later",
  "MPL-2.0",
  "Apache-2.0 AND LGPL-3.0-or-later AND MIT",
  "Apache-2.0 AND LGPL-3.0-or-later",
]);
export function classify(license) {
  if (/(^|[^A-Z])(?:A?GPL)-/i.test(license)) throw new Error(`Forbidden copyleft license: ${license}`);
  if (!allowed.has(license)) throw new Error(`Unclassified license: ${license}`);
  return license.includes("LGPL")
    ? "library-copyleft"
    : license.includes("MPL")
      ? "file-copyleft"
      : license.includes("OFL")
        ? "font"
        : "permissive";
}
export function lockedPackages(lock) {
  // Deliberately conservative: all non-dev lock locations cover server, renderer, desktop,
  // site and every optional platform; also cover build tools physically copied by staging.
  const physical =
    /(?:^|\/)node_modules\/(?:tsx|typescript|esbuild|@esbuild\/[^/]+|fsevents|resolve-pkg-maps)$/;
  return Object.entries(lock.packages)
    .filter(
      ([location, p]) => location.includes("node_modules/") && !p.link && (!p.dev || physical.test(location)),
    )
    .map(([location, p]) => {
      const name = p.name ?? location.split("node_modules/").at(-1);
      const license = p.license ?? (["busboy", "streamsearch"].includes(name) ? "MIT" : "UNKNOWN");
      return {
        location,
        name,
        version: p.version,
        integrity: p.integrity,
        resolved: p.resolved,
        license,
        classification: classify(license),
      };
    })
    .sort((a, b) => a.location.localeCompare(b.location, "en"));
}
export async function filesUnder(dir, prefix = "") {
  const result = [];
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  )) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) result.push(...(await filesUnder(path.join(dir, entry.name), relative + "/")));
    else if (entry.isFile()) result.push(relative);
  }
  return result;
}
const key = (p) => `${p.name.replaceAll("/", "__")}@${p.version}`;
async function refreshNpm(packages) {
  const unique = [...new Map(packages.map((p) => [key(p), p])).values()];
  const upstream = JSON.parse(
    await readFile(path.join(root, "third-party/upstream-npm.json"), "utf8").catch(() => "{}"),
  );
  let next = 0;
  async function worker() {
    while (next < unique.length) {
      const p = unique[next++];
      if (!p.integrity || !p.resolved?.startsWith("https://"))
        throw new Error(`Missing integrity/HTTPS source: ${key(p)}`);
      const response = await fetch(p.resolved);
      if (!response.ok) throw new Error(`${p.resolved}: ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const [algorithm, digest] = p.integrity.split("-");
      if (createHash(algorithm).update(bytes).digest("base64") !== digest)
        throw new Error(`Integrity failure ${key(p)}`);
      const temp = await mkdtemp(path.join(os.tmpdir(), "paintwarden-notices-"));
      try {
        await writeFile(path.join(temp, "source.tgz"), bytes);
        // List and extract only notice material, never package code or install scripts.
        const listing = spawnSync("tar", ["-tzf", path.join(temp, "source.tgz")], {
          encoding: "utf8",
          maxBuffer: 32 * 1024 * 1024,
        });
        if (listing.status !== 0) throw new Error(listing.stderr);
        const names = listing.stdout
          .split("\n")
          .filter(
            (name) =>
              !name.endsWith("/") &&
              !name.includes("..") &&
              (/(?:^|\/)(?:licen[cs]e[^/]*|copying[^/]*|copyright[^/]*|notice[^/]*|third[-_]party[-_]notices[^/]*|authors)(?:\.[^/]*)?$/i.test(
                name,
              ) ||
                (p.name.startsWith("@img/sharp-") && /^package\/(README\.md|versions\.json)$/.test(name))),
          );
        if (!names.length) {
          // Some packages put their full license grant only in README.
          names.push(
            ...listing.stdout
              .split("\n")
              .filter((n) => /^package\/readme(?:\.md|\.markdown|\.txt)?$/i.test(n)),
          );
        }
        if (!names.length && p.name.startsWith("@img/sharp-")) names.push("package/README.md");
        const destination = path.join(root, "third-party/npm", key(p));
        await rm(destination, { recursive: true, force: true });
        await mkdir(destination, { recursive: true });
        if (!names.length) {
          const metadataResponse = await fetch(`https://registry.npmjs.org/${p.name}/${p.version}`);
          if (!metadataResponse.ok) throw new Error(`Cannot obtain exact upstream for ${key(p)}`);
          const metadata = await metadataResponse.json();
          const repository = (metadata.repository?.url ?? "").match(
            /github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/,
          )?.[1];
          if (!repository || !/^[a-f0-9]{40}$/.test(metadata.gitHead ?? ""))
            throw new Error(`No pinned upstream license for ${key(p)}`);
          let found = false;
          for (const filename of [
            "LICENSE",
            "LICENSE.md",
            "LICENSE.txt",
            "LICENSE-MIT",
            "license",
            "License.md",
          ]) {
            const url =
              upstream[key(p)]?.url ??
              `https://raw.githubusercontent.com/${repository}/${metadata.gitHead}/${filename}`;
            const response = await fetch(url);
            if (!response.ok) continue;
            const text = await response.text();
            if (!text.includes("ermission") && !text.includes("Apache License")) continue;
            const hash = sha256(text);
            if (upstream[key(p)] && upstream[key(p)].sha256 !== hash)
              throw new Error(`Upstream license changed: ${key(p)}`);
            upstream[key(p)] = { url, sha256: hash };
            await writeFile(path.join(destination, "UPSTREAM-LICENSE.txt"), text);
            found = true;
            break;
          }
          if (!found)
            throw new Error(`No license grant in ${key(p)}; obtain upstream text and classify explicitly`);
        }
        for (const name of names.sort()) {
          const result = spawnSync("tar", ["-xzOf", path.join(temp, "source.tgz"), name], {
            maxBuffer: 32 * 1024 * 1024,
          });
          if (result.status !== 0) throw new Error(`Cannot read ${key(p)} ${name}`);
          await writeFile(
            path.join(destination, name.replace(/^package\//, "").replaceAll("/", "__")),
            result.stdout,
          );
        }
      } finally {
        await rm(temp, { recursive: true, force: true });
      }
      console.log(`Collected ${key(p)}`);
    }
  }
  try {
    await Promise.all(Array.from({ length: 6 }, worker));
    const current = new Set(unique.map(key));
    for (const entry of await readdir(path.join(root, "third-party/npm"))) {
      if (!current.has(entry))
        await rm(path.join(root, "third-party/npm", entry), { recursive: true, force: true });
    }
    for (const name of Object.keys(upstream)) if (!current.has(name)) delete upstream[name];
  } finally {
    await writeFile(
      path.join(root, "third-party/upstream-npm.json"),
      JSON.stringify(upstream, null, 2) + "\n",
    );
  }
}
export async function generate({ refresh = false, check = false } = {}) {
  const lockBytes = await readFile(path.join(root, "package-lock.json"));
  const packages = lockedPackages(JSON.parse(lockBytes));
  if (refresh) await refreshNpm(packages);
  const sourceManifest = JSON.parse(await readFile(path.join(root, "third-party/sources.json"), "utf8"));
  const nativeVersions = new Set(
    packages.filter((p) => p.name.startsWith("@img/sharp-libvips-")).map((p) => p.version),
  );
  if (nativeVersions.size !== 1 || !nativeVersions.has(sourceManifest.sharpLibvipsVersion))
    throw new Error("Native sources must be reviewed for new sharp-libvips version");
  const electron = JSON.parse(lockBytes).packages["node_modules/electron"]?.version;
  const node = (await readFile(path.join(root, ".nvmrc"), "utf8")).trim().replace(/^v/, "");
  if (sourceManifest.nodeVersion !== node || sourceManifest.electronVersion !== electron)
    throw new Error("Runtime notices need exact-version refresh");
  const allFiles = (await filesUnder(path.join(root, "third-party"))).filter((f) => f !== "inventory.json");
  const hashes = {};
  for (const file of allFiles) hashes[file] = sha256(await readFile(path.join(root, "third-party", file)));
  for (const source of sourceManifest.files)
    if (hashes[source.path] !== source.sha256)
      throw new Error(`Reviewed source changed/missing: ${source.path}`);
  for (const p of packages) {
    p.files = allFiles.filter((f) => f.startsWith(`npm/${key(p)}/`));
    if (!p.files.length)
      throw new Error(
        `Missing package license material: ${key(p)}; run npm run notices:generate -- --refresh`,
      );
  }
  const inventory = {
    schema: 1,
    lockSha256: sha256(lockBytes),
    scope:
      "All non-dev locked npm locations (including site build tools and all OS/CPU options), plus tools physically copied by server staging. Not every listed component ships on every platform. WASM options are inventoried but deliberately excluded from native desktop/Docker artifacts.",
    packages,
    files: hashes,
  };
  let text = await readFile(path.join(root, "third-party/README.txt"), "utf8");
  for (const p of [...new Map(packages.map((p) => [key(p), p])).values()]) {
    text += `\n\n${"=".repeat(72)}\n${p.name} ${p.version}\nLicense: ${p.license}\nSource: ${p.resolved}\n`;
    for (const file of p.files)
      text += `\n--- ${file} ---\n${await readFile(path.join(root, "third-party", file), "utf8")}\n`;
  }
  for (const file of allFiles.filter((f) => /^(native|runtime)\//.test(f))) {
    let content = await readFile(path.join(root, "third-party", file), "utf8");
    if (file.endsWith(".html"))
      content = content
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<(?:br|\/p|\/div|\/h[1-6])[^>]*>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
    text += `\n\n${"=".repeat(72)}\n${file}\n${content}\n`;
  }
  const outputs = [
    ["third-party/inventory.json", JSON.stringify(inventory, null, 2) + "\n"],
    ["THIRD_PARTY_NOTICES.txt", text],
  ];
  for (const [file, content] of outputs) {
    if (check) {
      if ((await readFile(path.join(root, file), "utf8")) !== content)
        throw new Error(`Stale ${file}: run npm run notices:generate`);
    } else await writeFile(path.join(root, file), content);
  }
  console.log(
    `Notices ${check ? "verified" : "generated"}: ${packages.length} locked locations, ${allFiles.length} source files`,
  );
}
if (process.argv[1] && (await realpath(process.argv[1])) === fileURLToPath(import.meta.url)) {
  await generate({ refresh: process.argv.includes("--refresh"), check: process.argv.includes("--check") });
}
