const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { t: desktopTranslate } = require("./desktop-i18n.cjs");

// Exercise the main-process lifecycle without starting Electron or opening a vault.
const source = readFileSync(path.join(__dirname, "main.cjs"), "utf8");
function localServer() {
  const children = [];
  const startupEvents = [];
  let probes = 0;
  const context = vm.createContext({
    profileMigration: { ok: true },
    t: desktopTranslate,
    console,
    ...require("./desktop-startup.cjs"),
    createServerLog: () => ({ write() {} }),
    startupChanged: (state) => startupEvents.push(state),
    finishDeferredStop: () => {},
    setImmediate,
    app: { getPath: () => "/unused-logs", quit() {} },
    URL,
    AbortSignal,
    process,
    path,
    explicitPort: 9999,
    localUrl: "http://127.0.0.1:9999",
    dataDirectory: "/unused-test-vault",
    serverDirectory: () => "/unused-test-server",
    existsSync: () => true,
    fetch: async () => {
      probes++;
      return { ok: children.at(-1)?.exitCode === null, json: async () => ({ setupRequired: false }) };
    },
    spawn: () => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.exitCode = null;
      child.killed = false;
      child.kill = () => {
        child.killed = true;
        child.exitCode = 0;
        child.emit("exit");
      };
      children.push(child);
      return child;
    },
  });
  vm.runInContext(
    "let serverProcess, readyServer, startingServer, serverProgress, serverLog; let stopWhenSafe=false, quitWhenSafe=false;\n" +
      source.slice(
        source.indexOf("async function serverHealthy()"),
        source.indexOf("async function setConnection("),
      ),
    context,
  );
  return { context, children, startupEvents, probes: () => probes };
}

test("a ready local child is reused without health requests; stop and exit invalidate readiness", async () => {
  const { context, children, probes } = localServer();
  await Promise.all([context.ensureLocalServer(), context.ensureLocalServer()]);
  assert.equal(children.length, 1);
  const initialProbes = probes();
  assert.ok(initialProbes > 0);
  for (let i = 0; i < 3; i++) await context.ensureLocalServer();
  assert.equal(probes(), initialProbes);
  context.stopLocalServer();
  await context.ensureLocalServer();
  assert.equal(children.length, 2);
  children[1].exitCode = 1;
  children[1].emit("exit");
  await context.ensureLocalServer();
  assert.equal(children.length, 3);
  assert.ok(probes() > initialProbes);
  context.stopLocalServer();
});

test("an old child's exit cannot clear a newer child's readiness", async () => {
  const { context, children, probes } = localServer();
  await context.ensureLocalServer();
  context.stopLocalServer();
  await context.ensureLocalServer();
  const before = probes();
  children[0].emit("exit");
  await context.ensureLocalServer();
  assert.equal(children.length, 2);
  assert.equal(probes(), before);
  context.stopLocalServer();
});

test("stopping a protected migration defers killing until ready; retries reuse that child", async () => {
  const { context, children } = localServer();
  await context.ensureLocalServer();
  children[0].stdout.emit(
    "data",
    Buffer.from('PAINTWARDEN_STARTUP {"phase":"migrating","status":"started"}\n'),
  );
  context.stopLocalServer();
  assert.equal(children[0].killed, false);
  await context.ensureLocalServer();
  assert.equal(children.length, 1);
  children[0].stdout.emit("data", Buffer.from('PAINTWARDEN_STARTUP {"phase":"ready"}\n'));
  context.stopLocalServer();
  assert.equal(children[0].killed, true);
});

test("failure UI is published only once the shared startup attempt can actually retry", async () => {
  const { context, children, startupEvents } = localServer();
  context.fetch = async () => ({ ok: false });
  const first = context.ensureLocalServer();
  const rejected = assert.rejects(first, /Could not start/);
  await new Promise(setImmediate);
  children[0].stdout.emit(
    "data",
    Buffer.from('PAINTWARDEN_STARTUP {"phase":"failed","message":"fixture failure"}\n'),
  );
  assert.equal(
    startupEvents.some((state) => state.phase === "failed"),
    false,
  );
  await rejected;
  assert.equal(startupEvents.at(-1).phase, "failed");
  context.fetch = async () => ({
    ok: children.at(-1)?.exitCode === null,
    json: async () => ({ setupRequired: false }),
  });
  await context.ensureLocalServer();
  assert.equal(children.length, 2);
  assert.equal(startupEvents.at(-1).phase, "ready");
  context.stopLocalServer();
});

test("stop cannot race a child entering SQLite before its first protected marker is drained", async () => {
  const { context, children } = localServer();
  context.fetch = async () => ({ ok: false });
  const starting = context.ensureLocalServer();
  await new Promise(setImmediate);
  context.stopLocalServer();
  assert.equal(children[0].killed, false);
  children[0].stdout.emit("data", Buffer.from('PAINTWARDEN_STARTUP {"phase":"ready"}\n'));
  context.fetch = async () => ({ ok: true, json: async () => ({ setupRequired: false }) });
  await starting;
  context.stopLocalServer();
  assert.equal(children[0].killed, true);
});

test("a spawn error without exit releases the child so Retry can start another", async () => {
  const { context, children } = localServer();
  context.fetch = async () => ({ ok: false });
  const first = context.ensureLocalServer();
  const rejected = assert.rejects(first, /Could not start/);
  await new Promise(setImmediate);
  children[0].emit("error", new Error("fixture spawn denied"));
  await rejected;
  context.fetch = async () => ({
    ok: children.at(-1)?.exitCode === null && !children.at(-1)?.spawnError,
    json: async () => ({ setupRequired: false }),
  });
  await context.ensureLocalServer();
  assert.equal(children.length, 2);
  context.stopLocalServer();
});

function remoteVersions() {
  let calls = 0;
  let now = 0;
  const requests = [];
  const updaterChanges = [];
  const context = vm.createContext({
    profileMigration: { ok: true },
    t: desktopTranslate,
    changingConnection: 0,
    connection: { mode: "remote", serverUrl: "https://fixture.invalid" },
    updater: { setConnection: (next) => updaterChanges.push({ ...next }) },
    app: { getVersion: () => "1.0.0" },
    Date: { now: () => now },
    versionMismatch: (_app, server) => (server === "1.0.0" ? null : { serverVersion: server }),
    serverVersion: (origin) => {
      calls++;
      return new Promise((resolve, reject) => requests.push({ origin, resolve, reject }));
    },
  });
  vm.runInContext(
    source.slice(
      source.indexOf("function updaterConnection("),
      source.indexOf("async function setConnection("),
    ) + source.slice(source.indexOf("const VERSION_RECHECK_MS"), source.indexOf("function rememberSession(")),
    context,
  );
  return { context, requests, updaterChanges, calls: () => calls, expire: () => (now += 6 * 60_000) };
}

test("concurrent version checks coalesce per origin, including fresh checks, and respect expiry", async () => {
  const { context, calls, requests, expire, updaterChanges } = remoteVersions();
  const origin = "https://fixture.invalid";
  const checks = Array.from({ length: 10 }, () => context.remoteVersionProblem(origin));
  checks.push(context.remoteVersionProblem(origin, { fresh: true }));
  const other = context.remoteVersionProblem("https://other.invalid");
  assert.equal(calls(), 2);
  requests[0].resolve("1.0.0");
  requests[1].resolve("2.0.0");
  assert.deepEqual(await Promise.all(checks), Array(11).fill(null));
  assert.equal((await other).serverVersion, "2.0.0");
  assert.deepEqual(
    updaterChanges,
    [{ mode: "remote", serverUrl: origin, serverVersion: "1.0.0" }],
    "only the selected origin updates install permission",
  );
  assert.equal(await context.remoteVersionProblem(origin), null);
  assert.equal(calls(), 2);
  const fresh = context.remoteVersionProblem(origin, { fresh: true });
  const joined = context.remoteVersionProblem(origin);
  assert.equal(calls(), 3);
  requests[2].resolve("2.0.0");
  assert.equal((await fresh).serverVersion, "2.0.0");
  assert.equal((await joined).serverVersion, "2.0.0");
  expire();
  const expired = context.remoteVersionProblem(origin);
  assert.equal(calls(), 4);
  requests[3].resolve("1.0.0");
  assert.equal(await expired, null);
  assert.deepEqual(
    updaterChanges.map(({ serverVersion }) => serverVersion),
    ["1.0.0", "2.0.0", "1.0.0"],
  );
});

test("failed version checks are not retained and can be retried", async () => {
  const { context, calls, requests } = remoteVersions();
  const origin = "https://fixture.invalid";
  const first = context.remoteVersionProblem(origin);
  const second = context.remoteVersionProblem(origin, { fresh: true });
  const rejected = Promise.all([assert.rejects(first, /offline/), assert.rejects(second, /offline/)]);
  requests[0].reject(new Error("offline"));
  await rejected;
  assert.equal(calls(), 1);
  const retry = context.remoteVersionProblem(origin);
  requests[1].resolve("1.0.0");
  assert.equal(await retry, null);
  assert.equal(calls(), 2);
});

test("static shell responses cache only hashed assets and preserve errors and security headers", async () => {
  const { assetPath, shellCacheControl } = require("./desktop-core.cjs");
  const directory = path.resolve("/unused-test-shell");
  const files = new Map([
    ["index.html", "<html>Fixture</html>"],
    ["sw.js", "// fixture service worker"],
    ["assets/index-B6ZqGOrP.js", "// fixture app"],
    ["assets/index-B6ZqGOrP.css", "/* fixture styles */"],
    ["assets/inter-C38fXH4l.woff2", "fixture font"],
    ["assets/photo-C38fXH4l.webp", "fixture image"],
  ]);
  let reads = 0;
  const context = vm.createContext({
    profileMigration: { ok: true },
    t: desktopTranslate,
    path,
    Response,
    assetPath,
    shellCacheControl,
    webDirectory: () => directory,
    mimeTypes: { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" },
    stat: async (file) => ({ isFile: () => files.has(path.relative(directory, file)) }),
    readFile: async (file) => {
      reads++;
      return files.get(path.relative(directory, file));
    },
  });
  vm.runInContext(
    source.slice(
      source.indexOf("async function serveStatic(url)"),
      source.indexOf("function allowRenderer("),
    ),
    context,
  );
  for (const pathname of ["/", "/sw.js", "/assets/photo-C38fXH4l.webp"]) {
    const response = await context.serveStatic({ pathname });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  for (const pathname of [
    "/assets/index-B6ZqGOrP.js",
    "/assets/index-B6ZqGOrP.css",
    "/assets/inter-C38fXH4l.woff2",
  ]) {
    const response = await context.serveStatic({ pathname });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.match(response.headers.get("content-security-policy"), /script-src 'self'/);
    assert.ok(await response.text());
  }
  const before = reads;
  assert.equal((await context.serveStatic({ pathname: "/assets/missing-12345678.js" })).status, 404);
  assert.equal((await context.serveStatic({ pathname: "/%2e%2e/secret" })).status, 403);
  assert.equal(reads, before);
});

function imageProxy() {
  const {
    imageRequest,
    imageProxyCacheControl,
    createImageCache,
    subscriptionRequest,
    createSubscriptionStreams,
  } = require("./desktop-core.cjs");
  const calls = [];
  let pending;
  const context = vm.createContext({
    profileMigration: { ok: true },
    t: desktopTranslate,
    console,
    URL,
    Headers,
    Request,
    Response,
    AbortSignal,
    imageRequest,
    imageProxyCacheControl,
    createImageCache,
    subscriptionRequest,
    subscriptionStreams: createSubscriptionStreams(),
    randomBytes: require("node:crypto").randomBytes,
    ensureLocalServer: async () => undefined,
    remoteVersionProblem: async () => null,
    localUrl: "http://127.0.0.1:9999",
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (pending) return pending;
      const headers = url.includes("/api/auth/login")
        ? { "content-type": "application/json", "set-cookie": "pv_session=account-b; HttpOnly" }
        : { "content-type": "image/webp", "cache-control": "private, max-age=31536000, immutable" };
      return new Response(url.includes("server-b") ? "image-b" : "image-a", { headers });
    },
  });
  vm.runInContext(
    `let connection = {mode: "remote", serverUrl: "https://server-a.invalid"};
    const cookies = new Map(); const imageCache = createImageCache(); let imageScope = "initial-scope", authorizationIdentity;
    function rotateImageScope() { imageCache.clear(); imageScope = randomBytes(24).toString("hex"); }
    function switchServer(url) { connection = {mode: "remote", serverUrl: url}; rotateImageScope(); }
    function currentScope() { return imageScope; }\n` +
      source.slice(source.indexOf("function rememberSession("), source.indexOf("// Posts a file")) +
      source.slice(source.indexOf("async function proxyApi("), source.indexOf("async function serveStatic(")),
    context,
  );
  return {
    context,
    calls,
    request: (pathname, method = "GET", headers = {}) =>
      context.proxyApi(
        new Request(`paintwarden://app${pathname}`, { method, headers }),
        new URL(`paintwarden://app${pathname}`),
      ),
    hold: () => {
      let resolve;
      pending = new Promise((done) => {
        resolve = done;
      });
      return resolve;
    },
  };
}

test("immutable image policies survive only scoped image GETs; APIs, unscoped images and errors stay no-store", async () => {
  const { imageProxyCacheControl } = require("./desktop-core.cjs");
  const proxy = imageProxy();
  const image = "/api/miniatures/same-id/image?v=same-key";
  const unscoped = await proxy.request(image);
  assert.equal(unscoped.headers.get("cache-control"), "no-store");
  const scope = unscoped.headers.get("x-paintwarden-image-scope");
  const cached = await proxy.request(`${image}&_pv_scope=${scope}`);
  assert.equal(cached.headers.get("cache-control"), "private, max-age=31536000, immutable");
  assert.equal(proxy.calls.at(-1).url, `https://server-a.invalid${image}`);
  assert.equal((await proxy.request("/api/auth/status")).headers.get("cache-control"), "no-store");
  const headers = { "content-type": "image/webp", "cache-control": "private, max-age=31536000, immutable" };
  for (const [method, path, status, scoped] of [
    ["POST", image, 200, true],
    ["GET", "/api/auth/status", 200, true],
    ["GET", "/api/catalog-source-images/key.webp", 404, true],
    ["GET", image, 200, false],
  ])
    assert.equal(
      imageProxyCacheControl(method, path, new Response("x", { status, headers }), scoped),
      "no-store",
    );
  assert.equal(
    imageProxyCacheControl(
      "GET",
      "/api/catalog-source-images/key.webp",
      new Response("x", { headers }),
      true,
    ),
    headers["cache-control"],
  );
  assert.equal(
    imageProxyCacheControl("GET", "/api/miniature-templates/id/image", new Response("x", { headers }), true),
    headers["cache-control"],
  );
  assert.equal(
    imageProxyCacheControl(
      "GET",
      "/api/catalog-source-images/key.webp",
      new Response("x", { headers: { ...headers, "content-type": "application/json" } }),
      true,
    ),
    "no-store",
  );
});

test("same-path images are isolated after switching servers and login/logout sessions", async () => {
  const proxy = imageProxy();
  const image = "/api/miniatures/same-id/image?v=same-key";
  const firstScope = proxy.context.currentScope();
  const first = await proxy.request(`${image}&_pv_scope=${firstScope}`);
  assert.equal(await first.text(), "image-a");
  proxy.context.switchServer("https://server-b.invalid");
  const secondScope = proxy.context.currentScope();
  assert.notEqual(secondScope, firstScope);
  const old = await proxy.request(`${image}&_pv_scope=${firstScope}`);
  assert.equal(old.status, 409);
  assert.equal(old.headers.get("cache-control"), "no-store");
  const second = await proxy.request(`${image}&_pv_scope=${secondScope}`);
  assert.equal(await second.text(), "image-b");
  await proxy.request("/api/auth/login", "POST");
  const loginScope = proxy.context.currentScope();
  assert.notEqual(loginScope, secondScope);
  assert.equal((await proxy.request(`${image}&_pv_scope=${secondScope}`)).status, 409);
  vm.runInContext(
    `rememberSession("https://server-b.invalid", new Response("", {headers: {"set-cookie": "pv_session=; Max-Age=0"}}))`,
    proxy.context,
  );
  assert.notEqual(proxy.context.currentScope(), loginScope);
  assert.equal((await proxy.request(`${image}&_pv_scope=${loginScope}`)).status, 409);
});

test("a late response from the old server cannot populate the new vault or its image cache", async () => {
  const proxy = imageProxy();
  const resolve = proxy.hold();
  const response = proxy.request("/api/miniatures/id/image?_pv_scope=initial-scope");
  await new Promise((done) => setImmediate(done));
  proxy.context.switchServer("https://server-b.invalid");
  resolve(
    new Response("old image", {
      headers: { "content-type": "image/webp", "cache-control": "private, max-age=31536000, immutable" },
    }),
  );
  const result = await response;
  assert.equal(result.status, 409);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(await result.text(), "Connection changed");
});

test("scoped repeated reads reuse bytes without upstream requests and new generations miss", async () => {
  const proxy = imageProxy();
  const url = `/api/miniatures/id/image?v=key&_pv_scope=${proxy.context.currentScope()}`;
  for (let i = 0; i < 3; i++) assert.equal(await (await proxy.request(url)).text(), "image-a");
  assert.equal(proxy.calls.length, 1);
  proxy.context.switchServer("https://server-b.invalid");
  const next = `/api/miniatures/id/image?v=key&_pv_scope=${proxy.context.currentScope()}`;
  assert.equal(await (await proxy.request(next)).text(), "image-b");
  assert.equal(proxy.calls.length, 2);
});

test("image byte cache bounds entries and bytes, honors TTL/no-cache, and clears pending stores", async () => {
  const { createImageCache } = require("./desktop-core.cjs");
  let now = 0;
  const cache = createImageCache({ maxBytes: 6, maxEntryBytes: 4, maxEntries: 2, now: () => now });
  const image = (body, policy = "private, max-age=1, immutable") =>
    new Response(body, { headers: { "content-type": "image/webp", "cache-control": policy } });
  await cache.put("a", image("aaa"));
  await cache.put("b", image("bbb"));
  assert.equal(await cache.get("a").text(), "aaa"); // touch a, evict b
  await cache.put("c", image("ccc"));
  assert.equal(cache.get("b"), null);
  assert.equal(await cache.get("a").text(), "aaa");
  await cache.put("large", image("12345"));
  assert.equal(cache.get("large"), null);
  await cache.put("nocache", image("x", "private, no-cache"));
  assert.equal(cache.get("nocache"), null);
  await cache.put(
    "json",
    new Response("x", {
      headers: { "content-type": "application/json", "cache-control": "private, max-age=1, immutable" },
    }),
  );
  assert.equal(cache.get("json"), null);
  now = 1000;
  assert.equal(cache.get("a"), null);
  let release;
  const stream = new ReadableStream({
    start(controller) {
      release = () => {
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      };
    },
  });
  const store = cache.put("pending", image(stream));
  cache.clear();
  release();
  await store;
  assert.equal(cache.get("pending"), null);
});

// Real HTTP peers deliberately keep subscriptions open after their first event. The
// VM only replaces Electron startup; it runs the actual proxy and connection switch.
async function subscriptionProxy(t, mode, handler) {
  const http = require("node:http");
  const core = require("./desktop-core.cjs");
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(() => {
    context.subscriptionStreams.abortAll();
    server.closeAllConnections();
    server.close();
  });
  const timeouts = [],
    calls = [],
    updaterChanges = [];
  const updater = {
    installing: false,
    isInstalling: () => updater.installing,
    setConnection: (next) => updaterChanges.push({ ...next }),
  };
  const context = vm.createContext({
    profileMigration: { ok: true },
    t: desktopTranslate,
    updater,
    console,
    URL,
    Headers,
    Request,
    Response,
    ...core,
    subscriptionStreams: core.createSubscriptionStreams(),
    AbortSignal: {
      timeout: (ms) => {
        timeouts.push(ms);
        return AbortSignal.timeout(ms);
      },
    },
    randomBytes: require("node:crypto").randomBytes,
    ensureLocalServer: async () => undefined,
    stopLocalServer: () => undefined,
    writeConnection: async () => undefined,
    remoteVersionProblem: async () => null,
    localUrl: origin,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return fetch(url, options);
    },
  });
  vm.runInContext(
    `let connection = ${JSON.stringify(mode === "local" ? { mode } : { mode, serverUrl: origin })};
     const cookies = new Map(); const imageCache = createImageCache();
     const versionChecks = new Map();
     let imageScope = "initial", authorizationIdentity;
     function rotateImageScope() { imageCache.clear(); imageScope = randomBytes(24).toString("hex"); }
     function session(origin) { return cookies.get(origin); }\n` +
      source.slice(source.indexOf("let changingConnection ="), source.indexOf("// Remote servers must")) +
      source.slice(source.indexOf("function rememberSession("), source.indexOf("// Posts a file")) +
      source.slice(source.indexOf("async function proxyApi("), source.indexOf("async function serveStatic(")),
    context,
  );
  return {
    context,
    origin,
    timeouts,
    calls,
    updater,
    updaterChanges,
    request: (pathname = "/api/graphql/stream", options = {}) => {
      const url = new URL(`paintwarden://app${pathname}`);
      return context.proxyApi(
        new Request(url, {
          method: "POST",
          body: JSON.stringify({ query: "subscription { vaultChanges { seq } }" }),
          headers: { "content-type": "application/json", accept: "text/event-stream" },
          ...options,
        }),
        url,
      );
    },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

for (const mode of ["local", "remote"]) {
  test(
    `${mode} subscriptions deliver before EOF, forward auth, retain per-origin sessions and cancel upstream`,
    { timeout: 5000 },
    async (t) => {
      const opened = deferred(),
        closed = deferred();
      let responseEnded = false,
        received;
      const proxy = await subscriptionProxy(t, mode, async (request, response) => {
        received = { headers: request.headers, body: "" };
        for await (const chunk of request) received.body += chunk;
        response.on("close", () => closed.resolve());
        response.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          "set-cookie": "pv_session=new-session; HttpOnly",
          "access-control-allow-origin": "*",
        });
        response.write('event: next\ndata: {"data":{"vaultChanges":{"seq":1}}}\n\n');
        opened.resolve(() => {
          responseEnded = true;
          response.end("event: complete\n\n");
        });
      });
      vm.runInContext(
        `cookies.set(${JSON.stringify(proxy.origin)}, "pv_session=old-session")`,
        proxy.context,
      );
      const reply = await proxy.request(undefined, {
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          authorization: "Bearer fixture",
          cookie: "pv_session=renderer-must-not-leak",
          origin: "paintwarden://app",
          referer: "paintwarden://app/",
        },
      });
      await opened.promise;
      assert.equal(reply.status, 200);
      assert.match(reply.headers.get("content-type"), /^text\/event-stream/);
      assert.equal(reply.headers.get("cache-control"), "no-store");
      assert.equal(reply.headers.get("set-cookie"), null);
      assert.equal(reply.headers.get("access-control-allow-origin"), null);
      assert.ok(reply.headers.get("x-paintwarden-image-scope"));
      const reader = reply.body.getReader();
      assert.match(new TextDecoder().decode((await reader.read()).value), /event: next/);
      assert.equal(responseEnded, false, "the first event arrives while upstream is still open");
      assert.equal(received.headers.authorization, "Bearer fixture");
      assert.equal(received.headers.cookie, "pv_session=old-session");
      assert.equal(received.headers.origin, undefined);
      assert.equal(received.headers.referer, undefined);
      assert.deepEqual(JSON.parse(received.body), { query: "subscription { vaultChanges { seq } }" });
      assert.equal(proxy.context.session(proxy.origin), "pv_session=new-session");
      assert.deepEqual(proxy.timeouts, [], "subscription never receives the ordinary API deadline");
      const signal = proxy.calls[0].options.signal;
      await reader.cancel();
      await closed.promise;
      assert.equal(signal.aborted, true);
    },
  );

  test(`${mode} renderer abort and server switch close live subscriptions`, { timeout: 5000 }, async (t) => {
    const closed = [deferred(), deferred()];
    let count = 0;
    const proxy = await subscriptionProxy(t, mode, (request, response) => {
      if (request.url === "/api/auth/status") {
        response.setHeader("content-type", "application/json");
        response.end('{"setupRequired":false}');
        return;
      }
      const current = count++;
      response.on("close", () => closed[current].resolve());
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write("event: next\ndata: {}\n\n");
    });
    const controller = new AbortController();
    const first = await proxy.request(undefined, { signal: controller.signal });
    const firstReader = first.body.getReader();
    await firstReader.read();
    controller.abort();
    await assert.rejects(firstReader.read(), /abort/i);
    await closed[0].promise;
    const second = await proxy.request();
    const secondReader = second.body.getReader();
    await secondReader.read();
    // Even reselecting the same origin is a new connection generation.
    await proxy.context.setConnection({ mode: "remote", serverUrl: proxy.origin });
    await assert.rejects(secondReader.read(), /abort/i);
    await closed[1].promise;
    assert.equal(
      proxy.calls
        .filter((call) => call.url.endsWith("/api/graphql/stream"))
        .every((call) => call.options.signal.aborted),
      true,
    );
  });

  test(
    `${mode} switch before headers rejects stale subscription without adopting its session`,
    { timeout: 5000 },
    async (t) => {
      const arrived = deferred(),
        closed = deferred();
      let lateResponse;
      const proxy = await subscriptionProxy(t, mode, (request, response) => {
        if (request.url === "/api/auth/status") {
          response.end('{"setupRequired":false}');
          return;
        }
        lateResponse = response;
        response.on("close", () => closed.resolve());
        arrived.resolve();
      });
      const pending = proxy.request();
      await arrived.promise;
      await proxy.context.setConnection({ mode: "remote", serverUrl: proxy.origin });
      await closed.promise;
      lateResponse.writeHead(200, { "content-type": "text/event-stream", "set-cookie": "pv_session=stale" });
      lateResponse.end("event: next\ndata: {}\n\n");
      const reply = await pending;
      assert.equal(reply.status, 409);
      assert.equal(proxy.context.session(proxy.origin), undefined);
    },
  );
}

test(
  "only exact subscription POSTs bypass API timeout; JSON authentication failures retain session behavior",
  { timeout: 5000 },
  async (t) => {
    const proxy = await subscriptionProxy(t, "remote", (_request, response) => {
      response.writeHead(401, { "content-type": "application/json", "set-cookie": "pv_session=; Max-Age=0" });
      response.end('{"error":"Sign in required"}');
    });
    vm.runInContext(`cookies.set(${JSON.stringify(proxy.origin)}, "pv_session=expired")`, proxy.context);
    const denied = await proxy.request();
    assert.equal(denied.status, 401);
    assert.deepEqual(await denied.json(), { error: "Sign in required" });
    assert.equal(proxy.context.session(proxy.origin), undefined);
    assert.equal(denied.headers.get("set-cookie"), null);
    for (const [pathname, options] of [
      ["/api/graphql", {}],
      ["/api/graphql/stream/", {}],
      ["/api/graphql/stream", { method: "GET", body: undefined }],
      ["/api/auth/status", { method: "GET", body: undefined }],
    ])
      await (await proxy.request(pathname, options)).text();
    assert.deepEqual(proxy.timeouts, [30_000, 30_000, 30_000, 30_000]);
    await (await proxy.request("/api/backup", { method: "GET", body: undefined })).text();
    assert.equal(proxy.timeouts.length, 4, "backup keeps its existing no-deadline behavior");
  },
);

test("remote version completion caches its result but cannot reopen install permission during a switch", async () => {
  const { context, requests, updaterChanges } = remoteVersions();
  const origin = "https://fixture.invalid";
  context.changingConnection = 1;
  const pending = context.remoteVersionProblem(origin);
  requests[0].resolve("1.1.0");
  await pending;
  assert.deepEqual(updaterChanges, []);
  context.changingConnection = 0;
  assert.equal(context.updaterConnection().serverVersion, "1.1.0");
  const stale = context.remoteVersionProblem(origin, { fresh: true });
  context.connection = { mode: "local" };
  requests[1].resolve("1.2.0");
  await stale;
  assert.deepEqual(updaterChanges, [], "completion from the old origin cannot replace the current selection");
});

for (const succeeds of [true, false]) {
  test(`connection validation blocks updater installs until ${succeeds ? "success" : "failure"}`, async (t) => {
    const arrived = deferred(),
      finish = deferred();
    const proxy = await subscriptionProxy(t, "local", async (_request, response) => {
      arrived.resolve();
      await finish.promise;
      response.writeHead(succeeds ? 200 : 503, { "content-type": "application/json" });
      response.end('{"setupRequired":false}');
    });
    const pending = proxy.context.setConnection({ mode: "remote", serverUrl: proxy.origin });
    const failed = succeeds ? null : assert.rejects(pending, /Paintwarden server/);
    assert.deepEqual(
      proxy.updaterChanges,
      [{ mode: null }],
      "permission closes before asynchronous validation",
    );
    await arrived.promise;
    assert.deepEqual(proxy.updaterChanges, [{ mode: null }]);
    finish.resolve();
    if (succeeds) await pending;
    else await failed;
    assert.deepEqual(proxy.updaterChanges, [
      { mode: null },
      succeeds ? { mode: "remote", serverUrl: proxy.origin, serverVersion: null } : { mode: "local" },
    ]);
  });
}

test("an installation already in progress prevents connection validation and selection changes", async (t) => {
  const proxy = await subscriptionProxy(t, "local", (_request, response) => {
    response.end();
  });
  proxy.updater.installing = true;
  const result = await proxy.context.setConnection({ mode: "remote", serverUrl: proxy.origin });
  assert.equal(result.mode, "local");
  assert.deepEqual(proxy.calls, []);
  assert.deepEqual(proxy.updaterChanges, []);
});

test("failed profile migration blocks server/connection access and Retry never opens an empty vault", () => {
  let attempts = 0;
  let relaunched = 0;
  let exited = 0;
  const context = vm.createContext({
    profileMigration: { ok: false },
    profile: { root: "/synthetic/Paintwarden", legacyPaths: [] },
    migrateProfile: () => {
      attempts++;
      return { ok: attempts > 1, code: "PROFILE_CONFLICT" };
    },
    t: desktopTranslate,
    console: { error() {} },
    startupChanged: () => {},
    app: {
      relaunch() {
        relaunched++;
      },
      exit(code) {
        assert.equal(code, 0);
        exited++;
      },
    },
  });
  vm.runInContext(
    source.slice(
      source.indexOf("function requireProfile()"),
      source.indexOf("async function setConnection("),
    ),
    context,
  );
  assert.throws(() => context.requireProfile(), /vault could not/);
  assert.throws(() => context.retryProfileMigration(), /vault could not/);
  assert.equal(relaunched, 0);
  assert.throws(() => context.requireProfile(), /vault could not/);
  assert.throws(() => context.retryProfileMigration(), /vault could not/);
  assert.equal(relaunched, 1);
  assert.equal(exited, 1);
});
