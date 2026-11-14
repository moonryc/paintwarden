import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { root, sourceManifest, counts, outcome } from "./graphql-phase4-support.mjs";
import { attachLibraryRecorder } from "./library-smoke-support.mjs";
import { freePort, launchOwned, waitForOutput, stopOwned, identity } from "./smoke-library-native.mjs";
import {
  plannedChecks,
  runPhase5Scenario,
  setupOwner,
  redact,
  scrubLogs,
} from "./graphql-phase5-support.mjs";

export function parseOptions(args, kind) {
  const options = { run: false, webDist: path.join(root, "apps/paintwarden-web/dist") };
  let plan = false;
  while (args.length) {
    const arg = args.shift();
    if (arg === "--run") options.run = true;
    else if (arg === "--plan") plan = true;
    else if (["--web-dist", "--image"].includes(arg)) {
      assert.ok(args[0] && !args[0].startsWith("--"), `Missing ${arg}`);
      options[arg === "--image" ? "image" : "webDist"] = args.shift();
    } else if (!arg.startsWith("--") && !options.evidenceDir) options.evidenceDir = path.resolve(arg);
    else throw new Error(`Unknown argument ${arg}`);
  }
  assert.ok(options.evidenceDir, "Evidence directory required");
  assert.ok(!(plan && options.run), "Use --plan or --run, not both");
  if (kind === "docker" && options.run)
    assert.ok(options.image, "Existing --image required; never builds or pulls");
  options.webDist = path.resolve(options.webDist);
  return options;
}
export async function runRuntime(kind, args) {
  assert.equal(process.version, "v22.22.2", "Use pinned Node22.22.2, including plan mode");
  const options = parseOptions([...args], kind);
  const dir = options.evidenceDir;
  await mkdir(dir, { recursive: true });
  const report = {
    startedAt: new Date().toISOString(),
    node: process.version,
    kind,
    mode: options.run ? "run" : "plan",
    checks: plannedChecks(),
    artifacts: [],
    sourceBuildLink:
      "Observed source hashes and existing artifact hashes are independent. Coordinator must establish approved build correspondence. No build is performed.",
    scope:
      "Phase5 backup/plugin/auth/removed-route extension; run alongside the historical Phase4 screen harness, not as its replacement.",
  };
  let browser,
    page,
    recorder,
    containerCreated = false;
  const owned = [];
  const name = `pv-phase5-${randomUUID()}`;
  const volume = `${name}-fixture`;
  const docker = (args) =>
    execFileSync("docker", args, { encoding: "utf8", timeout: 30000, maxBuffer: 16 * 1024 * 1024 }).trim();
  const containerLogs = () => {
    const result = spawnSync("docker", ["logs", name], {
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 16 * 1024 * 1024,
    });
    assert.equal(result.status, 0, `Cannot read owned container logs: ${result.error ?? result.stderr}`);
    return `${result.stdout ?? ""}${result.stderr ?? ""}`;
  };
  try {
    if (options.run) {
      report.sourceManifest = await sourceManifest();
      report.artifacts.push(await identity(process.execPath));
      let baseUrl, setupCode;
      if (kind === "browser") {
        const dataDir = await mkdtemp(path.join(os.tmpdir(), "pv-phase5-browser-"));
        report.fixture = { dataDir, retained: true };
        const port = await freePort();
        baseUrl = `http://127.0.0.1:${port}`;
        for (const file of ["server.mjs", "schema.graphql"])
          report.artifacts.push(await identity(path.join(root, "apps/paintwarden/dist", file)));
        for (const entry of await readdir(options.webDist, { recursive: true, withFileTypes: true }))
          if (entry.isFile()) report.artifacts.push(await identity(path.join(entry.parentPath, entry.name)));
        const server = launchOwned(
          process.execPath,
          [
            "--input-type=module",
            "-e",
            'process.env.NODE_ENV="test"; const {startServer}=await import("./server.mjs"); process.env.NODE_ENV="production"; await startServer(); console.log("PHASE5_READY_LISTENING");',
          ],
          {
            cwd: path.join(root, "apps/paintwarden/dist"),
            env: {
              ...process.env,
              NODE_ENV: "production",
              DATA_DIR: dataDir,
              DATABASE_PATH: "",
              HOST: "127.0.0.1",
              PORT: String(port),
              WEB_DIST: options.webDist,
              PAINTWARDEN_DISABLE_UPDATES: "1",
            },
          },
          path.join(dir, "browser-server.log"),
        );
        owned.push(server);
        await waitForOutput(server, /PHASE5_READY_LISTENING/, "isolated Phase5 production server");
      } else {
        const image = JSON.parse(docker(["image", "inspect", options.image]))[0];
        report.image = { requested: options.image, id: image.Id, created: image.Created };
        const node = docker([
          "run",
          "--rm",
          "--pull=never",
          "--network",
          "none",
          "--entrypoint",
          "node",
          image.Id,
          "--version",
        ]);
        assert.equal(node, "v22.22.2");
        const label = `paintwarden.smoke.owner=${name}`;
        docker(["volume", "create", "--label", label, volume]);
        report.fixture = { volume, label, retained: true };
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
          "PAINTWARDEN_DISABLE_UPDATES=1",
          image.Id,
        ]);
        containerCreated = true;
        docker(["start", name]);
        const binding = JSON.parse(docker(["inspect", name]))[0].NetworkSettings.Ports["3000/tcp"];
        assert.equal(binding.length, 1);
        assert.equal(binding[0].HostIp, "127.0.0.1");
        baseUrl = `http://127.0.0.1:${binding[0].HostPort}`;
        const follower = launchOwned(
          "docker",
          ["logs", "--follow", name],
          {},
          path.join(dir, "docker-follow.log"),
        );
        owned.push(follower);
        await waitForOutput(
          follower,
          /Nest application successfully started/,
          "Phase5 production container",
          60000,
        );
        setupCode = containerLogs().match(/owner account: ([a-f0-9-]+)/i)?.[1];
        assert.ok(setupCode, "Fresh Docker server must emit owner setup code");
      }
      report.baseUrl = baseUrl;
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        acceptDownloads: true,
      });
      page = await context.newPage();
      recorder = attachLibraryRecorder(page);
      await page.goto(`${baseUrl}/`);
      await setupOwner(page, setupCode);
      const scenario = await runPhase5Scenario({ page, recorder, evidenceDir: dir, label: kind, baseUrl });
      report.checks = scenario.checks;
      report.evidence = scenario.evidence;
    }
  } catch (error) {
    report.checks.push({ name: "Phase5 runtime harness", status: "FAIL", detail: error.stack });
  } finally {
    if (recorder) {
      try {
        await recorder.settle();
        await writeFile(
          path.join(dir, `${kind}-raw-evidence.json`),
          JSON.stringify(redact({ requests: recorder.requests, errors: recorder.errors }), null, 2) + "\n",
        );
      } catch (error) {
        report.checks.push({ name: "Raw evidence retention", status: "FAIL", detail: error.stack });
      }
    }
    try {
      await browser?.close();
    } catch (error) {
      report.checks.push({ name: "Owned browser cleanup", status: "FAIL", detail: error.stack });
    }
    for (const process of owned.reverse()) {
      try {
        await stopOwned(process.child);
        await process.save();
      } catch (error) {
        report.checks.push({ name: "Owned process cleanup", status: "FAIL", detail: error.stack });
      }
    }
    if (containerCreated) {
      try {
        await writeFile(path.join(dir, "docker-server.log"), containerLogs());
        docker(["stop", "--time", "10", name]);
        docker(["rm", name]);
      } catch (error) {
        report.checks.push({ name: "Owned container cleanup", status: "FAIL", detail: error.stack });
      }
    }
    if (report.sourceManifest) {
      try {
        report.sourceManifestAfter = await sourceManifest();
        assert.equal(
          report.sourceManifestAfter.manifestSha256,
          report.sourceManifest.manifestSha256,
          "Source changed during run",
        );
        const changed = [];
        for (const artifact of report.artifacts)
          if ((await identity(artifact.path)).sha256 !== artifact.sha256) changed.push(artifact.path);
        assert.deepEqual(changed, [], "Runtime changed during run");
        report.checks.push({ name: "Source and observed artifacts remain stable", status: "PASS" });
      } catch (error) {
        report.checks.push({ name: "Stable source/artifacts", status: "FAIL", detail: error.stack });
      }
    }
    try {
      await scrubLogs(dir);
    } catch (error) {
      report.checks.push({ name: "Credential-safe log retention", status: "FAIL", detail: error.stack });
    }
    report.finishedAt = new Date().toISOString();
    report.result = outcome(report.checks);
    report.counts = counts(report.checks);
    if (report.result === "FAIL") process.exitCode = 1;
    await writeFile(path.join(dir, `${kind}-results.json`), JSON.stringify(redact(report), null, 2) + "\n");
    console.log(JSON.stringify({ result: report.result, counts: report.counts }, null, 2));
  }
}
