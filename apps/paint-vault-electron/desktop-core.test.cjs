const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  assetPath,
  shellCacheControl,
  parsedChoice,
  serverOrigin,
  versionMismatch,
} = require("./desktop-core.cjs");

test("remote connections accept only a bare HTTP or HTTPS origin", () => {
  assert.equal(serverOrigin(" https://vault.example.com:8443/ "), "https://vault.example.com:8443");
  for (const input of [
    "file:///tmp/server",
    "https://user:pass@vault.example.com",
    "https://vault.example.com/path",
    "https://vault.example.com/?token=secret",
    "https://vault.example.com/#section",
  ]) {
    assert.throws(() => serverOrigin(input), /server origin/);
  }
});

test("invalid saved server choices return the connection screen", () => {
  assert.deepEqual(parsedChoice({ mode: "remote", serverUrl: "file:///tmp/server" }), { mode: null });
  assert.deepEqual(parsedChoice({ mode: "local", serverUrl: "https://other.example" }), { mode: "local" });
  assert.deepEqual(parsedChoice({ mode: "remote", serverUrl: "https://vault.example" }), {
    mode: "remote",
    serverUrl: "https://vault.example",
  });
});

test("custom protocol assets stay inside the bundled web directory", () => {
  const directory = path.resolve("/tmp/paint-vault-web-dist");
  assert.equal(assetPath(directory, "/"), path.join(directory, "index.html"));
  assert.equal(assetPath(directory, "/assets/app.js"), path.join(directory, "assets/app.js"));
  assert.equal(assetPath(directory, "/%2e%2e/secrets.json"), null);
  assert.equal(assetPath(directory, "/%ZZ"), null);
});

test("a remote server must run exactly the app's version, and the message names what to update", () => {
  assert.equal(versionMismatch("1.2.3", "1.2.3"), null);
  const olderServer = versionMismatch("1.2.3", "1.2.0");
  assert.equal(olderServer.update, "server");
  assert.equal(olderServer.serverVersion, "1.2.0");
  assert.match(olderServer.message, /Update the server to 1\.2\.3/);
  const newerServer = versionMismatch("1.2.3", "1.10.0");
  assert.equal(newerServer.update, "app");
  assert.match(newerServer.message, /Update this app to 1\.10\.0/);
  // Servers from before the version check don't report a version.
  for (const unknown of [null, undefined, "", "latest"]) {
    const problem = versionMismatch("1.2.3", unknown);
    assert.equal(problem.update, "server");
    assert.equal(problem.serverVersion, null);
    assert.match(problem.message, /older version of Paint Vault\. Update the server to 1\.2\.3/);
  }
});

test("the desktop app and its bundled server have the same version", () => {
  const version = (folder) => require(path.join(__dirname, "..", folder, "package.json")).version;
  assert.equal(version("paint-vault-electron"), version("paint-vault"));
});

// electron-builder always drops a node_modules folder at the root of a copied folder, so the
// bundled server's dependencies need an entry of their own or the server can't start.
test("the packaged app includes the bundled server's dependencies", () => {
  const { build } = require("./package.json");
  assert.ok(
    build.extraResources.some(
      (entry) => entry.from === "desktop-server/node_modules" && entry.to === "server/node_modules",
    ),
  );
});

test("only content-hashed shell code, styles and fonts receive immutable caching", () => {
  for (const pathname of [
    "/assets/index-B6ZqGOrP.js",
    "/assets/ProjectDrawer-C_8zG-rp.js",
    "/assets/index-abcdefgh.css",
    "/assets/inter-latin-400-normal-C38fXH4l.woff2",
    "/assets/font-12345678.woff",
  ]) {
    assert.equal(shellCacheControl(pathname), "public, max-age=31536000, immutable");
  }
  for (const pathname of [
    "/",
    "/index.html",
    "/offline.html",
    "/sw.js",
    "/manifest.webmanifest",
    "/assets/app.js",
    "/assets/app-short.js",
    "/assets/index-12345678.js.map",
    "/assets/photo-12345678.webp",
    "/assets/photo-12345678.png",
    "/favicon.svg",
    "/api/auth/status",
    "/api/auth/status",
    "/api/images/photo-12345678.webp",
    "/api/assets/index-12345678.js",
    "/other/index-12345678.js",
    "/assets/nested/index-12345678.js",
    "/assets/../index-12345678.js",
  ]) {
    assert.equal(shellCacheControl(pathname), "no-store", pathname);
  }
});

test("subscription lifecycle releases request listeners on EOF, error and cancellation", async () => {
  const { getEventListeners } = require("node:events");
  const { createSubscriptionStreams } = require("./desktop-core.cjs");
  const streams = createSubscriptionStreams();
  const finished = [];
  for (const outcome of ["eof", "error", "cancel", "abort"]) {
    const request = new AbortController();
    const stream = streams.open(request.signal);
    assert.equal(getEventListeners(request.signal, "abort").length, 1);
    let canceled = false;
    const body = stream.wrap(
      new ReadableStream({
        start(controller) {
          if (outcome === "eof") controller.close();
          if (outcome === "error") controller.error(new Error("upstream failed"));
        },
        cancel() {
          canceled = true;
        },
      }),
    );
    if (outcome === "eof") await new Response(body).text();
    if (outcome === "error") await assert.rejects(new Response(body).text(), /upstream failed/);
    if (outcome === "cancel") await body.cancel();
    if (outcome === "abort") {
      request.abort();
      await assert.rejects(new Response(body).text(), /abort/i);
    }
    if (["cancel", "abort"].includes(outcome)) assert.equal(canceled, true);
    assert.equal(getEventListeners(request.signal, "abort").length, 0);
    finished.push({ stream, aborted: stream.signal.aborted });
  }
  streams.abortAll();
  for (const { stream, aborted } of finished) assert.equal(stream.signal.aborted, aborted);
});

test("subscription cancellation covers already-aborted requests and all pending fetches", async () => {
  const { createSubscriptionStreams } = require("./desktop-core.cjs");
  const streams = createSubscriptionStreams();
  const request = new AbortController();
  request.abort();
  const stale = streams.open(request.signal);
  assert.equal(stale.signal.aborted, true);
  const active = Array.from({ length: 3 }, () => streams.open());
  streams.abortAll();
  for (const stream of active) assert.equal(stream.signal.aborted, true);
  const fresh = streams.open();
  assert.equal(fresh.signal.aborted, false);
  assert.equal(fresh.wrap(null), null);
  streams.abortAll();
  assert.equal(fresh.signal.aborted, false);
});
