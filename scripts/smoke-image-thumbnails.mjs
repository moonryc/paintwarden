#!/usr/bin/env node
// Focused packaged-runtime image smoke, not an exhaustive desktop controls sweep.
// Node 22.22.2: ... native EVIDENCE_DIR [packaged executable]
// ... docker EVIDENCE_DIR IMAGE (already-built image; offline, no host port).
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { unzipSync } from "fflate";
import { _electron as electron } from "playwright";
import sharp from "sharp";

import { identity } from "./smoke-library-native.mjs";

assert.equal(process.version, "v22.22.2");
const root = path.resolve(import.meta.dirname, "..");
const [
  mode,
  evidence,
  target = path.join(root, "dist/electron/mac-arm64/Paintwarden.app/Contents/MacOS/Paintwarden"),
] = process.argv.slice(2);
assert.ok(evidence);
await mkdir(evidence, { recursive: true });
const fixture = JSON.parse(await readFile(path.join(evidence, "photo-fixture.json"), "utf8"));
const photo = await readFile(path.join(fixture.dataDir, "images", fixture.photos[0].key));

// Runs unchanged in the actual Electron renderer or in the offline Docker Node runtime.
async function imageScenario({ base, photoBase64 }) {
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const hash = async (bytes) =>
    [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
  const toBase64 = (bytes) => {
    let value = "";
    for (let start = 0; start < bytes.length; start += 16384)
      value += String.fromCharCode(...bytes.subarray(start, start + 16384));
    return btoa(value);
  };
  const bytes = Uint8Array.from(atob(photoBase64), (character) => character.charCodeAt(0));
  const setup = await fetch(`${base}/api/auth/setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "thumbnail-smoke", password: "isolated-synthetic-smoke-password" }),
  });
  check(setup.status === 200, `setup ${setup.status}`);
  const { token } = await setup.json();
  const headers = { authorization: `Bearer ${token}` };
  const created = await fetch(`${base}/api/miniatures`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ title: "Thumbnail smoke miniature", status: "OWNED" }),
  });
  check(created.status === 201, `create ${created.status}`);
  const { id } = await created.json();
  const form = new FormData();
  form.set("image", new Blob([bytes], { type: "image/jpeg" }), "synthetic-camera-photo.jpg");
  const upload = await fetch(`${base}/api/miniatures/${id}/image`, { method: "POST", headers, body: form });
  check(upload.status === 200, `upload ${upload.status}`);
  const { imageUrl } = await upload.json();
  const scope = upload.headers.get("x-paintwarden-image-scope");
  const variants = [];
  for (const width of [160, 320, 640]) {
    const url = new URL(imageUrl, base);
    url.searchParams.set("w", String(width));
    if (scope) url.searchParams.set("_pv_scope", scope);
    const response = await fetch(url, { headers });
    check(response.status === 200, `thumbnail ${width}: ${response.status}`);
    check(response.headers.get("content-type") === "image/webp", "WebP type");
    check(response.headers.get("cache-control").includes("immutable"), "immutable cache survives proxy");
    const body = new Uint8Array(await response.arrayBuffer());
    const repeated = await fetch(url, { headers });
    check((await hash(await repeated.arrayBuffer())) === (await hash(body)), "cached response identical");
    variants.push({
      width,
      bytes: body.length,
      cacheControl: response.headers.get("cache-control"),
      base64: toBase64(body),
    });
  }
  const original = await fetch(new URL(imageUrl, base), { headers });
  check(original.status === 200, "original served");
  check((await hash(await original.arrayBuffer())) === (await hash(bytes)), "original bytes exact");
  const backup = await fetch(`${base}/api/backup`, { headers });
  check(backup.status === 200, "backup export");
  const zip = new Uint8Array(await backup.arrayBuffer());
  const removed = await fetch(`${base}/api/miniatures/${id}/image`, { method: "DELETE", headers });
  check(removed.status === 200, "remove photo");
  const missing = await fetch(new URL(`${imageUrl}&probe=deleted`, base), { headers });
  check(missing.status === 404, "deleted original unavailable");
  const restored = await fetch(`${base}/api/backup?mode=replace`, { method: "POST", headers, body: zip });
  check(restored.status === 200, `restore ${restored.status}`);
  const restoredUrl = new URL(`${imageUrl}&w=320&probe=restored`, base);
  if (scope) restoredUrl.searchParams.set("_pv_scope", scope);
  const restoredThumb = await fetch(restoredUrl, { headers });
  check(restoredThumb.status === 200, "restored lazy thumbnail");
  check(
    (await hash(await restoredThumb.arrayBuffer())) ===
      (await hash(Uint8Array.from(atob(variants[1].base64), (c) => c.charCodeAt(0)))),
    "lazy output identical",
  );
  const restoredOriginal = await fetch(new URL(`${imageUrl}&probe=restored`, base), { headers });
  check((await hash(await restoredOriginal.arrayBuffer())) === (await hash(bytes)), "restored original hash");
  return {
    id,
    imageUrl,
    scopePresent: Boolean(scope),
    originalBytes: bytes.length,
    originalSha256: await hash(bytes),
    variants,
    backupBase64: toBase64(zip),
    restored: true,
  };
}

async function verify(result) {
  for (const variant of result.variants) {
    const metadata = await sharp(Buffer.from(variant.base64, "base64")).metadata();
    assert.equal(metadata.width, variant.width);
    assert.equal(metadata.format, "webp");
    delete variant.base64;
  }
  const backup = Buffer.from(result.backupBase64, "base64");
  await writeFile(path.join(evidence, `${mode}-roundtrip.zip`), backup);
  const entries = unzipSync(backup);
  assert.ok(!Object.keys(entries).some((key) => key.includes("thumb-v")));
  const manifest = JSON.parse(Buffer.from(entries["backup.json"]).toString());
  assert.equal(Object.keys(manifest.tables).length, 19);
  const originals = Object.entries(entries).filter(([key]) => key.startsWith("images/"));
  assert.equal(originals.length, 1);
  assert.equal(createHash("sha256").update(originals[0][1]).digest("hex"), result.originalSha256);
  delete result.backupBase64;
  return { ...result, backupBytes: backup.length, backupSections: 19, backupIncludesDerivatives: false };
}

const report = {
  mode,
  startedAt: new Date().toISOString(),
  node: process.version,
  scope:
    "Focused actual-runtime upload/three variants/cache/full-original/delete/backup/replace/lazy-regeneration checks; not signing/Windows/x64 certification or an exhaustive UI sweep.",
};
try {
  if (mode === "native") {
    assert.equal(process.platform, "darwin");
    const data = await mkdtemp(path.join(os.tmpdir(), "paint-thumbnails-native-"));
    await writeFile(
      path.join(data, "client-connection.json"),
      JSON.stringify({ mode: "local", language: "en" }),
    );
    report.dataDirectory = data;
    report.executable = await identity(target);
    const resources = path.resolve(target, "../../Resources");
    report.server = await identity(path.join(resources, "server/server.mjs"));
    report.nativeDependencies = JSON.parse(
      execFileSync(
        path.join(resources, "server/node"),
        [
          "-e",
          "const sharp=require('sharp');console.log(JSON.stringify({sharp:require.resolve('sharp'),versions:sharp.versions,binding:Object.keys(require.cache).find(filename=>filename.endsWith('.node')&&filename.includes('sharp'))}))",
        ],
        { cwd: path.join(resources, "server"), encoding: "utf8" },
      ),
    );
    assert.ok(report.nativeDependencies.sharp.startsWith(path.join(resources, "server/node_modules")));
    assert.ok(report.nativeDependencies.binding?.startsWith(path.join(resources, "server/node_modules")));
    report.nativeAddon = await identity(report.nativeDependencies.binding);
    let app;
    try {
      app = await electron.launch({
        executablePath: target,
        env: {
          ...process.env,
          DATA_DIR: "",
          DATABASE_PATH: "",
          PAINTWARDEN_DESKTOP_DATA_DIR: data,
          PAINTWARDEN_DISABLE_UPDATES: "1",
        },
        timeout: 60000,
      });
      report.packaged = await app.evaluate(({ app }) => ({
        isPackaged: app.isPackaged,
        appPath: app.getAppPath(),
      }));
      assert.equal(report.packaged.isPackaged, true);
      assert.match(report.packaged.appPath, /app\.asar$/);
      const page = await app.firstWindow();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.waitForURL("paintwarden://app/");
      await page.waitForFunction(async () => (await fetch("/api/auth/status")).ok);
      const result = await page.evaluate(imageScenario, {
        base: "paintwarden://app",
        photoBase64: photo.toString("base64"),
      });
      report.result = await verify(result);
      // Restore did not need archived derivatives; force one more disk-cache miss in
      // the live packaged server, using a fresh proxy key to avoid its memory cache.
      const files = await readdir(path.join(data, "images"));
      const thumb = files.find((name) => name.endsWith(".thumb-v1-160.webp"));
      assert.ok(!thumb, "replace restored original only; only requested 320 has regenerated");
      await page.reload();
      await page.getByText("Thumbnail smoke miniature", { exact: true }).first().waitFor();
      await page.waitForFunction(() =>
        [...document.images].some(
          (img) => img.currentSrc.includes("w=") && img.complete && img.naturalWidth > 0,
        ),
      );
      report.listImages = await page.locator("img[srcset]").evaluateAll((images) =>
        images.map((img) => ({
          src: img.currentSrc,
          naturalWidth: img.naturalWidth,
          loading: img.loading,
          decoding: img.decoding,
        })),
      );
      assert.ok(report.listImages.length > 0);
      assert.ok(
        report.listImages.every(
          (img) =>
            img.src.includes("_pv_scope=") &&
            img.naturalWidth <= 640 &&
            img.loading === "lazy" &&
            img.decoding === "async",
        ),
      );
      await page.screenshot({ path: path.join(evidence, "native-home.png") });
      assert.deepEqual(errors, []);
      report.rendererErrors = errors;
      await app.close();
      app = undefined;
      app = await electron.launch({
        executablePath: target,
        env: {
          ...process.env,
          DATA_DIR: "",
          DATABASE_PATH: "",
          PAINTWARDEN_DESKTOP_DATA_DIR: data,
          PAINTWARDEN_DISABLE_UPDATES: "1",
        },
        timeout: 60000,
      });
      const relaunched = await app.firstWindow();
      await relaunched.waitForURL("paintwarden://app/");
      await relaunched.waitForFunction(async () => (await fetch("/api/auth/status")).ok);
      const loginStatus = await relaunched.evaluate(
        async () =>
          (
            await fetch("/api/auth/login", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                username: "thumbnail-smoke",
                password: "isolated-synthetic-smoke-password",
              }),
            })
          ).status,
      );
      assert.equal(loginStatus, 200);
      await relaunched.reload();
      await relaunched.getByText("Thumbnail smoke miniature", { exact: true }).first().waitFor();
      report.intentionalRelaunch = "PASS";
    } finally {
      await app?.close();
    }
  } else if (mode === "docker") {
    const program = `import sharp from 'sharp'; import {unzipSync} from 'fflate'; import assert from 'node:assert/strict'; process.env.HOST='127.0.0.1'; process.env.NODE_ENV='test'; const {startServer}=await import('./dist/server.mjs');process.env.NODE_ENV='production'; await startServer(); const scenario=${imageScenario.toString()}; const result=await scenario({base:'http://127.0.0.1:3000',photoBase64:${JSON.stringify(photo.toString("base64"))}}); for(const variant of result.variants){const m=await sharp(Buffer.from(variant.base64,'base64')).metadata();assert.equal(m.width,variant.width);assert.equal(m.format,'webp');} await new Promise(resolve=>process.stdout.write('THUMBNAIL_RESULT '+JSON.stringify(result)+'\\n',resolve));process.exit(0);`;
    const child = spawn(
      "docker",
      [
        "run",
        "--rm",
        "-i",
        "--network",
        "none",
        "--tmpfs",
        "/data:uid=1000,gid=1000,mode=700",
        "--entrypoint",
        "node",
        target,
        "--input-type=module",
        "-",
      ],
      { cwd: root, stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.stdin.end(program);
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
    await writeFile(
      path.join(evidence, "docker-smoke.log"),
      stdout.replace(
        /^THUMBNAIL_RESULT .*$/m,
        "THUMBNAIL_RESULT [binary bodies verified; see results JSON]",
      ) + stderr,
    );
    assert.equal(code, 0, stderr + stdout.slice(-3000));
    const result = JSON.parse(
      stdout
        .split("\n")
        .find((line) => line.startsWith("THUMBNAIL_RESULT "))
        .slice(17),
    );
    report.image = target;
    report.result = await verify(result);
    report.network = "none, no host ports, uid1000 tmpfs data";
  } else throw new Error("Expected native or docker");
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await writeFile(path.join(evidence, `${mode}-results.json`), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
