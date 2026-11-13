import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { realpathSync } from "node:fs";
import { fixtureCredentials } from "./smoke-library-native.mjs";

export function ownedBundledServerPid(psOutput, parentPid, resources) {
  const executable = path.join(resources, "server/node");
  const children = psOutput
    .split("\n")
    .map((line) => line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/))
    .filter(Boolean)
    .filter((match) => Number(match[2]) === parentPid && match[3] === `${executable} server.mjs`);
  assert.equal(
    children.length,
    1,
    "Exactly one direct bundled Node child must belong to the test-owned Electron PID",
  );
  return Number(children[0][1]);
}

// Read ONLY the process/listener metadata of the app launched by this harness.
// No diagnostics hook, production code changes, arbitrary server scan or user vault.
export function discoverOwnedLocalServer(parentPid, resources) {
  assert.equal(process.platform, "darwin");
  const ps = execFileSync("/bin/ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8", timeout: 10000 });
  const pid = ownedBundledServerPid(ps, parentPid, realpathSync(resources));
  const sockets = execFileSync(
    "/usr/sbin/lsof",
    ["-nP", "-a", "-p", String(pid), "-iTCP", "-sTCP:LISTEN", "-Fn"],
    { encoding: "utf8", timeout: 10000 },
  );
  const listeners = [...new Set(sockets.split("\n").filter((line) => line.startsWith("n")))];
  assert.equal(listeners.length, 1, "Owned bundled server has one listener");
  const port = listeners[0].match(/^n127\.0\.0\.1:(\d+)$/)?.[1];
  assert.ok(port, "Owned server listener must be IPv4 loopback");
  return { parentPid, pid, baseUrl: `http://127.0.0.1:${port}` };
}

// Each write is a genuinely separate Node process and freshly authenticated bearer
// session, outside Electron and its proxy/cookies. Credentials travel over stdin,
// never argv, environment, recorded responses or logs. No persistent child to leak.
export function independentProcessWriter(baseUrl) {
  const url = new URL(baseUrl);
  assert.equal(url.protocol, "http:");
  assert.equal(url.hostname, "127.0.0.1");
  const source = `
    let input = "";
    for await (const chunk of process.stdin) input += chunk;
    const {baseUrl, credentials, paintId, quantity} = JSON.parse(input);
    const login = await fetch(baseUrl + "/api/auth/login", { method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify(credentials), signal: AbortSignal.timeout(10000) });
    if (!login.ok) throw new Error("Independent process login HTTP " + login.status);
    const {token} = await login.json();
    if (!token) throw new Error("Independent process login missing bearer session");
    const response = await fetch(baseUrl + "/api/paint-state", { method: "PUT", headers: {"content-type":"application/json", authorization: "Bearer " + token}, body: JSON.stringify({paintId, state: quantity > 0 ? "OWNED" : null, quantity}), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Independent process stock HTTP " + response.status);
    console.log(JSON.stringify({pid:process.pid,status:response.status}));
  `;
  return async (paintId, quantity) => {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
      input: JSON.stringify({ baseUrl, credentials: fixtureCredentials, paintId, quantity }),
      encoding: "utf8",
      timeout: 25000,
    });
    assert.equal(result.status, 0, `Independent process stock command failed: ${result.stderr}`);
    const evidence = JSON.parse(result.stdout);
    assert.equal(evidence.status, 200);
    assert.notEqual(evidence.pid, process.pid);
    return evidence;
  };
}
