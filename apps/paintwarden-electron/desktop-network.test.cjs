const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { discoverPhoneHosts, configureChild, createPhoneAccess } = require("./desktop-network.cjs");
const { createPreferences } = require("./desktop-preferences.cjs");

async function preferences(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "phone-access-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "preferences.json");
  return { file, preferences: createPreferences(file) };
}
function child() {
  return Object.assign(new EventEmitter(), { connected: true, exitCode: null, killed: false });
}

test("phone preferences survive language/connection changes and sanitize malformed values", async (t) => {
  const { file, preferences: prefs } = await preferences(t);
  await Promise.all([
    prefs.setPhoneAccess({ enabled: true, port: 48181 }),
    prefs.setLanguage("ja"),
    prefs.setConnection({ mode: "local" }),
  ]);
  assert.deepEqual(await prefs.read(), {
    mode: "local",
    language: "ja",
    phoneAccess: { enabled: true, port: 48181 },
  });
  await prefs.setConnection({ mode: "remote", serverUrl: "https://example.com" });
  assert.deepEqual((await createPreferences(file).read()).phoneAccess, { enabled: true, port: 48181 });
  await writeFile(file, JSON.stringify({ mode: "local", phoneAccess: { enabled: "true", port: -1 } }));
  assert.deepEqual((await prefs.read()).phoneAccess, { enabled: false, port: 48177 });
  assert.equal(
    JSON.parse(await readFile(file, "utf8")).phoneAccess.port,
    -1,
    "reads do not rewrite preferences",
  );
});

test("discovery uses external IPv4 and fixed bounded Tailscale CLI only", async () => {
  const result = await discoverPhoneHosts({
    interfaces: () => ({
      en0: [
        { address: "192.168.1.2", family: "IPv4", internal: false },
        { address: "127.0.0.1", family: "IPv4", internal: true },
        { address: "::1", family: "IPv6", internal: false },
        { address: "169.254.0.1", family: "IPv4", internal: false },
      ],
    }),
    execute: (command, args, options, callback) => {
      assert.equal(command, "tailscale");
      assert.deepEqual(args, ["status", "--json"]);
      assert.equal(options.timeout, 2500);
      assert.equal(options.shell, undefined);
      callback(
        null,
        JSON.stringify({
          BackendState: "Running",
          Self: { TailscaleIPs: ["100.64.0.2", "fd7a::2"], DNSName: "Device.tail.ts.net." },
        }),
      );
    },
  });
  assert.deepEqual(result, {
    hosts: ["192.168.1.2", "100.64.0.2", "device.tail.ts.net"],
    magicDns: ["device.tail.ts.net"],
    tailscale: true,
  });
  for (const stdout of ["not json", "null", "{}", JSON.stringify({ BackendState: "Stopped" })]) {
    const absent = await discoverPhoneHosts({
      interfaces: () => ({}),
      execute: (_a, _b, _c, cb) => cb(null, stdout),
    });
    assert.deepEqual(absent, { hosts: [], magicDns: [], tailscale: false });
  }
});

test("child IPC uses correlation IDs and cleans up on replies and exits", async () => {
  const process = child();
  process.send = (message, callback) => {
    callback(null);
    process.emit("message", {
      type: "phone-access:result",
      id: "unrelated",
      state: { enabled: false, port: 48177 },
    });
    process.emit("message", {
      type: "phone-access:result",
      id: message.id,
      state: { enabled: true, port: 48178 },
    });
  };
  assert.deepEqual(await configureChild(process, { enabled: true }), { enabled: true, port: 48178 });
  assert.equal(process.listenerCount("message"), 0);
  process.send = () => process.emit("exit");
  await assert.rejects(configureChild(process, { enabled: true }), /could not start/);
  assert.equal(process.listenerCount("message"), 0);
});

test("serialized toggles persist actual port, restore local only, stop on remote, invalidate exited child", async (t) => {
  const { preferences: prefs } = await preferences(t);
  let local = true;
  let current = child();
  const calls = [];
  const access = createPhoneAccess({
    getChild: () => current,
    available: () => local,
    preferences: prefs,
    discover: async () => ({ hosts: ["192.168.1.2"], magicDns: [], tailscale: false }),
    configure: async (_child, config) => {
      calls.push(config);
      return { enabled: config.enabled, port: config.port === 48177 ? 48178 : config.port };
    },
  });
  assert.equal((await access.get()).enabled, false);
  assert.equal((await access.set(true)).enabled, true);
  assert.deepEqual((await access.get()).addresses, ["http://192.168.1.2:48178"]);
  assert.equal((await prefs.read()).phoneAccess.port, 48178);
  await Promise.all([access.set(false), access.set(true), access.set(false)]);
  assert.deepEqual(
    calls.slice(-3).map((call) => call.enabled),
    [false, true, false],
  );
  await access.set(true);
  local = false;
  assert.equal((await access.get()).enabled, false);
  assert.equal((await access.restore()).available, false);
  assert.equal(calls.at(-1).enabled, false);
  assert.equal((await prefs.read()).phoneAccess.enabled, true, "remote mode preserves local preference");
  const count = calls.length;
  await access.set(true);
  assert.equal(calls.length, count, "remote mode never configures a listener");
  local = true;
  assert.equal((await access.restore()).enabled, true);
  current.killed = true;
  assert.equal((await access.get()).enabled, false);
  current = child();
  assert.equal((await access.get()).enabled, false);
  assert.equal((await access.restore()).enabled, true);
  await assert.rejects(access.set("true"), /Invalid/);
});

test("discovery/mode races fail closed; errors never leak subprocess details", async (t) => {
  const { preferences: prefs } = await preferences(t);
  let local = true;
  let complete;
  const gate = new Promise((resolve) => {
    complete = resolve;
  });
  const calls = [];
  const access = createPhoneAccess({
    getChild: () => process,
    available: () => local,
    preferences: prefs,
    discover: async () => {
      await gate;
      return { hosts: ["192.168.1.2"], magicDns: [], tailscale: false };
    },
    configure: async (_process, config) => {
      calls.push(config);
      throw new Error("private path and secret");
    },
  });
  const process = child();
  const changing = access.set(true);
  local = false;
  complete();
  assert.equal((await changing).enabled, false);
  assert.equal(calls.length, 0);
  local = true;
  const failed = await access.set(true);
  assert.equal(failed.enabled, false);
  assert.equal(failed.error.includes("secret"), false);
  assert.equal(calls.at(-1).enabled, false);
});

test("enabled refresh does not reopen unchanged listeners but updates changed addresses", async (t) => {
  const { preferences: prefs } = await preferences(t);
  const process = child();
  let host = "192.168.1.2";
  let configurations = 0;
  const access = createPhoneAccess({
    getChild: () => process,
    available: () => true,
    preferences: prefs,
    discover: async () => ({ hosts: [host], magicDns: [], tailscale: false }),
    configure: async (_process, config) => {
      configurations++;
      return { enabled: config.enabled, port: config.port };
    },
  });
  await access.set(true);
  assert.equal(configurations, 1);
  await access.get();
  await access.get();
  assert.equal(configurations, 1);
  host = "192.168.2.2";
  assert.deepEqual((await access.get()).addresses, ["http://192.168.2.2:48177"]);
  assert.equal(configurations, 2);
});

test("preference write errors fail closed and never leak file paths", async () => {
  const process = child();
  const configurations = [];
  const access = createPhoneAccess({
    getChild: () => process,
    available: () => true,
    preferences: {
      read: async () => ({ phoneAccess: { enabled: true, port: 48177 } }),
      setPhoneAccess: async () => {
        throw new Error("/private/user/data EACCES");
      },
    },
    configure: async (_process, config) => {
      configurations.push(config);
      return { enabled: false, port: 48177 };
    },
  });
  const result = await access.set(false);
  assert.equal(result.enabled, false);
  assert.equal(result.error.includes("private"), false);
  assert.equal(configurations.at(-1).enabled, false);
});

test("a synchronously failed IPC send removes listeners and timer", async () => {
  const process = child();
  process.send = () => {
    throw new Error("IPC channel closed");
  };
  await assert.rejects(configureChild(process, { enabled: true }), /IPC channel/);
  assert.equal(process.listenerCount("message"), 0);
  assert.equal(process.listenerCount("exit"), 0);
});
