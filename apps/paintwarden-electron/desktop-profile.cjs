const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

/** Resolve paths only; no filesystem access. Overrides never discover a normal profile. */
function resolveProfile(options = {}) {
  const platform = options.platform || process.platform;
  const paths = platform === "win32" ? path.win32 : path;
  if (options.override !== undefined && options.override !== null && options.override !== "") {
    if (typeof options.override !== "string" || !paths.isAbsolute(options.override))
      throw new TypeError("Desktop data directory must be an absolute path");
    const root = paths.normalize(options.override);
    return { root, userData: paths.join(root, "electron"), legacyPaths: [], isolated: true };
  }
  const home = options.home || os.homedir();
  const oldMacBase = paths.join(home, "Library", "Application Support");
  // Cocoa's appData can ignore an overridden HOME. Keep both old and new Mac
  // discovery rooted in the supplied home, matching the previous main.cjs.
  const appData =
    platform === "darwin"
      ? oldMacBase
      : options.appData || (platform === "win32" ? paths.join(home, "AppData", "Roaming") : oldMacBase);
  const base = platform === "win32" ? options.localAppData || appData : appData;
  const root = paths.join(base, "Paintwarden");
  const candidates = [
    { path: paths.join(platform === "win32" ? base : oldMacBase, "PaintVault"), kind: "root" },
    { path: paths.join(appData, "Paint Vault"), kind: "electron" },
  ];
  // Also recognize a root under a synthetic/non-mac appData location.
  if (platform !== "win32") candidates.push({ path: paths.join(appData, "PaintVault"), kind: "root" });
  const seen = new Set();
  const legacyPaths = candidates.filter((entry) => {
    const key = platform === "win32" ? entry.path.toLowerCase() : entry.path;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { root, userData: paths.join(root, "electron"), legacyPaths, isolated: false };
}

/**
 * Run synchronously BEFORE creating root/userData or starting Electron storage.
 * Only ok:true permits startup. On conflict/error, show recovery UI and Retry this
 * same call; never create an empty destination as a fallback. No copy/merge or
 * cross-device fallback is attempted. fs is injectable solely for fault tests.
 *
 * A sibling exclusive lock serializes cooperating launches. Whole roots move in
 * one rename. An Electron-only profile needs an empty wrapper first; its rename
 * is the final commit, so no fallible operation can turn a committed move into
 * an error. Do not run other profile writers during migration.
 */
function migrateProfile(destination, legacyPaths = [], options = {}) {
  const io = options.fs || fs;
  const result = {
    root: destination,
    userData: typeof destination === "string" ? path.join(destination, "electron") : undefined,
  };
  let lock;
  let wrapper = false;
  let committed = false;
  let outcome;
  const failure = (code, error, extra = {}) => ({
    ...result,
    ok: false,
    status: "error",
    code,
    error,
    ...extra,
  });
  const inspect = (filename) => {
    try {
      const info = io.lstatSync(filename);
      if (!info.isDirectory() || info.isSymbolicLink()) {
        const error = new Error("Profile path must be a directory, not a symlink or file");
        error.code = "PROFILE_UNSAFE_PATH";
        throw error;
      }
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  };
  try {
    if (typeof destination !== "string" || !path.isAbsolute(destination))
      throw Object.assign(new TypeError("Destination must be absolute"), { code: "PROFILE_INVALID_PATH" });
    destination = path.resolve(destination);
    result.root = destination;
    result.userData = path.join(destination, "electron");
    const root = destination;
    const seen = new Set();
    const candidates = legacyPaths
      .map((entry) => (typeof entry === "string" ? { path: entry, kind: "root" } : entry))
      .filter((entry) => {
        if (
          !entry ||
          typeof entry.path !== "string" ||
          !path.isAbsolute(entry.path) ||
          !["root", "electron"].includes(entry.kind)
        )
          throw Object.assign(new TypeError("Invalid legacy profile descriptor"), {
            code: "PROFILE_INVALID_PATH",
          });
        const candidate = path.resolve(entry.path);
        const relative = path.relative(root, candidate);
        const reverse = path.relative(candidate, root);
        if (
          !relative ||
          (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)) ||
          (!reverse.startsWith(`..${path.sep}`) && reverse !== ".." && !path.isAbsolute(reverse))
        )
          throw Object.assign(new Error("Destination and legacy profiles must not overlap"), {
            code: "PROFILE_INVALID_PATH",
          });
        if (seen.has(candidate)) return false;
        seen.add(candidate);
        return true;
      });
    const probe = () => {
      const targetExists = inspect(destination);
      const sources = candidates.filter((entry) => inspect(entry.path));
      if (sources.length > 1 || (targetExists && sources.length))
        return { ...result, ok: false, status: "conflict", code: "PROFILE_CONFLICT", sources, targetExists };
      if (!sources.length) return { ...result, ok: true, status: targetExists ? "existing" : "fresh" };
      return { source: sources[0] };
    };
    const initial = probe();
    if (!initial.source) return initial;
    const lockPath = `${destination}.migration-lock`;
    try {
      io.mkdirSync(lockPath, { mode: 0o700 });
      lock = lockPath;
    } catch (error) {
      return failure(error.code === "EEXIST" ? "PROFILE_BUSY" : error.code || "PROFILE_IO_ERROR", error);
    }
    // Recheck after locking: another launch may have completed since the first probe.
    const current = probe();
    if (!current.source) outcome = current;
    else {
      const source = current.source;
      if (source.kind === "electron") {
        // Exclusive mkdir refuses even an empty target created by another process.
        io.mkdirSync(destination, { mode: 0o700 });
        wrapper = true;
        io.renameSync(source.path, path.join(destination, "electron"));
      } else {
        io.renameSync(source.path, destination);
      }
      committed = true;
      outcome = { ...result, ok: true, status: "migrated", source };
    }
  } catch (error) {
    outcome = failure(error.code || "PROFILE_IO_ERROR", error);
  } finally {
    if (wrapper && !committed) {
      try {
        // Never recursive: never remove anything that another writer has created.
        io.rmdirSync(destination);
      } catch (error) {
        outcome = { ...outcome, cleanupError: error };
      }
    }
    if (lock) {
      try {
        io.rmdirSync(lock);
      } catch (error) {
        outcome = { ...outcome, lockCleanupError: error };
      }
    }
  }
  return outcome;
}

module.exports = { resolveProfile, migrateProfile };
