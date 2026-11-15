import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import net from "node:net";
import { test } from "node:test";

import {
  createDesktopNetworkServer,
  desktopNetworkOrigin,
  isDesktopNetworkRequest,
  markDesktopNetworkRequest,
} from "./desktop-network.ts";

async function unusedPort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}
function request(port: number, headers: Record<string, string>, pathname = "/") {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const outgoing = http.get({ host: "127.0.0.1", port, path: pathname, headers }, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => resolve({ status: response.statusCode!, body }));
    });
    outgoing.on("error", reject);
  });
}

void test("phone listener retries occupied ports without touching the local server", async (t) => {
  const local = http.createServer((_request, response) => response.end("local"));
  local.listen(0, "0.0.0.0");
  await once(local, "listening");
  const occupied = (local.address() as net.AddressInfo).port;
  t.after(() => local.close());
  const network = createDesktopNetworkServer((_request, response) => response.end("phone"));
  t.after(() => network.configure({ enabled: false, port: occupied, hosts: [] }));
  const state = await network.configure({ enabled: true, port: occupied, hosts: ["192.168.1.2"] });
  assert.equal(state.enabled, true);
  assert.notEqual(state.port, occupied);
  assert.equal((await request(occupied, { host: "localhost" })).body, "local");
  assert.equal((await request(state.port, { host: `192.168.1.2:${state.port}` })).body, "phone");
  await network.configure({ enabled: false, port: state.port, hosts: [] });
  assert.equal((await request(occupied, { host: "localhost" })).body, "local");
  await assert.rejects(request(state.port, { host: `192.168.1.2:${state.port}` }));
});

void test("all paths require exact advertised hosts and exact same-origin or absent Origin", async (t) => {
  const network = createDesktopNetworkServer((incoming, response) =>
    response.end(desktopNetworkOrigin(incoming)),
  );
  const state = await network.configure({
    enabled: true,
    port: await unusedPort(),
    hosts: ["192.168.1.2", "device.tail.ts.net"],
    magicDns: ["device.tail.ts.net"],
  });
  t.after(() => network.configure({ enabled: false, port: state.port, hosts: [] }));
  const host = `192.168.1.2:${state.port}`;
  for (const path of ["/", "/assets/app.js", "/api/auth/status"]) {
    assert.equal((await request(state.port, { host }, path)).status, 200);
    assert.equal((await request(state.port, { host, origin: `http://${host}` }, path)).status, 200);
    for (const origin of [
      "null",
      "https://evil.test",
      `https://${host}`,
      "http://192.168.1.2",
      `http://${host}/`,
    ]) {
      assert.equal((await request(state.port, { host, origin }, path)).status, 403, origin);
    }
    for (const badHost of [
      "evil.test",
      "192.168.1.2",
      `192.168.1.2:${state.port + 1}`,
      `localhost:${state.port}`,
      `${host}.evil.test`,
    ]) {
      assert.equal((await request(state.port, { host: badHost }, path)).status, 403, badHost);
    }
  }
  assert.equal(
    (await request(state.port, { host, "x-forwarded-host": "evil.test", "x-forwarded-proto": "https" })).body,
    `http://${host}`,
  );
  const serve = {
    host: "device.tail.ts.net",
    origin: "https://device.tail.ts.net",
    "x-forwarded-proto": "https",
  };
  assert.equal((await request(state.port, serve)).body, "https://device.tail.ts.net");
  assert.equal((await request(state.port, { ...serve, "x-forwarded-proto": "http" })).status, 403);
  assert.equal((await request(state.port, { ...serve, host: "other.tail.ts.net" })).status, 403);
  assert.equal((await request(state.port, { ...serve, origin: "https://evil.test" })).status, 403);
  assert.equal(
    (
      await request(state.port, {
        ...serve,
        host: `127.0.0.1:${state.port}`,
        "x-forwarded-host": "device.tail.ts.net",
      })
    ).status,
    200,
  );
});

void test(
  "disabling immediately destroys an open SSE response and idle raw socket",
  { timeout: 5000 },
  async () => {
    const network = createDesktopNetworkServer((_incoming, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write("event: open\ndata: {}\n\n");
    });
    const state = await network.configure({
      enabled: true,
      port: await unusedPort(),
      hosts: ["192.168.1.2"],
    });
    const outgoing = http.get({
      host: "127.0.0.1",
      port: state.port,
      headers: { host: `192.168.1.2:${state.port}` },
    });
    const [rawResponse] = await once(outgoing, "response");
    const response = rawResponse as http.IncomingMessage;
    response.on("error", () => {});
    response.resume();
    const idle = net.connect(state.port, "127.0.0.1");
    await once(idle, "connect");
    const streamClosed = new Promise<void>((resolve) => response.once("close", resolve));
    idle.on("error", () => {});
    const idleClosed = new Promise<void>((resolve) => idle.once("close", () => resolve()));
    assert.equal((await network.configure({ enabled: false, port: state.port, hosts: [] })).enabled, false);
    await Promise.all([streamClosed, idleClosed]);
    assert.equal(idle.destroyed, true);
  },
);

void test("network auth marker is object identity, never a forgeable header", () => {
  const request = new Request("http://192.168.1.2:48177", { headers: { "x-desktop-network": "1" } });
  assert.equal(isDesktopNetworkRequest(request), false);
  markDesktopNetworkRequest(request);
  assert.equal(isDesktopNetworkRequest(request), true);
  assert.equal(isDesktopNetworkRequest(request.clone()), false);
});
