#!/usr/bin/env node
/** Existing production image only. Never builds, pulls, uses Compose or touches user volumes.
 * node scripts/smoke-library-docker.mjs EVIDENCE_DIR --image IMAGE [--run]
 * Default is a NOT RUN plan. --run creates a unique labelled retained fixture volume.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseOptions,
  setupAndSeed,
  independentWriter,
  waitUntil,
  identity,
} from "./smoke-library-native.mjs";

const options = parseOptions(process.argv.slice(2));
await mkdir(options.evidenceDir, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  scope:
    "Production container Library renderer with 130 synthetic paints; not full application smoke or large-vault performance.",
  checks: [],
};
const resultPath = path.join(options.evidenceDir, "docker-results.json");
let browser;
let containerCreated = false;
let volumeCreated = false;
const name = `pv-library-smoke-${randomUUID()}`;
const volume = `${name}-fixture`;
const label = `paint-vault.smoke.owner=${name}`;
const containerLogs = () => {
  const result = spawnSync("docker", ["logs", name], { encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, "Read owned container logs");
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
};
const docker = (args) =>
  execFileSync("docker", args, { encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024 }).trim();
try {
  if (!options.run) {
    report.checks.push({
      name: "production Docker Library UI/SSE/legacy consistency",
      status: "NOT RUN",
      reason:
        "Planning only. Requires Docker daemon, an already-built production image, Playwright Chromium and explicit --run after build approval.",
    });
  } else {
    assert.ok(options.image, "--image is required with --run (no implicit image build or pull)");
    const image = JSON.parse(docker(["image", "inspect", options.image]))[0];
    report.image = {
      requested: options.image,
      id: image.Id,
      created: image.Created,
      repoDigests: image.RepoDigests,
    };
    report.harness = await identity(new URL(import.meta.url));
    docker(["volume", "create", "--label", label, volume]);
    volumeCreated = true;
    report.fixture = { name, volume, retained: true, label };
    docker([
      "create",
      "--name",
      name,
      "--label",
      label,
      "--pull=never",
      "--mount",
      `type=volume,src=${volume},dst=/data`,
      "-p",
      "127.0.0.1::3000",
      "-e",
      "DATA_DIR=/data",
      "-e",
      "DATABASE_PATH=",
      "-e",
      "PAINT_VAULT_DISABLE_UPDATES=1",
      image.Id,
    ]);
    containerCreated = true;
    docker(["start", name]);
    const binding = JSON.parse(docker(["inspect", name]))[0].NetworkSettings.Ports["3000/tcp"];
    assert.equal(binding.length, 1);
    assert.equal(binding[0].HostIp, "127.0.0.1");
    const baseUrl = `http://127.0.0.1:${binding[0].HostPort}`;
    report.baseUrl = baseUrl;
    await waitUntil(
      async () => (await fetch(`${baseUrl}/api/auth/status`, { signal: AbortSignal.timeout(1000) })).ok,
      "fresh Docker server",
      60000,
    );
    const logs = containerLogs();
    const setupCode = logs.match(/owner account: ([a-f0-9-]+)/i)?.[1];
    assert.ok(setupCode, "Fresh non-loopback container must print fixture setup code");
    const { chromium } = await import("playwright");
    const { attachLibraryRecorder, runLibraryScenario } = await import("./library-smoke-support.mjs");
    browser = await chromium.launch({ headless: true });
    // Separate, ephemeral Chromium context: never reuse the user browser/session.
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const recorder = attachLibraryRecorder(page);
    await page.goto(`${baseUrl}/#paints`);
    await setupAndSeed(page, setupCode);
    const result = await runLibraryScenario({
      page,
      recorder,
      evidenceDir: options.evidenceDir,
      label: "docker",
      initialNavigate: async () => {
        await page.goto(`${baseUrl}/#paints`);
      },
      secondClientWrite: await independentWriter(baseUrl),
    });
    report.checks.push(...result.checks);
    report.metrics = result.metrics;
    await page.screenshot({ path: path.join(options.evidenceDir, "docker-library.png") });
    report.checks.push({
      name: "isolated production container and independent HTTP writer",
      status: "PASS",
      detail:
        "Existing immutable image ID; loopback random port; unique labelled fixture volume; separate bearer login client.",
    });
  }
} catch (error) {
  report.checks.push({ name: "Docker harness", status: "FAIL", detail: error.stack });
  process.exitCode = 1;
} finally {
  await browser?.close().catch((error) => {
    report.checks.push({ name: "owned browser cleanup", status: "FAIL", detail: String(error) });
    process.exitCode = 1;
  });
  if (containerCreated) {
    try {
      // Never remove/stop a same-name container unless its unique ownership label matches.
      const current = JSON.parse(docker(["inspect", name]))[0];
      assert.equal(current.Config.Labels["paint-vault.smoke.owner"], name);
      docker(["stop", "--time", "10", name]);
      const logs = containerLogs();
      await writeFile(
        path.join(options.evidenceDir, "docker-server.log"),
        logs.replace(/(owner account: )[a-f0-9-]+/gi, "$1<redacted>"),
      );
      docker(["rm", name]);
      report.checks.push({
        name: "owned container stopped and removed; fixture volume retained",
        status: "PASS",
      });
    } catch (error) {
      report.checks.push({ name: "owned container cleanup", status: "FAIL", detail: String(error) });
      process.exitCode = 1;
    }
  }
  if (volumeCreated) report.retainedVolume = volume;
  report.finishedAt = new Date().toISOString();
  report.counts = report.checks.reduce(
    (counts, check) => ({ ...counts, [check.status]: (counts[check.status] || 0) + 1 }),
    {},
  );
  await writeFile(resultPath, JSON.stringify(report, null, 2));
  console.log(resultPath);
}
