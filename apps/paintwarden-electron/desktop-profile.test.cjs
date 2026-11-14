const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { resolveProfile, migrateProfile } = require("./desktop-profile.cjs");

function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "paintwarden-profile-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const appData = path.join(home, "Library", "Application Support");
  fs.mkdirSync(appData, { recursive: true });
  const profile = resolveProfile({ home, appData, platform: "darwin" });
  return { home, appData, ...profile };
}
function put(root, filename, content) {
  const target = path.join(root, filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
function snapshot(root) {
  if (!fs.existsSync(root)) return null;
  const entries = {};
  function visit(directory, relative = "") {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) {
        entries[`${name}/`] = "directory";
        visit(path.join(directory, entry.name), name);
      } else if (entry.isSymbolicLink())
        entries[name] = { link: fs.readlinkSync(path.join(directory, entry.name)) };
      else entries[name] = fs.readFileSync(path.join(directory, entry.name)).toString("base64");
    }
  }
  visit(root);
  return entries;
}
function injected(method, code, match = () => true) {
  return new Proxy(fs, {
    get(target, key) {
      if (key !== method) return target[key];
      return (...args) => {
        if (match(...args)) throw Object.assign(new Error(`Injected ${code}`), { code });
        return target[key](...args);
      };
    },
  });
}

test("macOS destination and legacy layouts resolve without creating anything", (t) => {
  const p = fixture(t);
  assert.equal(p.root, path.join(p.appData, "Paintwarden"));
  assert.equal(p.userData, path.join(p.root, "electron"));
  assert.deepEqual(p.legacyPaths, [
    { path: path.join(p.appData, "PaintVault"), kind: "root" },
    { path: path.join(p.appData, "Paint Vault"), kind: "electron" },
  ]);
  assert.equal(fs.existsSync(p.root), false);
});

test("Windows uses LOCALAPPDATA root and roaming spaced Electron profile", () => {
  const p = resolveProfile({
    platform: "win32",
    home: "C:\\Users\\fixture",
    appData: "C:\\Users\\fixture\\AppData\\Roaming",
    localAppData: "C:\\Users\\fixture\\AppData\\Local",
  });
  assert.equal(p.root, "C:\\Users\\fixture\\AppData\\Local\\Paintwarden");
  assert.deepEqual(p.legacyPaths, [
    { path: "C:\\Users\\fixture\\AppData\\Local\\PaintVault", kind: "root" },
    { path: "C:\\Users\\fixture\\AppData\\Roaming\\Paint Vault", kind: "electron" },
  ]);
  assert.equal(
    resolveProfile({ platform: "win32", home: "C:\\fixture", appData: "C:\\roaming" }).root,
    "C:\\roaming\\Paintwarden",
  );
});

test("override never even reads home/appData/localAppData getters and has no discovery", (t) => {
  const p = fixture(t);
  const options = { platform: process.platform, override: path.join(p.home, "isolated") };
  for (const key of ["home", "appData", "localAppData"])
    Object.defineProperty(options, key, {
      get() {
        throw new Error("Must not access normal profile");
      },
    });
  const isolated = resolveProfile(options);
  assert.deepEqual(isolated.legacyPaths, []);
  assert.equal(isolated.isolated, true);
  put(p.legacyPaths[0].path, "database.sqlite", "must not migrate");
  assert.equal(migrateProfile(isolated.root, isolated.legacyPaths).status, "fresh");
  assert.equal(fs.existsSync(isolated.root), false);
  assert.equal(
    fs.readFileSync(path.join(p.legacyPaths[0].path, "database.sqlite"), "utf8"),
    "must not migrate",
  );
  assert.throws(() => resolveProfile({ override: "relative" }), /absolute/);
});

test("whole PaintVault root migrates once, preserving DB/WAL/images/connection/cache/logs byte-for-byte", (t) => {
  const p = fixture(t);
  const old = p.legacyPaths[0].path;
  for (const [name, content] of Object.entries({
    "paint-vault.sqlite": Buffer.from([0, 255, 1, 0, 100]),
    "paint-vault.sqlite-wal": "uncheckpointed database",
    "images/12/front.png": Buffer.from([137, 80, 78, 71, 0, 255]),
    "client-connection.json": '{"mode":"remote","url":"https://private.example","token":"secret"}',
    "electron/Cache/Cache_Data/data_0": "cache bytes",
    "electron/Preferences": "preferences",
    "electron/logs/vault-server.log": "server log",
    "electron/logs/vault-desktop.log": "desktop log",
  }))
    put(old, name, content);
  fs.mkdirSync(path.join(old, "empty-directory"));
  const before = snapshot(old);
  const inode = fs.statSync(old).ino;
  const result = migrateProfile(p.root, p.legacyPaths);
  assert.equal(result.ok, true);
  assert.equal(result.status, "migrated");
  assert.equal(result.source.kind, "root");
  assert.equal(fs.existsSync(old), false);
  assert.deepEqual(snapshot(p.root), before);
  assert.equal(fs.statSync(p.root).ino, inode, "root was renamed, not copied");
  assert.equal(fs.existsSync(`${p.root}.migration-lock`), false);
  assert.equal(migrateProfile(p.root, p.legacyPaths).status, "existing");
  assert.deepEqual(snapshot(p.root), before);
});

test("spaced Paint Vault userData is wrapped in electron, never mistaken for a vault root", (t) => {
  const p = fixture(t);
  const old = p.legacyPaths[1].path;
  put(old, "Preferences", "saved preferences");
  put(old, "Local Storage/leveldb/000003.log", "saved electron state");
  put(old, "logs/old.log", "saved log");
  const before = snapshot(old);
  const result = migrateProfile(p.root, p.legacyPaths);
  assert.equal(result.ok, true);
  assert.equal(result.status, "migrated");
  assert.deepEqual(fs.readdirSync(p.root), ["electron"]);
  assert.deepEqual(snapshot(p.userData), before);
  assert.equal(fs.existsSync(old), false);
  assert.equal(migrateProfile(p.root, p.legacyPaths).status, "existing");
});

test("fresh and existing profiles are not mutated or eagerly created", (t) => {
  const p = fixture(t);
  const before = snapshot(p.home);
  assert.equal(migrateProfile(p.root, p.legacyPaths).status, "fresh");
  assert.deepEqual(snapshot(p.home), before);
  put(p.root, "database.sqlite", "already migrated");
  const existing = snapshot(p.home);
  assert.equal(migrateProfile(p.root, p.legacyPaths).status, "existing");
  assert.deepEqual(snapshot(p.home), existing);
});

for (const scenario of ["two legacy", "old and new", "old and empty new"]) {
  test(`ambiguity fails closed without mutation: ${scenario}`, (t) => {
    const p = fixture(t);
    put(p.legacyPaths[0].path, "database.sqlite", "old data");
    if (scenario === "two legacy") put(p.legacyPaths[1].path, "Preferences", "old electron data");
    else if (scenario === "old and new") put(p.root, "database.sqlite", "new data");
    else fs.mkdirSync(p.root);
    const before = snapshot(p.home);
    const result = migrateProfile(p.root, p.legacyPaths);
    assert.equal(result.ok, false);
    assert.equal(result.status, "conflict");
    assert.equal(result.code, "PROFILE_CONFLICT");
    assert.deepEqual(snapshot(p.home), before);
  });
}

for (const kind of ["root", "electron"]) {
  for (const code of ["EACCES", "EPERM", "EXDEV", "EIO"]) {
    test(`${kind} rename ${code}: legacy untouched, no destination, Retry succeeds`, (t) => {
      const p = fixture(t);
      const old = p.legacyPaths.find((entry) => entry.kind === kind).path;
      put(old, "private-file", "sensitive data");
      const before = snapshot(p.home);
      const result = migrateProfile(p.root, p.legacyPaths, { fs: injected("renameSync", code) });
      assert.equal(result.ok, false);
      assert.equal(result.code, code);
      assert.deepEqual(snapshot(p.home), before);
      assert.equal(fs.existsSync(p.root), false);
      assert.equal(migrateProfile(p.root, p.legacyPaths).status, "migrated");
    });
  }
}

test("inspection permission error is not confused with a nonexistent legacy profile", (t) => {
  const p = fixture(t);
  put(p.legacyPaths[0].path, "database.sqlite", "old data");
  const before = snapshot(p.home);
  const result = migrateProfile(p.root, p.legacyPaths, {
    fs: injected("lstatSync", "EACCES", (filename) => filename === p.legacyPaths[0].path),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "EACCES");
  assert.deepEqual(snapshot(p.home), before);
});

test("wrapper mkdir permission failure leaves spaced legacy untouched", (t) => {
  const p = fixture(t);
  put(p.legacyPaths[1].path, "Preferences", "private");
  const before = snapshot(p.home);
  const result = migrateProfile(p.root, p.legacyPaths, {
    fs: injected("mkdirSync", "EACCES", (filename) => filename === p.root),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "EACCES");
  assert.deepEqual(snapshot(p.home), before);
});

test("migration lock fails closed and never removes another launch's lock", (t) => {
  const p = fixture(t);
  put(p.legacyPaths[0].path, "database.sqlite", "old data");
  fs.mkdirSync(`${p.root}.migration-lock`);
  const before = snapshot(p.home);
  const result = migrateProfile(p.root, p.legacyPaths);
  assert.equal(result.ok, false);
  assert.equal(result.code, "PROFILE_BUSY");
  assert.deepEqual(snapshot(p.home), before);
});

test("symlink/file profiles fail closed rather than following or overwriting them", (t) => {
  const p = fixture(t);
  put(p.home, "elsewhere/data", "private");
  fs.symlinkSync(path.join(p.home, "elsewhere"), p.legacyPaths[0].path, "dir");
  const before = snapshot(p.home);
  const result = migrateProfile(p.root, p.legacyPaths);
  assert.equal(result.ok, false);
  assert.equal(result.code, "PROFILE_UNSAFE_PATH");
  assert.deepEqual(snapshot(p.home), before);
  fs.unlinkSync(p.legacyPaths[0].path);
  fs.writeFileSync(p.root, "not a directory");
  assert.equal(migrateProfile(p.root, p.legacyPaths).code, "PROFILE_UNSAFE_PATH");
});

test("invalid or overlapping paths cannot mutate a profile", (t) => {
  const p = fixture(t);
  for (const candidate of [p.root, path.join(p.root, "nested"), p.appData]) {
    assert.equal(migrateProfile(p.root, [{ path: candidate, kind: "root" }]).code, "PROFILE_INVALID_PATH");
  }
  assert.equal(migrateProfile("relative", []).code, "PROFILE_INVALID_PATH");
  assert.equal(migrateProfile(p.root, [{ path: "relative", kind: "root" }]).code, "PROFILE_INVALID_PATH");
  assert.equal(fs.existsSync(p.root), false);
});

test("state is rechecked after locking: a newly present destination is never overwritten", (t) => {
  const p = fixture(t);
  put(p.legacyPaths[0].path, "database.sqlite", "old data");
  const io = new Proxy(fs, {
    get(target, key) {
      if (key !== "mkdirSync") return target[key];
      return (filename, ...args) => {
        const value = fs.mkdirSync(filename, ...args);
        if (filename === `${p.root}.migration-lock`) put(p.root, "database.sqlite", "other launch data");
        return value;
      };
    },
  });
  const result = migrateProfile(p.root, p.legacyPaths, { fs: io });
  assert.equal(result.status, "conflict");
  assert.equal(fs.readFileSync(path.join(p.legacyPaths[0].path, "database.sqlite"), "utf8"), "old data");
  assert.equal(fs.readFileSync(path.join(p.root, "database.sqlite"), "utf8"), "other launch data");
  assert.equal(fs.existsSync(`${p.root}.migration-lock`), false);
});

test("lock cleanup failure after commit is a warning, not a false migration failure", (t) => {
  const p = fixture(t);
  put(p.legacyPaths[0].path, "database.sqlite", "old data");
  const result = migrateProfile(p.root, p.legacyPaths, { fs: injected("rmdirSync", "EACCES") });
  assert.equal(result.ok, true);
  assert.equal(result.status, "migrated");
  assert.equal(result.lockCleanupError.code, "EACCES");
  assert.equal(fs.existsSync(p.legacyPaths[0].path), false);
  assert.equal(fs.readFileSync(path.join(p.root, "database.sqlite"), "utf8"), "old data");
  assert.equal(migrateProfile(p.root, p.legacyPaths).status, "existing");
});

test("a trailing separator cannot accidentally put the migration lock inside the destination", (t) => {
  const p = fixture(t);
  put(p.legacyPaths[0].path, "database.sqlite", "old data");
  const result = migrateProfile(p.root + path.sep, p.legacyPaths);
  assert.equal(result.status, "migrated");
  assert.equal(result.root, p.root);
  assert.deepEqual(fs.readdirSync(p.root), ["database.sqlite"]);
});

test("macOS synthetic HOME wins over Cocoa appData for ALL profile discovery", (t) => {
  const p = fixture(t);
  const options = { platform: "darwin", home: p.home };
  Object.defineProperty(options, "appData", {
    get() {
      throw new Error("Cocoa appData must not be read on macOS");
    },
  });
  const resolved = resolveProfile(options);
  assert.equal(resolved.root, p.root);
  assert.deepEqual(resolved.legacyPaths, p.legacyPaths);
  assert.ok(resolved.legacyPaths.every((entry) => entry.path.startsWith(p.home + path.sep)));
});
