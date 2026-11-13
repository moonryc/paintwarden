#!/usr/bin/env node
/** Existing production image only. Never builds, pulls, uses Compose or touches user volumes.
 * Node 22.22.2: scripts/smoke-home-miniatures-docker.mjs EVIDENCE_DIR --image IMAGE [--run]
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
  waitForOutput,
  launchOwned,
  stopOwned,
  identity,
} from "./smoke-library-native.mjs";

assert.equal(process.version, "v22.22.2", "Use the pinned Node.js 22.22.2 runtime (including plan mode)");
const options = parseOptions(process.argv.slice(2));
await mkdir(options.evidenceDir, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  scope:
    "Production container default Home/Miniatures renderer with 360 synthetic miniatures and 130 base plus two focused paints; not full application smoke or large-vault performance.",
  node: process.version,
  checks: [],
  artifacts: [],
};
const resultPath = path.join(options.evidenceDir, "docker-results.json");
let browser;
let logFollower;
let recorder;
let page;
let containerCreated = false;
let volumeCreated = false;
const name = `pv-home-miniatures-smoke-${randomUUID()}`;
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
      name: "production Docker default Home/Miniatures projections, writes, SSE and legacy consistency",
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
    assert.ok(image.Id.startsWith("sha256:"));
    report.imageArtifacts = JSON.parse(
      docker([
        "run",
        "--rm",
        "--pull=never",
        "--network",
        "none",
        "--label",
        label,
        "--entrypoint",
        "node",
        image.Id,
        "-e",
        `const fs=require('node:fs'),p=require('node:path'),c=require('node:crypto');const root='/app/apps/paint-vault/dist';let files=['server.mjs','schema.graphql'];function walk(rel){for(const e of fs.readdirSync(p.join(root,rel),{withFileTypes:true})){const f=p.join(rel,e.name);if(e.isDirectory())walk(f);else if(e.isFile())files.push(f)}}walk('web-dist');console.log(JSON.stringify({node:process.version,files:files.sort().map(file=>{const b=fs.readFileSync(p.join(root,file));return {path:file,bytes:b.length,sha256:c.createHash('sha256').update(b).digest('hex')}})}))`,
      ]),
    );
    assert.equal(report.imageArtifacts.node, "v22.22.2");
    for (const source of [
      import.meta.url,
      new URL("./smoke-library-native.mjs", import.meta.url),
      new URL("./library-smoke-support.mjs", import.meta.url),
      new URL("./home-miniatures-smoke-support.mjs", import.meta.url),
      new URL("./home-miniatures-fixture.mjs", import.meta.url),
    ])
      report.artifacts.push(await identity(new URL(source)));
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
    logFollower = launchOwned(
      "docker",
      ["logs", "--follow", name],
      {},
      path.join(options.evidenceDir, "docker-follow.log"),
    );
    await waitForOutput(logFollower, /Nest application successfully started/, "fresh Docker server", 60000);
    const logs = containerLogs();
    const setupCode = logs.match(/owner account: ([a-f0-9-]+)/i)?.[1];
    assert.ok(setupCode, "Fresh non-loopback container must print fixture setup code");
    const { chromium } = await import("playwright");
    const { attachLibraryRecorder } = await import("./library-smoke-support.mjs");
    const { runHomeMiniaturesScenario, sourceSnapshot } = await import("./home-miniatures-smoke-support.mjs");
    report.source = sourceSnapshot();
    const { seedHomeMiniaturesFixture } = await import("./home-miniatures-fixture.mjs");
    browser = await chromium.launch({ headless: true });
    // Separate, ephemeral Chromium context: never reuse the user browser/session.
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    page = await context.newPage();
    recorder = attachLibraryRecorder(page);
    await page.goto(`${baseUrl}/`);
    const seeded = await setupAndSeed(page, setupCode);
    report.checks.push({
      name: "HTTP picker accepts 101 excluded IDs within existing request bounds",
      status: "PASS",
      detail: { excludedCount: seeded.excludedCount, remaining: seeded.pickerRemaining },
    });
    const fixture = await seedHomeMiniaturesFixture(page, { miniatures: 360 });
    report.fixture.records = fixture;
    const result = await runHomeMiniaturesScenario({
      page,
      recorder,
      evidenceDir: options.evidenceDir,
      label: "docker",
      initialNavigate: async () => {
        await page.goto(`${baseUrl}/`);
        await page.reload(); // Hash-only navigation does not remount the initial-tab store.
      },
      secondClientWrite: await independentWriter(baseUrl),
      fixture,
    });
    report.checks.push(...result.checks);
    report.metrics = result.metrics;
    await page.screenshot({ path: path.join(options.evidenceDir, "docker-home-miniatures.png") });
    report.checks.push({
      name: "isolated production container and independent HTTP writer",
      status: "PASS",
      detail:
        "Existing immutable image ID; loopback random port; unique labelled fixture volume; separate bearer login client.",
    });
  }
} catch (error) {
  if (page) {
    report.failureBody = await page
      .locator("body")
      .innerText()
      .catch(() => "unavailable");
    await page.screenshot({ path: path.join(options.evidenceDir, "docker-failure.png") }).catch(() => {});
  }
  report.checks.push({ name: "Docker harness", status: "FAIL", detail: error.stack });
  process.exitCode = 1;
} finally {
  await browser?.close().catch((error) => {
    report.checks.push({ name: "owned browser cleanup", status: "FAIL", detail: String(error) });
    process.exitCode = 1;
  });
  if (recorder) {
    try {
      await recorder.settle();
      for (const check of recorder.scenario?.checks ?? []) {
        if (!report.checks.includes(check)) report.checks.push(check);
      }
      await writeFile(
        path.join(options.evidenceDir, "docker-raw-evidence.json"),
        JSON.stringify(
          { requests: recorder.requests, errors: recorder.errors, scenario: recorder.scenario },
          null,
          2,
        ) + "\n",
      );
    } catch (error) {
      report.checks.push({ name: "raw evidence retention", status: "FAIL", detail: String(error) });
      process.exitCode = 1;
    }
  }
  if (logFollower) {
    try {
      await stopOwned(logFollower.child);
      await logFollower.save();
    } catch (error) {
      report.checks.push({
        name: "owned Docker log follower cleanup",
        status: "FAIL",
        detail: String(error),
      });
      process.exitCode = 1;
    }
  }
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
