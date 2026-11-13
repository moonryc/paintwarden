import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseOptions, identity } from "./smoke-library-native.mjs";

test("smoke defaults to plan, requires explicit evidence and run approval", () => {
  assert.deepEqual(parseOptions(["./evidence", "--app", "/tmp/test.app"]), {
    run: false,
    evidenceDir: path.resolve("./evidence"),
    app: "/tmp/test.app",
  });
  assert.equal(
    parseOptions(["--evidence-dir", "/tmp/evidence", "--run", "--image", "sha256:test"]).run,
    true,
  );
  assert.throws(() => parseOptions([]), /evidence directory/);
  assert.throws(() => parseOptions(["/tmp/evidence", "--app"]), /Missing app/);
  assert.throws(() => parseOptions(["/tmp/evidence", "--build"]), /Unknown argument/);
});

test("artifact identity captures content hash and filesystem timestamp", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pv-smoke-unit-"));
  try {
    const file = path.join(directory, "artifact");
    await writeFile(file, "abc");
    const result = await identity(file);
    assert.equal(result.path, file);
    assert.equal(result.bytes, 3);
    assert.equal(result.sha256, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    assert.ok(Number.isFinite(Date.parse(result.mtime)));
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("startup marker wait is event-driven and removes owned listeners", async () => {
  const { EventEmitter } = await import("node:events");
  const { waitForOutput } = await import("./smoke-library-native.mjs");
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.exitCode = null;
  let log = "";
  const owned = { child, log: () => log, error: () => undefined };
  const ready = waitForOutput(owned, /ready/, "fixture readiness", 1000);
  log = "server ready";
  child.stdout.emit("data", log);
  assert.equal(await ready, log);
  assert.equal(child.stdout.listenerCount("data"), 0);
  assert.equal(child.listenerCount("exit"), 0);
  assert.equal(await waitForOutput(owned, /ready/, "existing marker"), log);
});
