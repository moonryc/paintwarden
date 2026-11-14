// Own the download/install policy rather than allowing electron-updater to stage a native
// install. In particular, Squirrel.Mac cannot revoke a staged update on a server switch.
const { t } = require("./desktop-i18n.cjs");
const FIRST_CHECK_DELAY_MS = 10_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60_000;

const summary = (error) =>
  ((error instanceof Error ? error.message : "") || t("updater.checkFailed"))
    .split("\n")[0]
    .trim()
    .slice(0, 200) || t("updater.checkFailed");

function createUpdater({
  autoUpdater,
  currentVersion,
  enabled,
  connection = { mode: null },
  onChange,
  log = () => {},
}) {
  let selected = connection;
  let generation = 0;
  let consent = null;
  let deferred = null;
  let downloaded = false;
  let downloading = false;
  let installing = false;
  let state = {
    status: enabled ? "idle" : "disabled",
    currentVersion,
    version: null,
    progress: null,
    error: null,
    serverVersion: selected.mode === "remote" ? (selected.serverVersion ?? null) : null,
    consentId: undefined,
  };
  const set = (next) => {
    state = { ...state, ...next };
    onChange(state);
  };
  const consentId = () => `${generation}:${state.version}`;
  const permitted = () =>
    selected.mode === "local" ||
    (selected.mode === "remote" &&
      state.version !== null &&
      (selected.serverVersion === state.version || consent === consentId()));

  function download() {
    if (downloaded || downloading || !state.version || !permitted()) return;
    downloading = true;
    set({ status: "downloading", progress: 0, error: null, consentId: undefined });
    // The provider finishes processing update-available before downloadUpdate is called.
    void Promise.resolve()
      .then(() => {
        if (!permitted()) {
          downloading = false;
          reconcile();
          return;
        }
        return autoUpdater.downloadUpdate();
      })
      .catch((error) => {
        downloading = false;
        log(error);
        if (permitted()) set({ status: "error", error: summary(error) });
      });
  }

  function reconcile() {
    if (!enabled || !state.version || installing) return;
    if (!permitted()) {
      const prompt = selected.mode === "remote" && deferred !== consentId();
      set({ status: prompt ? "consent-required" : "deferred", consentId: prompt ? consentId() : undefined });
    } else if (downloaded) {
      set({ status: "ready", progress: 100, consentId: undefined });
    } else if (downloading) {
      set({ status: "downloading", consentId: undefined });
    } else download();
  }

  // Never let the library stage a native install: checking this flag only at quit is
  // too late on macOS. Local automatic-on-quit is implemented by installOnQuit below.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  if (enabled) {
    autoUpdater.on("checking-for-update", () => {
      if (!downloaded && !downloading && state.status !== "consent-required" && state.status !== "deferred")
        set({ status: "checking", error: null });
    });
    autoUpdater.on("update-not-available", () => {
      if (!downloaded && !downloading && state.status !== "consent-required" && state.status !== "deferred")
        set({ status: "up-to-date", version: null, progress: null });
    });
    autoUpdater.on("update-available", (info) => {
      if (typeof info?.version !== "string") return;
      if (state.version !== info.version) {
        consent = null;
        downloaded = false;
      }
      set({ version: info.version, error: null });
      reconcile();
    });
    autoUpdater.on("download-progress", (progress) => {
      set({ progress: Math.round(progress?.percent ?? 0) });
    });
    autoUpdater.on("update-downloaded", (info) => {
      downloading = false;
      downloaded = true;
      set({ version: info?.version ?? state.version, progress: 100 });
      // A connection may have changed during an in-flight download.
      reconcile();
    });
    autoUpdater.on("error", (error) => {
      log(error);
      if (installing) {
        installing = false;
        set({ status: "error", error: summary(error) });
        return;
      }
      downloading = false;
      if (!downloaded && state.status !== "consent-required" && state.status !== "deferred")
        set({ status: "error", error: summary(error) });
    });
  }

  function setConnection(next) {
    if (installing) return;
    if (
      selected.mode === next.mode &&
      selected.serverUrl === next.serverUrl &&
      selected.serverVersion === next.serverVersion
    )
      return;
    selected = next;
    generation++;
    consent = null;
    set({ serverVersion: next.mode === "remote" ? (next.serverVersion ?? null) : null });
    reconcile();
  }

  function respond(input) {
    if (
      !enabled ||
      state.status !== "consent-required" ||
      input?.version !== state.version ||
      input?.consentId !== consentId()
    )
      return state;
    if (input.action === "defer") {
      deferred = consentId();
      set({ status: "deferred", consentId: undefined });
    } else if (input.action === "download") {
      consent = consentId();
      reconcile();
    }
    return state;
  }

  function check() {
    if (!enabled || installing || state.status === "checking" || state.status === "ready") return state;
    if (downloaded && state.status === "error") {
      reconcile();
      return state;
    }
    if (state.status === "deferred" && state.version) {
      deferred = null;
      reconcile();
      return state;
    }
    if (downloading || state.status === "consent-required") return state;
    set({ status: "checking", error: null });
    void Promise.resolve()
      .then(() => autoUpdater.checkForUpdates())
      .catch((error) => {
        log(error);
        if (state.status === "checking") set({ status: "error", error: summary(error) });
      });
    return state;
  }

  function install() {
    if (!enabled || installing || !downloaded || state.status !== "ready" || !permitted()) return false;
    installing = true;
    try {
      autoUpdater.quitAndInstall();
      return installing;
    } catch (error) {
      installing = false;
      log(error);
      set({ error: summary(error) });
      return false;
    }
  }

  function start(timers = { setTimeout, setInterval }) {
    if (!enabled) return;
    timers.setTimeout(check, FIRST_CHECK_DELAY_MS);
    timers.setInterval(check, CHECK_INTERVAL_MS);
  }

  return {
    state: () => state,
    check,
    install,
    installOnQuit: install,
    isInstalling: () => installing,
    respond,
    setConnection,
    start,
  };
}

module.exports = { createUpdater, FIRST_CHECK_DELAY_MS, CHECK_INTERVAL_MS };
