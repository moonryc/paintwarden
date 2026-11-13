// Keeps the packaged desktop app current. Updates download in the background; the app then asks
// to restart, and installs on the next quit if the user waits. The updater object is passed in so
// the behavior can be tested without real releases.
const FIRST_CHECK_DELAY_MS = 10_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60_000;

// Updater errors can include whole HTTP responses; the app keeps only the first line.
const summary = (error) =>
  ((error instanceof Error ? error.message : "") || "Update check failed")
    .split("\n")[0]
    .trim()
    .slice(0, 200) || "Update check failed";

function createUpdater({ autoUpdater, currentVersion, enabled, onChange, log = () => {} }) {
  let state = {
    status: enabled ? "idle" : "disabled",
    currentVersion,
    version: null,
    progress: null,
    error: null,
  };
  const set = (next) => {
    state = { ...state, ...next };
    onChange(state);
  };

  if (enabled) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("checking-for-update", () => {
      // A downloaded update stays ready; later checks don't hide the restart prompt.
      if (state.status !== "ready") set({ status: "checking", error: null });
    });
    autoUpdater.on("update-not-available", () => {
      if (state.status !== "ready") set({ status: "up-to-date", version: null, progress: null });
    });
    autoUpdater.on("update-available", (info) =>
      set({ status: "downloading", version: info?.version ?? null, progress: 0 }),
    );
    autoUpdater.on("download-progress", (progress) =>
      set({ status: "downloading", progress: Math.round(progress?.percent ?? 0) }),
    );
    autoUpdater.on("update-downloaded", (info) =>
      set({ status: "ready", version: info?.version ?? state.version, progress: 100 }),
    );
    autoUpdater.on("error", (error) => {
      log(error);
      if (state.status !== "ready") set({ status: "error", error: summary(error) });
    });
  }

  function check() {
    if (!enabled || state.status === "checking" || state.status === "downloading" || state.status === "ready")
      return state;
    // Failures are logged and reported by the "error" event; the rejection only needs handling.
    Promise.resolve()
      .then(() => autoUpdater.checkForUpdates())
      .catch(() => undefined);
    return state;
  }

  function install() {
    if (state.status !== "ready") return false;
    autoUpdater.quitAndInstall();
    return true;
  }

  function start(timers = { setTimeout, setInterval }) {
    if (!enabled) return;
    timers.setTimeout(check, FIRST_CHECK_DELAY_MS);
    timers.setInterval(check, CHECK_INTERVAL_MS);
  }

  return { state: () => state, check, install, start };
}

module.exports = { createUpdater, FIRST_CHECK_DELAY_MS, CHECK_INTERVAL_MS };
