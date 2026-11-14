#!/usr/bin/env node
// Warm encoded-buffer Chromium microbenchmark, not navigation or compositor timing.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

assert.equal(process.version, "v22.22.2");
const evidence = path.resolve(import.meta.dirname, "../../../paint-tracker-audit/thumbnails");
const fixture = JSON.parse(await readFile(path.join(evidence, "photo-fixture.json"), "utf8"));
const generated = JSON.parse(await readFile(path.join(evidence, "cpu-disk.json"), "utf8"));
const browser = await chromium.launch({ headless: true });
const cases = [];
try {
  const page = await browser.newPage();
  for (const photo of fixture.photos) {
    for (const variant of ["original", "320"]) {
      const file = path.join(
        generated.dataDirectory,
        "images",
        photo.key + (variant === "320" ? ".thumb-v1-320.webp" : ""),
      );
      const base64 = (await readFile(file)).toString("base64");
      const samples = await page.evaluate(
        async ({ base64, variant }) => {
          const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
          const samples = [];
          for (let iteration = 0; iteration < 3; iteration++) {
            const blob = new Blob([bytes], { type: variant === "original" ? "image/jpeg" : "image/webp" });
            const start = performance.now();
            const bitmap = await createImageBitmap(blob);
            const decoded = performance.now();
            const canvas = document.createElement("canvas");
            canvas.width = 240;
            canvas.height = 160;
            document.body.append(canvas);
            const context = canvas.getContext("2d", { willReadFrequently: true });
            context.drawImage(bitmap, 0, 0, 240, 160);
            context.getImageData(0, 0, 1, 1); // Force completion; not a compositor-paint claim.
            const painted = performance.now();
            samples.push({
              decodeMs: decoded - start,
              rasterReadbackMs: painted - decoded,
              width: bitmap.width,
              height: bitmap.height,
            });
            bitmap.close();
            canvas.remove();
          }
          return samples;
        },
        { base64, variant },
      );
      cases.push({ key: photo.key, variant, samples });
    }
  }
  const summaries = ["original", "320"].map((variant) => {
    const samples = cases.filter((entry) => entry.variant === variant).flatMap((entry) => entry.samples);
    const mean = (key) => samples.reduce((total, sample) => total + sample[key], 0) / samples.length;
    return {
      variant,
      samples: samples.length,
      meanDecodeMs: mean("decodeMs"),
      meanRasterReadbackMs: mean("rasterReadbackMs"),
      dimensions: [samples[0].width, samples[0].height],
    };
  });
  const report = {
    measuredAt: new Date().toISOString(),
    codec: generated.codec,
    browser: browser.version(),
    method:
      "32 synthetic detailed 3.84MP JPEGs and matching 320w WebP, three createImageBitmap samples each, encoded bytes already in memory before the timer; new Blob each sample. Canvas240×160 draw+single-pixel synchronous readback is reported separately. Warm buffers/caches, sequential paired order, headless Chromium; NOT original UI/compositor paint, network decode scheduling, frame time, or a controlled end-user speed measurement.",
    summaries,
    cases,
  };
  await writeFile(path.join(evidence, "decode-raster.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, cases: undefined }, null, 2));
} finally {
  await browser.close();
}
