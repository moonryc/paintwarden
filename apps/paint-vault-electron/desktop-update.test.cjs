const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");

const { CHECK_INTERVAL_MS, FIRST_CHECK_DELAY_MS, createUpdater } = require("./desktop-update.cjs");

function fakeUpdater() {
  const updater = new EventEmitter();
  updater.checks = 0;
  updater.installs = 0;
  updater.checkForUpdates = async () => {
    updater.checks += 1;
  };
  updater.quitAndInstall = () => {
    updater.installs += 1;
  };
  return updater;
}

function setup(enabled = true) {
  const autoUpdater = fakeUpdater();
  const changes = [];
  const updater = createUpdater({
    autoUpdater,
    currentVersion: "1.0.0",
    enabled,
    onChange: (state) => changes.push(state.status),
  });
  return { autoUpdater, changes, updater };
}

test("updates download quietly, then wait for a restart", async () => {
  const { autoUpdater, changes, updater } = setup();
  assert.equal(autoUpdater.autoDownload, true);
  assert.equal(autoUpdater.autoInstallOnAppQuit, true);
  updater.check();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(autoUpdater.checks, 1);
  autoUpdater.emit("checking-for-update");
  autoUpdater.emit("update-available", { version: "1.1.0" });
  autoUpdater.emit("download-progress", { percent: 41.6 });
  assert.deepEqual(updater.state(), {
    status: "downloading",
    currentVersion: "1.0.0",
    version: "1.1.0",
    progress: 42,
    error: null,
  });
  assert.equal(updater.install(), false, "nothing installs before the download finishes");
  autoUpdater.emit("update-downloaded", { version: "1.1.0" });
  assert.equal(updater.state().status, "ready");
  // Later checks and errors don't hide a downloaded update.
  autoUpdater.emit("checking-for-update");
  autoUpdater.emit("update-not-available");
  autoUpdater.emit("error", new Error("Offline"));
  assert.equal(updater.state().status, "ready");
  updater.check();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(autoUpdater.checks, 1, "no new check while an update is ready");
  assert.equal(updater.install(), true);
  assert.equal(autoUpdater.installs, 1);
  assert.deepEqual(changes, ["checking", "downloading", "downloading", "ready"]);
});

test("check results and failures are reported", () => {
  const { autoUpdater, updater } = setup();
  autoUpdater.emit("checking-for-update");
  autoUpdater.emit("update-not-available");
  assert.equal(updater.state().status, "up-to-date");
  autoUpdater.emit("error", new Error("Offline"));
  assert.deepEqual(
    { status: updater.state().status, error: updater.state().error },
    { status: "error", error: "Offline" },
  );
  // Long HTTP failures are trimmed to their first line.
  autoUpdater.emit(
    "error",
    new Error(`404 \n"method: GET url: https://github.com/…"\nHeaders: {${"x".repeat(5000)}}`),
  );
  assert.equal(updater.state().error, "404");
});

test("checks run shortly after launch and then periodically", () => {
  const { updater } = setup();
  const scheduled = [];
  updater.start({
    setTimeout: (_run, ms) => scheduled.push(["once", ms]),
    setInterval: (_run, ms) => scheduled.push(["every", ms]),
  });
  assert.deepEqual(scheduled, [
    ["once", FIRST_CHECK_DELAY_MS],
    ["every", CHECK_INTERVAL_MS],
  ]);
});

test("unpackaged and test builds never check or install", async () => {
  const { autoUpdater, updater } = setup(false);
  const scheduled = [];
  updater.start({ setTimeout: () => scheduled.push(1), setInterval: () => scheduled.push(1) });
  updater.check();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(updater.state().status, "disabled");
  assert.equal(autoUpdater.checks, 0);
  assert.equal(updater.install(), false);
  assert.deepEqual(scheduled, []);
  assert.equal(autoUpdater.listenerCount("update-downloaded"), 0);
});
