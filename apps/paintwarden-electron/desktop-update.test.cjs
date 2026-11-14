const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");

const { CHECK_INTERVAL_MS, FIRST_CHECK_DELAY_MS, createUpdater } = require("./desktop-update.cjs");
const { t } = require("./desktop-i18n.cjs");

const VERSION = "1.1.0";
const local = { mode: "local" };
const remote = (serverVersion = null, serverUrl = "https://vault.example") => ({
  mode: "remote",
  serverUrl,
  serverVersion,
});
const flush = () => new Promise((resolve) => setImmediate(resolve));

function setup({ enabled = true, connection = local } = {}) {
  const autoUpdater = new EventEmitter();
  autoUpdater.checks = 0;
  autoUpdater.downloads = 0;
  autoUpdater.installs = 0;
  autoUpdater.checkForUpdates = async () => {
    autoUpdater.checks += 1;
  };
  autoUpdater.downloadUpdate = async () => {
    autoUpdater.downloads += 1;
  };
  autoUpdater.quitAndInstall = () => {
    autoUpdater.installs += 1;
  };
  const changes = [];
  const errors = [];
  const updater = createUpdater({
    autoUpdater,
    currentVersion: "1.0.0",
    enabled,
    connection,
    onChange: (state) => changes.push({ ...state }),
    log: (error) => errors.push(error),
  });
  const assertLibraryFlags = () => {
    assert.equal(autoUpdater.autoDownload, false, "the library must never start an unguarded download");
    assert.equal(
      autoUpdater.autoInstallOnAppQuit,
      false,
      "macOS native staging cannot be revoked on a server switch",
    );
  };
  const emit = (event, payload) => {
    autoUpdater.emit(event, payload);
    assertLibraryFlags();
  };
  const response = (action = "download") => ({
    version: updater.state().version,
    consentId: updater.state().consentId,
    action,
  });
  assertLibraryFlags();
  return { autoUpdater, changes, errors, updater, emit, response, assertLibraryFlags };
}

function assertBlocked(updater, autoUpdater) {
  assert.equal(updater.install(), false);
  assert.equal(updater.installOnQuit(), false);
  assert.equal(updater.isInstalling(), false);
  assert.equal(autoUpdater.installs, 0);
}

test("local downloads explicitly after the provider event, then waits for restart or quit", async () => {
  const { autoUpdater, updater, emit, assertLibraryFlags } = setup();
  assert.deepEqual(updater.state(), {
    status: "idle",
    currentVersion: "1.0.0",
    version: null,
    progress: null,
    error: null,
    serverVersion: null,
    consentId: undefined,
  });
  assertBlocked(updater, autoUpdater);
  updater.check();
  assert.equal(updater.state().status, "checking");
  await flush();
  assert.equal(autoUpdater.checks, 1);
  emit("checking-for-update");
  emit("update-available", { version: VERSION });
  assert.equal(updater.state().status, "downloading");
  assert.equal(autoUpdater.downloads, 0, "provider processing must finish before downloadUpdate");
  await flush();
  assert.equal(autoUpdater.downloads, 1);
  emit("download-progress", { percent: 41.6 });
  assert.equal(updater.state().progress, 42);
  assertBlocked(updater, autoUpdater);
  emit("update-downloaded", { version: VERSION });
  assert.equal(updater.state().status, "ready");
  assert.equal(updater.state().progress, 100);
  assert.equal(updater.state().consentId, undefined);
  assert.equal(updater.installOnQuit(), true);
  assert.equal(updater.isInstalling(), true);
  assert.equal(autoUpdater.installs, 1);
  assert.equal(updater.install(), false, "installation is one-shot");
  assert.equal(updater.installOnQuit(), false);
  assertLibraryFlags();
});

for (const [name, connection, status, automatic] of [
  ["no selection", { mode: null }, "deferred", false],
  ["remote with unknown or offline server version", remote(), "consent-required", false],
  ["remote with incompatible older server", remote("1.0.0"), "consent-required", false],
  ["remote with more recent server", remote("1.2.0"), "consent-required", false],
  ["remote with exactly compatible server", remote(VERSION), "downloading", true],
]) {
  test(`${name}: ${automatic ? "downloads automatically" : "does not download or install without consent"}`, async () => {
    const { autoUpdater, updater, emit } = setup({ connection });
    assert.equal(updater.state().serverVersion, connection.serverVersion ?? null);
    emit("update-available", { version: VERSION });
    assert.equal(updater.state().status, status);
    assert.equal(updater.state().version, VERSION);
    await flush();
    assert.equal(autoUpdater.downloads, Number(automatic));
    assertBlocked(updater, autoUpdater);
    if (!automatic) {
      emit("download-progress", { percent: 70 });
      emit("update-downloaded", { version: VERSION });
      assert.equal(updater.state().status, status, "a finished download cannot bypass connection policy");
      assertBlocked(updater, autoUpdater);
    } else {
      emit("update-downloaded", { version: VERSION });
      assert.equal(updater.state().status, "ready");
      assert.equal(updater.installOnQuit(), true);
      assert.equal(autoUpdater.installs, 1);
    }
  });
}

test("omitting connection defaults to no selection, not a local vault", async () => {
  const autoUpdater = new EventEmitter();
  let downloads = 0;
  autoUpdater.downloadUpdate = async () => {
    downloads += 1;
  };
  const updater = createUpdater({ autoUpdater, enabled: true, currentVersion: "1.0.0", onChange: () => {} });
  autoUpdater.emit("update-available", { version: VERSION });
  await flush();
  assert.equal(updater.state().status, "deferred");
  assert.equal(downloads, 0);
  assert.equal(updater.installOnQuit(), false);
});

for (const serverVersion of [null, "1.0.0", "1.2.0"]) {
  test(`explicit consent permits remote download and quit-install (server ${serverVersion ?? "unknown"})`, async () => {
    const { autoUpdater, updater, emit, response, assertLibraryFlags } = setup({
      connection: remote(serverVersion),
    });
    emit("update-available", { version: VERSION });
    const input = response();
    assert.equal(typeof input.consentId, "string");
    assert.equal(updater.respond(input).status, "downloading");
    updater.respond(input);
    await flush();
    assert.equal(autoUpdater.downloads, 1, "replayed consent does not duplicate a download");
    emit("update-downloaded", { version: VERSION });
    assert.equal(updater.state().status, "ready");
    assert.equal(updater.installOnQuit(), true);
    assert.equal(autoUpdater.installs, 1);
    assertLibraryFlags();
  });
}

test("consent requires the exact current version, token and supported action", async () => {
  const { autoUpdater, updater, emit, response } = setup({ connection: remote() });
  emit("update-available", { version: VERSION });
  const current = response();
  for (const input of [
    undefined,
    null,
    {},
    { ...current, version: "9.9.9" },
    { ...current, consentId: "stale" },
    { ...current, consentId: undefined },
    { ...current, action: "install" },
    { ...current, action: undefined },
  ]) {
    assert.equal(updater.respond(input).status, "consent-required");
  }
  await flush();
  assert.equal(autoUpdater.downloads, 0);
  assertBlocked(updater, autoUpdater);
});

test("a response cannot grant consent when no connection is selected", async () => {
  const { autoUpdater, updater, emit, response } = setup({ connection: { mode: null } });
  emit("update-available", { version: VERSION });
  updater.respond(response());
  await flush();
  assert.equal(updater.state().status, "deferred");
  assert.equal(autoUpdater.downloads, 0);
  updater.setConnection(local);
  await flush();
  assert.equal(updater.state().status, "downloading");
  assert.equal(autoUpdater.downloads, 1);
});

for (const phase of ["checking", "download scheduled", "downloading", "ready"]) {
  test(`switching local to incompatible remote during ${phase} revokes install permission`, async () => {
    const { autoUpdater, updater, emit, response } = setup();
    updater.check();
    await flush();
    if (phase !== "checking") emit("update-available", { version: VERSION });
    if (phase === "downloading" || phase === "ready") await flush();
    if (phase === "ready") emit("update-downloaded", { version: VERSION });
    updater.setConnection(remote("1.0.0"));
    if (phase === "checking") emit("update-available", { version: VERSION });
    await flush();
    assert.equal(updater.state().status, "consent-required");
    assert.equal(updater.state().serverVersion, "1.0.0");
    assertBlocked(updater, autoUpdater);
    if (phase === "downloading") {
      emit("download-progress", { percent: 95 });
      assert.equal(updater.state().status, "consent-required");
      emit("update-downloaded", { version: VERSION });
      assert.equal(updater.state().status, "consent-required");
      assertBlocked(updater, autoUpdater);
    }
    assert.equal(autoUpdater.downloads, Number(phase === "downloading" || phase === "ready"));
    updater.respond(response());
    await flush();
    if (phase === "ready" || phase === "downloading") {
      assert.equal(updater.state().status, "ready");
      assert.equal(
        autoUpdater.downloads,
        1,
        "reuse the already downloaded file, without staging native install",
      );
    } else {
      assert.equal(updater.state().status, "downloading");
      assert.equal(autoUpdater.downloads, 1);
    }
  });
}

for (const phase of ["checking", "downloading", "ready"]) {
  test(`switching to no selection during ${phase} blocks install until a permitted selection`, async () => {
    const { autoUpdater, updater, emit, response } = setup();
    updater.check();
    await flush();
    if (phase !== "checking") {
      emit("update-available", { version: VERSION });
      await flush();
    }
    if (phase === "ready") emit("update-downloaded", { version: VERSION });
    updater.setConnection({ mode: null });
    if (phase === "checking") emit("update-available", { version: VERSION });
    assert.equal(updater.state().status, "deferred");
    assert.equal(updater.state().serverVersion, null);
    updater.respond(response());
    assertBlocked(updater, autoUpdater);
    if (phase === "downloading") emit("update-downloaded", { version: VERSION });
    assert.equal(updater.state().status, "deferred");
    updater.setConnection(local);
    await flush();
    assert.equal(updater.state().status, phase === "checking" ? "downloading" : "ready");
    assert.equal(autoUpdater.downloads, 1);
  });
}

for (const phase of ["before download starts", "during download", "ready"]) {
  test(`remote A -> B -> A after consent ${phase} rejects every stale response`, async () => {
    const a = remote("1.0.0", "https://a.example");
    const b = remote("1.0.0", "https://b.example");
    const { autoUpdater, updater, emit, response } = setup({ connection: a });
    emit("update-available", { version: VERSION });
    const oldA = response();
    updater.respond(oldA);
    if (phase !== "before download starts") await flush();
    if (phase === "ready") emit("update-downloaded", { version: VERSION });
    updater.setConnection(b);
    const oldB = response();
    updater.respond(oldA);
    assert.equal(updater.state().status, "consent-required");
    updater.setConnection(a);
    const newA = response();
    assert.notEqual(
      newA.consentId,
      oldA.consentId,
      "returning to the same URL must not restore its old consent",
    );
    assert.notEqual(newA.consentId, oldB.consentId);
    updater.respond(oldA);
    updater.respond(oldB);
    await flush();
    assert.equal(updater.state().status, "consent-required");
    assertBlocked(updater, autoUpdater);
    if (phase === "during download") emit("update-downloaded", { version: VERSION });
    updater.respond(newA);
    await flush();
    assert.equal(updater.state().status, phase === "before download starts" ? "downloading" : "ready");
    assert.equal(autoUpdater.downloads, 1);
  });
}

test("A -> B -> A while checking cannot reuse an earlier prompt response", async () => {
  const a = remote();
  const { autoUpdater, updater, emit, response } = setup({ connection: a });
  updater.check();
  updater.setConnection(remote(null, "https://b.example"));
  updater.setConnection(a);
  await flush();
  emit("update-available", { version: VERSION });
  const old = response();
  updater.setConnection(remote(null, "https://b.example"));
  updater.setConnection(a);
  updater.respond(old);
  await flush();
  assert.equal(updater.state().status, "consent-required");
  assert.equal(autoUpdater.downloads, 0);
});

test("an identical connection refresh preserves consent; a server version change invalidates it", async () => {
  const connection = remote("1.0.0");
  const { autoUpdater, updater, emit, response } = setup({ connection });
  emit("update-available", { version: VERSION });
  const input = response();
  updater.setConnection({ ...connection });
  assert.equal(updater.state().consentId, input.consentId);
  updater.respond(input);
  await flush();
  updater.setConnection({ ...connection });
  assert.equal(updater.state().status, "downloading");
  updater.setConnection(remote("1.0.1"));
  assert.equal(updater.state().status, "consent-required");
  updater.respond(input);
  assertBlocked(updater, autoUpdater);
  emit("update-downloaded", { version: VERSION });
  assert.equal(updater.state().status, "consent-required");
  updater.setConnection(remote(VERSION));
  assert.equal(updater.state().status, "ready");
  assert.equal(autoUpdater.downloads, 1);
});

test("a newly advertised release invalidates consent for an earlier version", async () => {
  const { autoUpdater, updater, emit, response } = setup({ connection: remote() });
  emit("update-available", { version: VERSION });
  const old = response();
  updater.respond(old);
  await flush();
  emit("update-downloaded", { version: VERSION });
  emit("update-available", { version: "1.2.0" });
  assert.equal(updater.state().status, "consent-required");
  assert.equal(updater.state().version, "1.2.0");
  updater.respond(old);
  assertBlocked(updater, autoUpdater);
  assert.equal(autoUpdater.downloads, 1);
});

test("deferral hides the prompt until a later check reminds without rechecking or downloading", async () => {
  const { autoUpdater, updater, emit, response } = setup({ connection: remote() });
  emit("update-available", { version: VERSION });
  updater.respond(response("defer"));
  assert.equal(updater.state().status, "deferred");
  assert.equal(updater.state().consentId, undefined);
  assertBlocked(updater, autoUpdater);
  updater.check();
  assert.equal(updater.state().status, "consent-required");
  await flush();
  assert.equal(autoUpdater.checks, 0);
  assert.equal(autoUpdater.downloads, 0);
  updater.respond(response());
  await flush();
  assert.equal(autoUpdater.downloads, 1);
});

test("deferral during an old connection's download survives download completion and duplicate availability", async () => {
  const { autoUpdater, updater, emit, response } = setup();
  emit("update-available", { version: VERSION });
  await flush();
  updater.setConnection(remote());
  updater.respond(response("defer"));
  emit("download-progress", { percent: 85 });
  emit("update-downloaded", { version: VERSION });
  assert.equal(updater.state().status, "deferred");
  emit("update-available", { version: VERSION });
  assert.equal(updater.state().status, "deferred");
  assertBlocked(updater, autoUpdater);
  updater.check();
  assert.equal(updater.state().status, "consent-required");
  updater.respond(response());
  assert.equal(updater.state().status, "ready");
  assert.equal(autoUpdater.downloads, 1);
});

test("checking is concurrent-safe and ignores available, downloading and ready work", async () => {
  const { autoUpdater, updater, emit } = setup();
  updater.check();
  updater.check();
  updater.check();
  await flush();
  assert.equal(autoUpdater.checks, 1);
  emit("update-available", { version: VERSION });
  updater.check();
  emit("update-available", { version: VERSION });
  await flush();
  assert.equal(autoUpdater.downloads, 1);
  assert.equal(autoUpdater.checks, 1);
  emit("checking-for-update");
  emit("update-not-available");
  assert.equal(updater.state().status, "downloading");
  emit("update-downloaded", { version: VERSION });
  updater.check();
  emit("checking-for-update");
  emit("update-not-available");
  emit("error", new Error("Offline"));
  await flush();
  assert.equal(updater.state().status, "ready");
  assert.equal(updater.state().version, VERSION);
  assert.equal(autoUpdater.checks, 1);
});

test("pending consent is not hidden by checks, no-update responses or errors", async () => {
  const { autoUpdater, updater, emit, response } = setup({ connection: remote() });
  emit("update-available", { version: VERSION });
  const input = response();
  updater.check();
  emit("checking-for-update");
  emit("update-not-available");
  emit("error", new Error("Offline"));
  await flush();
  assert.equal(updater.state().status, "consent-required");
  assert.equal(updater.state().consentId, input.consentId);
  assert.equal(updater.state().version, VERSION);
  assert.equal(autoUpdater.checks, 0);
});

test("no-update results clear an idle check and allow a later check", async () => {
  const { autoUpdater, updater, emit } = setup();
  updater.check();
  await flush();
  emit("checking-for-update");
  emit("update-not-available");
  assert.equal(updater.state().status, "up-to-date");
  assert.equal(updater.state().version, null);
  assert.equal(updater.state().progress, null);
  updater.check();
  await flush();
  assert.equal(autoUpdater.checks, 2);
});

test("malformed availability events do not trigger downloads", async () => {
  const { autoUpdater, updater, emit } = setup();
  for (const info of [undefined, null, {}, { version: 12 }]) emit("update-available", info);
  await flush();
  assert.equal(updater.state().version, null);
  assert.equal(autoUpdater.downloads, 0);
});

test("error summaries trim lines and cap length, log originals and support retry", async () => {
  const { autoUpdater, updater, emit, errors } = setup();
  for (const [error, expected] of [
    [new Error("Offline"), "Offline"],
    [new Error(` 404 \nmethod: GET\nHeaders: ${"x".repeat(5000)}`), "404"],
    [new Error("x".repeat(250)), "x".repeat(200)],
    [new Error("   "), t("updater.checkFailed")],
    ["not an Error", t("updater.checkFailed")],
  ]) {
    emit("error", error);
    assert.equal(updater.state().status, "error");
    assert.equal(updater.state().error, expected);
    assert.equal(errors.at(-1), error);
  }
  updater.check();
  assert.equal(updater.state().error, null);
  await flush();
  assert.equal(autoUpdater.checks, 1);
});

for (const sync of [false, true]) {
  test(`${sync ? "synchronous" : "rejected"} check failure without an error event is retryable`, async () => {
    const { autoUpdater, updater, errors } = setup();
    const error = new Error("Check unavailable\nprivate diagnostics");
    autoUpdater.checkForUpdates = () => {
      if (sync) throw error;
      return Promise.reject(error);
    };
    updater.check();
    await flush();
    assert.equal(updater.state().status, "error");
    assert.equal(updater.state().error, "Check unavailable");
    assert.ok(errors.includes(error));
    autoUpdater.checkForUpdates = async () => {
      autoUpdater.checks += 1;
    };
    updater.check();
    await flush();
    assert.equal(autoUpdater.checks, 1);
  });
}

for (const status of ["consent-required", "deferred", "ready"]) {
  test(`late check rejection preserves ${status}`, async () => {
    const { autoUpdater, updater, emit, response } = setup();
    let reject;
    autoUpdater.checkForUpdates = () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      });
    updater.check();
    await flush();
    emit("update-available", { version: VERSION });
    await flush();
    if (status === "ready") emit("update-downloaded", { version: VERSION });
    else {
      updater.setConnection(remote());
      if (status === "deferred") updater.respond(response("defer"));
    }
    reject(new Error("Late check failure"));
    await flush();
    assert.equal(updater.state().status, status);
    assert.equal(updater.state().version, VERSION);
  });
}

for (const sync of [false, true]) {
  test(`${sync ? "synchronous" : "rejected"} download failure is reported without unhandled rejections`, async () => {
    const { autoUpdater, updater, emit, errors } = setup();
    const error = new Error("Download failed\nprivate diagnostics");
    autoUpdater.downloadUpdate = () => {
      if (sync) throw error;
      return Promise.reject(error);
    };
    emit("update-available", { version: VERSION });
    await flush();
    assert.equal(updater.state().status, "error");
    assert.equal(updater.state().error, "Download failed");
    assert.ok(errors.includes(error));
    assertBlocked(updater, autoUpdater);
  });
}

test("a late download failure cannot hide a switched connection's consent prompt", async () => {
  const { autoUpdater, updater, emit, errors } = setup();
  let reject;
  autoUpdater.downloadUpdate = () =>
    new Promise((_resolve, fail) => {
      reject = fail;
    });
  emit("update-available", { version: VERSION });
  await flush();
  updater.setConnection(remote());
  const error = new Error("Download stopped");
  reject(error);
  await flush();
  assert.equal(updater.state().status, "consent-required");
  assert.equal(updater.state().error, null);
  assert.deepEqual(errors, [error]);
  assertBlocked(updater, autoUpdater);
});

test("timers check shortly after launch and periodically, with guarded reminder behavior", async () => {
  const { autoUpdater, updater, emit, response } = setup({ connection: remote() });
  const scheduled = [];
  updater.start({
    setTimeout: (run, ms) => scheduled.push({ kind: "once", run, ms }),
    setInterval: (run, ms) => scheduled.push({ kind: "every", run, ms }),
  });
  assert.equal(FIRST_CHECK_DELAY_MS, 10_000);
  assert.equal(CHECK_INTERVAL_MS, 6 * 60 * 60_000);
  assert.deepEqual(
    scheduled.map(({ kind, ms }) => [kind, ms]),
    [
      ["once", FIRST_CHECK_DELAY_MS],
      ["every", CHECK_INTERVAL_MS],
    ],
  );
  scheduled[0].run();
  scheduled[1].run();
  await flush();
  assert.equal(autoUpdater.checks, 1);
  emit("update-available", { version: VERSION });
  updater.respond(response("defer"));
  scheduled[1].run();
  assert.equal(updater.state().status, "consent-required");
  await flush();
  assert.equal(autoUpdater.checks, 1, "a deferred update is reminded, not checked again");
  assert.equal(autoUpdater.downloads, 0);
});

test("disabled builds never listen, schedule, check, download, accept consent or install", async () => {
  const { autoUpdater, updater, response, assertLibraryFlags } = setup({
    enabled: false,
    connection: remote(),
  });
  const scheduled = [];
  updater.start({ setTimeout: () => scheduled.push(1), setInterval: () => scheduled.push(1) });
  updater.check();
  updater.setConnection(local);
  autoUpdater.emit("checking-for-update");
  autoUpdater.emit("update-available", { version: VERSION });
  autoUpdater.emit("download-progress", { percent: 100 });
  autoUpdater.emit("update-downloaded", { version: VERSION });
  updater.respond(response());
  await flush();
  assert.equal(updater.state().status, "disabled");
  assert.equal(updater.state().version, null);
  assert.equal(autoUpdater.checks, 0);
  assert.equal(autoUpdater.downloads, 0);
  assert.deepEqual(scheduled, []);
  assert.deepEqual(autoUpdater.eventNames(), []);
  assertBlocked(updater, autoUpdater);
  assertLibraryFlags();
});

test("install begins once, freezes connection selection and prevents later checks", async () => {
  const { autoUpdater, updater, emit, assertLibraryFlags } = setup();
  emit("update-available", { version: VERSION });
  await flush();
  emit("update-downloaded", { version: VERSION });
  assert.equal(updater.install(), true);
  updater.setConnection(remote());
  assert.equal(updater.state().status, "ready");
  assert.equal(updater.state().serverVersion, null);
  assert.equal(updater.isInstalling(), true);
  assert.equal(updater.installOnQuit(), false);
  updater.check();
  await flush();
  assert.equal(autoUpdater.checks, 0);
  assert.equal(autoUpdater.installs, 1);
  assertLibraryFlags();
});

test("a scheduled reminder can reopen consent before an old connection's download finishes", async () => {
  const { autoUpdater, updater, emit, response } = setup();
  emit("update-available", { version: VERSION });
  await flush();
  updater.setConnection(remote());
  updater.respond(response("defer"));
  updater.check();
  assert.equal(updater.state().status, "consent-required");
  updater.respond(response());
  assert.equal(updater.state().status, "downloading");
  await flush();
  assert.equal(autoUpdater.downloads, 1);
  emit("update-downloaded", { version: VERSION });
  assert.equal(updater.state().status, "ready");
});

test("deferral is scoped to the connection and release, not remembered after switching away", async () => {
  const a = remote();
  const { autoUpdater, updater, emit, response } = setup({ connection: a });
  emit("update-available", { version: VERSION });
  const old = response("defer");
  updater.respond(old);
  updater.setConnection(remote(null, "https://b.example"));
  assert.equal(updater.state().status, "consent-required");
  updater.setConnection(a);
  assert.equal(updater.state().status, "consent-required");
  updater.respond(old);
  assert.equal(
    updater.state().status,
    "consent-required",
    "stale defer responses must not hide a new prompt",
  );
  updater.respond(response("defer"));
  emit("update-available", { version: "1.2.0" });
  assert.equal(updater.state().status, "consent-required");
  assert.equal(updater.state().version, "1.2.0");
  await flush();
  assert.equal(autoUpdater.downloads, 0);
});

test("progress tolerates missing percent and completion retains the available version when omitted", async () => {
  const { updater, emit } = setup();
  emit("update-available", { version: VERSION });
  await flush();
  emit("download-progress", undefined);
  assert.equal(updater.state().progress, 0);
  emit("download-progress", {});
  assert.equal(updater.state().progress, 0);
  emit("update-downloaded", undefined);
  assert.equal(updater.state().status, "ready");
  assert.equal(updater.state().version, VERSION);
});

test("a thrown native install resets the installing guard and allows retry", async () => {
  const { autoUpdater, updater, emit, errors, assertLibraryFlags } = setup();
  emit("update-available", { version: VERSION });
  await flush();
  emit("update-downloaded", { version: VERSION });
  const error = new Error("Native install unavailable\nprivate diagnostics");
  autoUpdater.quitAndInstall = () => {
    throw error;
  };
  assert.equal(updater.installOnQuit(), false);
  assert.equal(updater.isInstalling(), false);
  assert.equal(updater.state().status, "ready");
  assert.equal(updater.state().error, "Native install unavailable");
  assert.deepEqual(errors, [error]);
  updater.setConnection(remote());
  assert.equal(
    updater.state().status,
    "consent-required",
    "a failed install must not freeze connection policy",
  );
  assert.equal(updater.installOnQuit(), false);
  updater.setConnection(local);
  autoUpdater.quitAndInstall = () => {
    autoUpdater.installs += 1;
  };
  assert.equal(updater.install(), true);
  assert.equal(updater.isInstalling(), true);
  assert.equal(autoUpdater.installs, 1);
  assertLibraryFlags();
});

test("late check events and errors cannot discard a deferred update or bypass its reminder", async () => {
  const { autoUpdater, updater, emit, response } = setup({ connection: remote() });
  emit("update-available", { version: VERSION });
  updater.respond(response("defer"));
  for (const [event, payload] of [
    ["checking-for-update"],
    ["update-not-available"],
    ["error", new Error("Offline")],
  ]) {
    emit(event, payload);
    assert.equal(updater.state().status, "deferred");
    assert.equal(updater.state().version, VERSION);
    assert.equal(updater.state().consentId, undefined);
    assertBlocked(updater, autoUpdater);
  }
  updater.check();
  assert.equal(updater.state().status, "consent-required");
  await flush();
  assert.equal(autoUpdater.checks, 0);
  assert.equal(autoUpdater.downloads, 0);
});

test("native install error events release the connection lock and ordinary quit, with manual retry", async () => {
  const { autoUpdater, updater, emit } = setup();
  emit("update-available", { version: VERSION });
  await flush();
  emit("update-downloaded", { version: VERSION });
  assert.equal(updater.install(), true);
  emit("error", new Error("Native staging failed\nprivate diagnostic"));
  assert.equal(updater.isInstalling(), false);
  assert.equal(updater.state().status, "error");
  assert.equal(updater.state().error, "Native staging failed");
  assert.equal(updater.installOnQuit(), false, "ordinary quit must not get stuck retrying an installer");
  updater.check();
  assert.equal(updater.state().status, "ready");
  assert.equal(autoUpdater.checks, 0, "retry can reuse the already downloaded update");
  updater.setConnection(remote());
  assert.equal(updater.state().status, "consent-required");
  assert.equal(updater.install(), false);
  assert.equal(updater.installOnQuit(), false);
  assert.equal(autoUpdater.installs, 1, "no additional native install attempt without new consent");
});

test("a synchronously emitted native error does not block ordinary quit", async () => {
  const { autoUpdater, updater, emit } = setup();
  emit("update-available", { version: VERSION });
  await flush();
  emit("update-downloaded", { version: VERSION });
  autoUpdater.quitAndInstall = () => emit("error", new Error("Installer missing"));
  assert.equal(updater.installOnQuit(), false);
  assert.equal(updater.isInstalling(), false);
  assert.equal(updater.state().status, "error");
});
