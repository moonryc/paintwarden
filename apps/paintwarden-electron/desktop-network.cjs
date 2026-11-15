const { execFile } = require("node:child_process");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const DEFAULT_PHONE_PORT = 48177;
const publicFailure = "Phone access could not start. Check the port and firewall settings.";

function usableIPv4(address) {
  return (
    typeof address === "string" &&
    /^(?:\d{1,3}\.){3}\d{1,3}$/.test(address) &&
    address.split(".").every((part) => Number(part) <= 255) &&
    !address.startsWith("127.") &&
    !address.startsWith("169.254.") &&
    address !== "0.0.0.0"
  );
}
async function discoverPhoneHosts({ interfaces = os.networkInterfaces, execute = execFile } = {}) {
  const hosts = new Set();
  for (const entries of Object.values(interfaces())) {
    for (const entry of entries || []) {
      if (!entry.internal && entry.family === "IPv4" && usableIPv4(entry.address)) hosts.add(entry.address);
    }
  }
  const magicDns = [];
  let tailscale = [...hosts].some((host) => {
    const parts = host.split(".").map(Number);
    return parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127;
  });
  try {
    const status = await new Promise((resolve, reject) => {
      // Fixed CLI/arguments only: never shell execution, paths or renderer input.
      execute(
        "tailscale",
        ["status", "--json"],
        { timeout: 2500, maxBuffer: 1024 * 1024, windowsHide: true },
        (error, stdout) => {
          if (error) return reject(error);
          try {
            resolve(JSON.parse(stdout));
          } catch (parseError) {
            reject(parseError);
          }
        },
      );
    });
    if (status.BackendState === "Running" && status.Self?.Online !== false) {
      for (const address of status.Self?.TailscaleIPs || []) {
        if (usableIPv4(address)) {
          hosts.add(address);
          tailscale = true;
        }
      }
      const dns = status.Self?.DNSName?.replace(/\.$/, "").toLowerCase();
      if (typeof dns === "string" && dns.length < 254 && /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(dns)) {
        hosts.add(dns);
        magicDns.push(dns);
        tailscale = true;
      }
    }
  } catch {
    /* Tailscale is optional and no network discovery service is contacted. */
  }
  return { hosts: [...hosts], magicDns, tailscale };
}

function configureChild(child, config) {
  return new Promise((resolve, reject) => {
    if (!child?.connected || child.exitCode !== null || child.killed) return reject(new Error(publicFailure));
    const id = randomUUID();
    let settled = false;
    const timer = setTimeout(() => finish(new Error(publicFailure)), 8000);
    function cleanup() {
      clearTimeout(timer);
      child.off("message", message);
      child.off("exit", exited);
      child.off("disconnect", exited);
    }
    function finish(error, state) {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(state);
    }
    function exited() {
      finish(new Error(publicFailure));
    }
    function message(reply) {
      if (reply?.type !== "phone-access:result" || reply.id !== id) return;
      if (
        typeof reply.state?.enabled !== "boolean" ||
        !Number.isInteger(reply.state?.port) ||
        reply.state.port < 1 ||
        reply.state.port > 65535
      )
        return finish(new Error(publicFailure));
      finish(null, reply.state);
    }
    child.on("message", message);
    child.once("exit", exited);
    child.once("disconnect", exited);
    try {
      child.send({ type: "phone-access:configure", id, config }, (error) => {
        if (error) finish(error);
      });
    } catch (error) {
      finish(error);
    }
  });
}

function createPhoneAccess({
  getChild,
  available,
  preferences,
  discover = discoverPhoneHosts,
  configure = configureChild,
}) {
  let state = { enabled: false, port: DEFAULT_PHONE_PORT, addresses: [], tailscale: false };
  let activeChild;
  let activeDiscovery;
  function discoveryKey(discovery) {
    return JSON.stringify({
      hosts: [...discovery.hosts].sort(),
      magicDns: [...discovery.magicDns].sort(),
      tailscale: discovery.tailscale,
    });
  }
  let pending = Promise.resolve();
  function snapshot() {
    const local = available();
    const live = getChild();
    const enabled = local && state.enabled && activeChild === live && live?.exitCode === null && !live.killed;
    return {
      ...state,
      available: local,
      enabled: Boolean(enabled),
      addresses: enabled ? [...state.addresses] : [],
    };
  }
  function serialize(operation) {
    const result = pending.then(operation);
    pending = result.catch(() => undefined);
    return result;
  }
  async function apply(enabled, discovered) {
    const child = getChild();
    state = { ...state, enabled: false, addresses: [], error: undefined };
    try {
      const saved = await preferences.read();
      state.port = saved.phoneAccess?.port || DEFAULT_PHONE_PORT;
      if (!enabled) {
        if (child?.connected) await configure(child, { enabled: false, port: state.port, hosts: [] });
        activeChild = undefined;
        return snapshot();
      }
      if (!available()) return snapshot();
      const discovery = discovered || (await discover());
      // A mode change or quit while discovery was running must not open a listener.
      if (!available() || child !== getChild()) return snapshot();
      const result = await configure(child, {
        enabled: true,
        port: state.port,
        hosts: discovery.hosts,
        magicDns: discovery.magicDns,
      });
      if (!available() || child !== getChild()) {
        if (child?.connected) await configure(child, { enabled: false, port: result.port, hosts: [] });
        return snapshot();
      }
      if (!result.enabled) throw new Error(publicFailure);
      // Persist the actual port after conflict retries before reporting success.
      await preferences.setPhoneAccess({ enabled: true, port: result.port });
      activeChild = child;
      activeDiscovery = discoveryKey(discovery);
      state = {
        enabled: true,
        port: result.port,
        addresses: discovery.hosts.map((host) => `http://${host}:${result.port}`),
        tailscale: discovery.tailscale,
      };
    } catch {
      // Fail closed, including a preference write failure after binding.
      if (child?.connected)
        await configure(child, { enabled: false, port: state.port, hosts: [] }).catch(() => undefined);
      activeChild = undefined;
      state = { ...state, enabled: false, addresses: [], error: publicFailure };
    }
    return snapshot();
  }
  return {
    get: () =>
      serialize(async () => {
        if (snapshot().enabled) {
          try {
            const discovery = await discover();
            if (discoveryKey(discovery) !== activeDiscovery) return apply(true, discovery);
          } catch {
            /* A refresh failure must not interrupt an existing listener. */
          }
        } else {
          state.port = (await preferences.read()).phoneAccess?.port || DEFAULT_PHONE_PORT;
        }
        return snapshot();
      }),
    set(enabled) {
      if (typeof enabled !== "boolean") return Promise.reject(new Error("Invalid phone access setting"));
      return serialize(async () => {
        if (!available()) return snapshot();
        try {
          const saved = await preferences.read();
          await preferences.setPhoneAccess({ enabled, port: saved.phoneAccess?.port || DEFAULT_PHONE_PORT });
          return apply(enabled);
        } catch {
          await apply(false);
          state.error = publicFailure;
          return snapshot();
        }
      });
    },
    restore: () =>
      serialize(async () => {
        if (!available()) return apply(false);
        if (snapshot().enabled) return snapshot();
        return apply((await preferences.read()).phoneAccess?.enabled === true);
      }),
    stop: () => serialize(() => apply(false)),
  };
}
module.exports = { DEFAULT_PHONE_PORT, discoverPhoneHosts, configureChild, createPhoneAccess };
