const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createServerLog, createStartupProgress, waitForServer } = require("./desktop-startup.cjs");

function marker(progress, phase, status) {
  progress.accept(Buffer.from(`PAINTWARDEN_STARTUP ${JSON.stringify({ phase, status })}\n`));
}

test("startup parses split protocol lines, ignores noise and never forwards raw failure details", () => {
  const seen = [];
  const progress = createStartupProgress((state) => seen.push(state));
  progress.accept(Buffer.from("noisy log\nPAINTWARDEN_STA"));
  progress.accept(Buffer.from('RTUP {"phase":"backing-up","status":"started"}\n'));
  assert.equal(progress.protected(), true);
  marker(progress, "backing-up", "completed");
  assert.equal(progress.protected(), false);
  marker(progress, "migrating", "started");
  assert.equal(progress.protected(), true);
  progress.accept(Buffer.from('PAINTWARDEN_STARTUP {"phase":"failed","message":"secret path"}\n'));
  assert.deepEqual(progress.state(), { phase: "failed" });
  assert.equal(progress.protected(), false);
  progress.accept(Buffer.from("x".repeat(100_000)));
  progress.accept(Buffer.from('\nPAINTWARDEN_STARTUP {"phase":"invented"}\n'));
  assert.equal(seen.length, 4);
});

test("slow synchronous backup/migration outlives old retry limit and completes without killing child", async () => {
  const progress = createStartupProgress();
  const child = { exitCode: null, signalCode: null, kill: () => assert.fail("must not kill") };
  let time = 0;
  marker(progress, "backing-up", "started");
  await waitForServer({
    child,
    progress,
    now: () => time,
    healthy: async () => time >= 240_000,
    pause: async () => {
      time += 10_000;
      if (time === 120_000) marker(progress, "migrating", "started");
    },
  });
  assert.equal(time, 240_000);
});

test("overall cap preserves live protected child and Retry can join the same operation", async () => {
  const progress = createStartupProgress();
  marker(progress, "migrating", "started");
  const child = { exitCode: null, kill: () => assert.fail("must not kill") };
  let time = 0;
  const options = {
    child,
    progress,
    now: () => time,
    healthy: async () => false,
    pause: async () => {
      time += 10;
    },
    overallMs: 100,
  };
  await assert.rejects(waitForServer(options), /startup-cap/);
  assert.equal(progress.protected(), true);
  await waitForServer({ ...options, healthy: async () => true });
});

test("real exit, explicit failure and unprotected stalled startup fail promptly", async () => {
  const progress = createStartupProgress();
  const common = { progress, healthy: async () => false };
  await assert.rejects(waitForServer({ ...common, child: { exitCode: 1 } }), /server-exited/);
  await assert.rejects(
    waitForServer({ ...common, child: { exitCode: null, signalCode: "SIGTERM" } }),
    /server-exited/,
  );
  marker(progress, "failed");
  await assert.rejects(waitForServer({ ...common, child: { exitCode: null } }), /server-failed/);
  const clean = createStartupProgress();
  let time = 0;
  await assert.rejects(
    waitForServer({
      ...common,
      child: { exitCode: null },
      progress: clean,
      now: () => time,
      pause: async () => {
        time += 10;
      },
      startupMs: 20,
    }),
    /startup-stalled/,
  );
});

test("child stdout/stderr log rotation bounds files and bytes, retains newest data privately", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "vault-log-test-"));
  try {
    const log = createServerLog(directory, { maxBytes: 16, copies: 2 });
    log.write("stdout\nstderr\n");
    log.write(Buffer.from("x".repeat(100) + "latest"));
    const files = readdirSync(directory);
    assert.equal(files.length, 3);
    for (const name of files) {
      const stat = statSync(path.join(directory, name));
      assert.ok(stat.size <= 16);
      if (process.platform !== "win32") assert.equal(stat.mode & 0o777, 0o600);
    }
    assert.match(readFileSync(log.file, "utf8"), /latest$/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
