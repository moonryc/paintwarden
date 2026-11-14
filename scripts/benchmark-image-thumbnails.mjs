#!/usr/bin/env node
// Isolated production browser comparison. Never builds or opens a personal vault.
// node scripts/benchmark-image-thumbnails.mjs seed
// node scripts/benchmark-image-thumbnails.mjs measure baseline /tmp/paint-thumbnails-baseline/dist 3218
// node scripts/benchmark-image-thumbnails.mjs measure after apps/paint-vault/dist 3219
// node scripts/benchmark-image-thumbnails.mjs verify after apps/paint-vault/dist 3219
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { chromium } from "playwright";
import sharp from "sharp";

import { identity, launchOwned, stopOwned, waitForOutput } from "./smoke-library-native.mjs";

assert.equal(process.version, "v22.22.2", "Use pinned Node");
const root = fileURLToPath(new URL("..", import.meta.url));
const evidence = path.resolve(root, "../../paint-tracker-audit/thumbnails");
await mkdir(evidence, { recursive: true });
const fixturePath = path.join(evidence, "photo-fixture.json");
const mode = process.argv[2];
if (mode === "seed") {
  const baselinePath = path.join(evidence, "large-fixture.json");
  execFileSync(process.execPath, ["--import", "tsx", "../../scripts/seed-benchmark-vault.mts", "large"], {
    cwd: path.join(root, "apps/paint-vault"),
    env: { ...process.env, BENCH_REPORT: baselinePath },
    stdio: "inherit",
    timeout: 120000,
  });
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const images = path.join(baseline.dataDir, "images");
  await mkdir(images, { recursive: true });
  const photos = [];
  const width = 2400,
    height = 1600;
  // Deterministic, textured color fields: detailed synthetic 3.84 MP JPEGs, not real photos.
  // No tiny fixture or solid-color compression advantage; no personal/catalog images.
  for (let photo = 0; photo < 32; photo++) {
    const pixels = Buffer.alloc(width * height * 3);
    let random = 0x12345678 + photo;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        random ^= random << 13;
        random ^= random >>> 17;
        random ^= random << 5;
        const detail = (random >>> 24) - 128;
        const wave = Math.sin(x / 90 + photo) * 22 + Math.cos(y / 73) * 18;
        const offset = (y * width + x) * 3;
        pixels[offset] = Math.max(0, Math.min(255, 90 + wave + detail * 0.7));
        pixels[offset + 1] = Math.max(0, Math.min(255, 120 + (y / height) * 40 + wave + detail * 0.55));
        pixels[offset + 2] = Math.max(0, Math.min(255, 150 + (x / width) * 35 - wave + detail * 0.6));
      }
    }
    const bytes = await sharp(pixels, { raw: { width, height, channels: 3 } })
      .jpeg({ quality: 92 })
      .toBuffer();
    const key = `${randomUUID()}.jpg`;
    await writeFile(path.join(images, key), bytes);
    photos.push({
      key,
      width,
      height,
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  const db = new Database(path.join(baseline.dataDir, "paint-vault.sqlite"));
  db.pragma("foreign_keys = ON");
  db.transaction(() => {
    for (const table of ["miniatures", "miniature_templates"]) {
      const update = db.prepare(`UPDATE ${table} SET image_key=? WHERE id=?`);
      db.prepare(`SELECT id FROM ${table} ORDER BY id`)
        .all()
        .forEach((row, index) => update.run(photos[index % photos.length].key, row.id));
    }
    const insert = db.prepare(
      "INSERT INTO color_scheme_images(id,scheme_id,image_url,thumbnail_url,sort_order) VALUES (?,?,?,?,0)",
    );
    db.prepare("SELECT id FROM color_schemes ORDER BY id")
      .all()
      .forEach((row, index) => {
        const url = `/api/catalog-source-images/${photos[index % photos.length].key}`;
        insert.run(randomUUID(), row.id, url, url);
      });
  })();
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
  const fixture = {
    ...baseline,
    photos,
    method:
      "Large exact synthetic baseline with all miniature/template images and one image per scheme; 32 distinct deterministic 3.84 MP textured JPEGs reused across rows. Isolated temporary vault; original seed retained.",
  };
  await writeFile(fixturePath, JSON.stringify(fixture, null, 2) + "\n");
  console.log(`Photo fixture: ${fixturePath}`);
} else if (mode === "measure" || mode === "verify") {
  const label = process.argv[3];
  const outputLabel = label + (mode === "verify" ? "-verify" : "");
  assert.ok(/^[a-z-]+$/.test(label));
  const dist = path.resolve(process.argv[4]);
  const port = Number(process.argv[5]);
  assert.ok(port > 3200 && port < 65535, "Never use normal development ports");
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  assert.ok(fixture.dataDir.startsWith(path.join(tmpdir(), "paint-vault-startup-")));
  const dataDir = await mkdtemp(path.join(tmpdir(), `paint-thumbnails-${label}-`));
  await cp(fixture.dataDir, dataDir, { recursive: true });
  await symlink(path.join(root, "node_modules"), path.join(dist, "node_modules"), "dir").catch((error) => {
    if (error.code !== "EEXIST") throw error;
  });
  const host = `thumbnails-${label}.localhost`;
  const base = `http://${host}:${port}`;
  const server = launchOwned(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'process.env.NODE_ENV="test"; const {startServer}=await import("./server.mjs"); process.env.NODE_ENV="production"; await startServer(); console.log("THUMBNAILS_READY");',
    ],
    {
      cwd: dist,
      env: {
        ...process.env,
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: String(port),
        DATA_DIR: dataDir,
        DATABASE_PATH: "",
        WEB_DIST: path.join(dist, "web-dist"),
        PAINT_VAULT_ALLOWED_HOSTS: host,
        PAINT_VAULT_DISABLE_UPDATES: "1",
      },
    },
    path.join(evidence, `${outputLabel}-server.log`),
  );
  const report = {
    measuredAt: new Date().toISOString(),
    node: process.version,
    label,
    base,
    dataDir,
    server: await identity(path.join(dist, "server.mjs")),
    web: await identity(path.join(dist, "web-dist/index.html")),
    fixture: fixturePath,
    method:
      "Single observation per view/viewport; fresh Chromium context per case (cold browser image cache, service workers blocked), same seeded photo bytes. Home is direct default document; Miniatures is entered via its normal navigation button from the supported #paints direct entry, so no Home images are loaded first. Miniatures timing excludes shell boot. Filesystem/OS caches not cold. API image body totals exclude HTTP headers and non-image resources. No scrolling; browser native lazy-loading may fetch near-viewport images; its threshold can vary between single observations. Derived caches start empty for each measurement run but subsequent cases share the server cache. Not a percentile or native Electron smoke test.",
    cases: [],
  };
  let browser;
  try {
    await waitForOutput(server, /THUMBNAILS_READY/, "isolated image benchmark server");
    const setup = await fetch(`http://127.0.0.1:${port}/api/auth/setup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "photo-benchmark", password: "synthetic-fixture-only-password" }),
    });
    assert.equal(setup.status, 200);
    const { token } = await setup.json();
    browser = await chromium.launch({
      headless: true,
      args: [`--host-resolver-rules=MAP ${host} 127.0.0.1`],
    });
    if (mode === "measure")
      for (const width of [1440, 390]) {
        for (const view of ["home", "miniatures"]) {
          const context = await browser.newContext({
            viewport: { width, height: 1000 },
            serviceWorkers: "block",
          });
          await context.addCookies([
            { name: "pv_session", value: token, url: base, httpOnly: true, sameSite: "Strict" },
          ]);
          const page = await context.newPage();
          if (view === "miniatures") {
            await page.goto(base + "/#paints");
            await page.getByRole("heading", { name: "Paints", exact: true, level: 2 }).waitFor();
            if (width < 1200)
              await page.getByRole("button", { name: "Open navigation", exact: true }).click();
          }
          const responses = [],
            pending = [],
            errors = [];
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("request", (request) => {
            const url = new URL(request.url());
            if (!url.pathname.startsWith("/api/") || request.resourceType() !== "image") return;
            pending.push(
              (async () => {
                const response = await request.response();
                assert.ok(response, `Image request failed: ${request.url()}`);
                assert.equal(response.status(), 200);
                const bytes = await response.body();
                const metadata = await sharp(bytes).metadata();
                responses.push({
                  path: url.pathname + url.search,
                  status: response.status(),
                  bytes: bytes.byteLength,
                  contentType: response.headers()["content-type"],
                  decodedWidth: metadata.width,
                  decodedHeight: metadata.height,
                });
              })(),
            );
          });
          const start = performance.now();
          if (view === "home") await page.goto(base + "/");
          else await page.getByRole("button", { name: "Miniatures", exact: true }).first().click();
          await page
            .getByRole("heading", {
              name: view === "home" ? "Workbench" : "Miniatures",
              exact: true,
              level: 2,
            })
            .waitFor();
          await page.getByRole("list", { name: "Miniature shelf", exact: true }).waitFor({ timeout: 30000 });
          await page.waitForFunction(
            () =>
              Number(
                document.querySelector('[aria-label="Miniature shelf"]')?.getAttribute("data-loaded-count"),
              ) > 0,
          );
          await page.waitForFunction(
            () => {
              const images = [...document.images].filter(
                (image) =>
                  image.src.includes("/api/") &&
                  image.getBoundingClientRect().top < innerHeight &&
                  image.getBoundingClientRect().bottom > 0,
              );
              return images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0);
            },
            undefined,
            { timeout: 60000 },
          );
          await page.evaluate(
            () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          );
          const firstScreenReadyMs = performance.now() - start;
          let completed = -1;
          while (completed !== pending.length) {
            completed = pending.length;
            await Promise.all(pending);
            await page.evaluate(
              () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
            );
          }
          assert.ok(responses.length > 0);
          assert.deepEqual(errors, []);
          const visible = await page.evaluate(() =>
            [...document.images]
              .filter(
                (image) =>
                  image.src.includes("/api/") &&
                  image.getBoundingClientRect().top < innerHeight &&
                  image.getBoundingClientRect().bottom > 0,
              )
              .map((image) => ({
                path: new URL(image.src).pathname + new URL(image.src).search,
                naturalWidth: image.naturalWidth,
                naturalHeight: image.naturalHeight,
                renderedWidth: image.width,
                renderedHeight: image.height,
              })),
          );
          await page.screenshot({
            path: path.join(evidence, `${label}-${view}-${width}.png`),
            animations: "disabled",
          });
          const resourceTiming = await page.evaluate(() =>
            performance
              .getEntriesByType("resource")
              .filter((entry) => entry.initiatorType === "img" && entry.name.includes("/api/"))
              .map((entry) => ({
                path: new URL(entry.name).pathname + new URL(entry.name).search,
                transferSize: entry.transferSize,
                encodedBodySize: entry.encodedBodySize,
                decodedBodySize: entry.decodedBodySize,
              })),
          );
          const result = {
            view,
            viewport: { width, height: 1000 },
            firstScreenReadyMs,
            imageRequests: responses.length,
            imageBodyBytes: responses.reduce((sum, image) => sum + image.bytes, 0),
            visible,
            responses,
            resourceTiming,
            errors,
          };
          report.cases.push(result);
          console.log(
            JSON.stringify({
              label,
              view,
              width,
              firstScreenReadyMs,
              imageRequests: result.imageRequests,
              imageBodyBytes: result.imageBodyBytes,
            }),
          );
          await context.close();
        }
      }
    if (mode === "verify") {
      report.method =
        "Production Chromium interactive checks at 1440×1000 in a fresh context. Normal navigation opens cards, drawer/detail previews and lightboxes. Grid currentSrc and decoded responses must be fixed-width thumbnails; original response bytes must match the fixture SHA-256 and the active top dialog must decode 2400×1600 without w. Separate fixture copy; no edits to user data. Not a packaged Electron smoke pass.";
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        serviceWorkers: "block",
      });
      await context.addCookies([
        { name: "pv_session", value: token, url: base, httpOnly: true, sameSite: "Strict" },
      ]);
      const page = await context.newPage();
      const responses = [],
        pending = [],
        errors = [];
      let stage = "miniature-grid";
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (!url.pathname.startsWith("/api/") || request.resourceType() !== "image") return;
        const requestedStage = stage;
        pending.push(
          (async () => {
            const response = await request.response();
            assert.ok(response);
            assert.equal(response.status(), 200);
            const bytes = await response.body();
            const metadata = await sharp(bytes).metadata();
            const record = {
              stage: requestedStage,
              path: url.pathname + url.search,
              width: metadata.width,
              height: metadata.height,
              bytes: bytes.byteLength,
            };
            if (!url.searchParams.has("w")) {
              const key = url.searchParams.get("v") ?? url.pathname.split("/").at(-1);
              const photo = fixture.photos.find((photo) => photo.key === key);
              assert.ok(photo, "Original must be a known fixture photo");
              assert.equal(createHash("sha256").update(bytes).digest("hex"), photo.sha256);
              record.originalChecksumMatches = true;
            }
            responses.push(record);
          })(),
        );
      });
      const settle = async () => {
        let completed = -1;
        while (completed !== pending.length) {
          completed = pending.length;
          await Promise.all(pending);
          await page.evaluate(
            () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          );
        }
      };
      const grid = async (name) => {
        await page.waitForFunction(() =>
          [...document.images].some(
            (image) =>
              image.src.includes("/api/") &&
              image.complete &&
              image.naturalWidth > 0 &&
              image.getBoundingClientRect().top < innerHeight,
          ),
        );
        await settle();
        const images = await page.evaluate(() =>
          [...document.images]
            .filter(
              (image) =>
                image.src.includes("/api/") &&
                image.getBoundingClientRect().top < innerHeight &&
                image.getBoundingClientRect().bottom > 0,
            )
            .map((image) => ({
              currentSrc: image.currentSrc,
              naturalWidth: image.naturalWidth,
              naturalHeight: image.naturalHeight,
            })),
        );
        assert.ok(images.length > 0);
        assert.ok(
          images.every((image) =>
            ["160", "320", "640"].includes(new URL(image.currentSrc).searchParams.get("w")),
          ),
        );
        assert.ok(
          responses.filter((record) => record.stage === stage).every((record) => record.width <= 640),
        );
        report.checks.push({ name, status: "PASS", images });
      };
      const original = async (name) => {
        await page.waitForFunction(() => {
          const dialog = [...document.querySelectorAll('[role="dialog"]')].at(-1);
          return (
            dialog &&
            [...dialog.querySelectorAll("img")].some(
              (image) =>
                image.complete &&
                image.naturalWidth === 2400 &&
                !new URL(image.currentSrc).searchParams.has("w"),
            )
          );
        });
        await settle();
        const images = await page
          .getByRole("dialog")
          .last()
          .locator("img")
          .evaluateAll((images) =>
            images.map((image) => ({
              currentSrc: image.currentSrc,
              naturalWidth: image.naturalWidth,
              naturalHeight: image.naturalHeight,
            })),
          );
        assert.ok(images.some((image) => image.naturalWidth === 2400 && image.naturalHeight === 1600));
        assert.ok(images.every((image) => !new URL(image.currentSrc).searchParams.has("w")));
        report.checks.push({ name, status: "PASS", images });
      };
      report.checks = [];
      await page.goto(base + "/");
      await page.getByRole("list", { name: "Miniature shelf", exact: true }).waitFor();
      await grid("Home cards request fixed-width thumbnails");
      stage = "miniature-detail";
      await page
        .getByRole("list", { name: "Miniature shelf", exact: true })
        .locator("button:has(img)")
        .first()
        .click();
      await original("Miniature drawer requests checksum-identical original");
      stage = "miniature-lightbox";
      await page.getByRole("button", { name: /View .* image full screen/ }).click();
      await original("Miniature lightbox keeps full original URL and dimensions");
      await page.screenshot({ path: path.join(evidence, `${outputLabel}-miniature-lightbox.png`) });
      await page.getByRole("button", { name: "Close image viewer", exact: true }).click();
      await page.getByRole("button", { name: "Close project", exact: true }).click();
      stage = "scheme-grid";
      await page.getByRole("button", { name: "Schemes", exact: true }).first().click();
      await page.locator("[data-scheme-index]").first().waitFor();
      await grid("Scheme cards request fixed-width thumbnails");
      stage = "scheme-preview";
      await page.locator("[data-scheme-index]").first().click();
      const reference = page.getByRole("button", { name: /View .* reference image/ });
      await reference.waitFor();
      await grid("Scheme reference preview requests fixed-width thumbnail");
      stage = "scheme-lightbox";
      await reference.click();
      await original("Scheme lightbox requests checksum-identical original");
      await page.screenshot({ path: path.join(evidence, `${outputLabel}-scheme-lightbox.png`) });
      await page.getByRole("button", { name: "Close image viewer", exact: true }).click();
      await page.keyboard.press("Escape");
      stage = "template-grid";
      await page.getByRole("button", { name: "Templates", exact: true }).first().click();
      await page.locator("[data-template-index]").first().waitFor();
      await grid("Template cards request fixed-width thumbnails");
      stage = "template-detail";
      await page.locator("[data-template-index]").first().click();
      await original("Template detail requests checksum-identical original");
      await page.screenshot({ path: path.join(evidence, `${outputLabel}-template-detail.png`) });
      await settle();
      assert.deepEqual(errors, []);
      report.imageResponses = responses;
      report.errors = errors;
      await context.close();
      console.log(`PASS ${report.checks.length} production image grid/detail/lightbox checks`);
    }
    report.result = "PASS";
  } catch (error) {
    report.result = "FAIL";
    report.error = error.stack;
    process.exitCode = 1;
  } finally {
    await browser?.close();
    await stopOwned(server.child);
    await server.save();
    await writeFile(path.join(evidence, `${outputLabel}.json`), JSON.stringify(report, null, 2) + "\n");
  }
} else throw new Error("Expected seed, measure or verify LABEL DIST PORT");
