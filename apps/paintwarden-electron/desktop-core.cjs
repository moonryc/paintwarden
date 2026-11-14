const path = require("node:path");
const { t } = require("./desktop-i18n.cjs");

function serverOrigin(input) {
  if (typeof input !== "string") throw new Error(t("errors.enterUrl"));
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error(t("errors.serverOrigin"));
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(t("errors.serverOrigin"));
  return url.origin;
}

function parsedChoice(value) {
  if (value?.mode === "local") return { mode: "local" };
  if (value?.mode === "remote") {
    try {
      return { mode: "remote", serverUrl: serverOrigin(value.serverUrl) };
    } catch {
      return { mode: null };
    }
  }
  return { mode: null };
}

function assetPath(directory, pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const name = decoded === "/" ? "index.html" : decoded.slice(1);
  const file = path.resolve(directory, name);
  return file === directory || file.startsWith(`${directory}${path.sep}`) ? file : null;
}

// Only Vite's content-hashed shell code/styles/fonts are immutable. The entry HTML,
// service worker and all API/image paths must retain their existing cache policies.
function shellCacheControl(pathname) {
  return /^\/assets\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?)$/.test(pathname)
    ? "public, max-age=31536000, immutable"
    : "no-store";
}

// Only known image endpoints may retain a server cache policy, and only under the
// active server/account namespace. JSON, errors, unscoped URLs and writes never cache.
function imageRequest(method, pathname) {
  return (
    method === "GET" &&
    (/^\/api\/(?:miniatures|miniature-templates)\/[^/]+\/image$/.test(pathname) ||
      /^\/api\/catalog-source-(?:images|logos)\/[^/]+$/.test(pathname))
  );
}

function imageProxyCacheControl(method, pathname, response, scoped) {
  if (
    !scoped ||
    !imageRequest(method, pathname) ||
    response.status !== 200 ||
    !response.headers.get("content-type")?.startsWith("image/")
  )
    return "no-store";
  const policy = response.headers.get("cache-control") ?? "";
  return /^private, (?:max-age=\d+(?:, immutable)?|no-cache)$/.test(policy) ? policy : "no-store";
}

// Chromium does not reuse HTTP-cache entries for protocol.handle responses. Retain a
// small LRU of image bytes ourselves, honoring the upstream TTL and never storing JSON.
// The caller namespaces keys and clears this cache at server/account boundaries.
function createImageCache({
  maxBytes = 64 * 1024 * 1024,
  maxEntryBytes = 8 * 1024 * 1024,
  maxEntries = 128,
  now = Date.now,
} = {}) {
  const entries = new Map();
  let bytes = 0,
    generation = 0;
  function remove(key) {
    const entry = entries.get(key);
    if (entry) bytes -= entry.bytes.byteLength;
    entries.delete(key);
  }
  return {
    clear() {
      entries.clear();
      bytes = 0;
      generation++;
    },
    get(key) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.expires <= now()) {
        remove(key);
        return null;
      }
      entries.delete(key);
      entries.set(key, entry);
      return new Response(entry.bytes, { status: 200, headers: entry.headers });
    },
    async put(key, response) {
      const ttl = /^private, max-age=(\d+)(?:, immutable)?$/.exec(
        response.headers.get("cache-control") ?? "",
      );
      if (
        response.status !== 200 ||
        !response.headers.get("content-type")?.startsWith("image/") ||
        !ttl ||
        Number(ttl[1]) <= 0 ||
        !response.body
      )
        return;
      if (Number(response.headers.get("content-length")) > maxEntryBytes) return;
      const version = generation;
      const expires = now() + Math.min(Number(ttl[1]), 31536000) * 1000;
      const reader = response.clone().body.getReader();
      const chunks = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxEntryBytes || size > maxBytes || version !== generation) {
            // Cancelling a tee branch waits for the other reader; do not await it.
            void reader.cancel().catch(() => undefined);
            return;
          }
          chunks.push(value);
        }
      } catch {
        return;
      }
      if (version !== generation) return;
      const content = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        content.set(chunk, offset);
        offset += chunk.byteLength;
      }
      remove(key);
      while (entries.size && (entries.size >= maxEntries || bytes + size > maxBytes))
        remove(entries.keys().next().value);
      if (maxEntries <= 0) return;
      entries.set(key, { bytes: content, headers: new Headers(response.headers), expires });
      bytes += size;
    },
  };
}

// Only the GraphQL subscription transport opts out of the ordinary API deadline.
function subscriptionRequest(method, pathname) {
  return method === "POST" && pathname === "/api/graphql/stream";
}

// Own a subscription from fetch through EOF. Custom-protocol response cancellation and
// server switches must also close its upstream socket, including while awaiting headers.
function createSubscriptionStreams() {
  const active = new Set();
  return {
    abortAll() {
      for (const stream of active) stream.abort();
    },
    open(signal) {
      const controller = new AbortController();
      let reader,
        downstream,
        finished = false;
      const finish = () => {
        finished = true;
        active.delete(stream);
        signal?.removeEventListener("abort", abort);
      };
      const abort = () => {
        if (finished) return;
        controller.abort();
        downstream?.error(controller.signal.reason);
        // Never wait for a remote server to acknowledge cancellation.
        void reader?.cancel().catch(() => undefined);
        finish();
      };
      const stream = {
        signal: controller.signal,
        abort,
        wrap(body) {
          if (!body) {
            finish();
            return null;
          }
          reader = body.getReader();
          return new ReadableStream({
            start(output) {
              downstream = output;
              if (controller.signal.aborted) {
                output.error(controller.signal.reason);
                void reader.cancel().catch(() => undefined);
              }
            },
            async pull(output) {
              try {
                const { done, value } = await reader.read();
                if (finished) return;
                if (done) {
                  output.close();
                  finish();
                } else output.enqueue(value);
              } catch (error) {
                if (!finished) {
                  output.error(error);
                  finish();
                }
              }
            },
            cancel: abort,
          });
        },
      };
      active.add(stream);
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      return stream;
    },
  };
}

const releaseVersion = (value) =>
  typeof value === "string" &&
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/.test(value);

function olderThan(left, right) {
  const parts = (version) => {
    const [core, beta] = version.split("-beta.");
    return [...core.split(".").map(Number), beta === undefined ? Infinity : Number(beta)];
  };
  const a = parts(left),
    b = parts(right);
  for (let i = 0; i < 4; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

// The desktop app works only with a server of exactly its own version. Returns null when they
// match, otherwise which side needs updating and a message saying so. A server that doesn't report
// a version predates this check, so it is older.
function versionMismatch(appVersion, serverVersion) {
  if (serverVersion === appVersion) return null;
  const known = releaseVersion(serverVersion);
  const update = !known || olderThan(serverVersion, appVersion) ? "server" : "app";
  const message = !known
    ? t("errors.olderServer", { appVersion })
    : update === "server"
      ? t("errors.updateServer", { serverVersion, appVersion })
      : t("errors.updateApp", { serverVersion, appVersion });
  return { update, appVersion, serverVersion: known ? serverVersion : null, message };
}

// Preserve reviewed wire codes, never a legacy server diagnostic, across IPC.
function publicErrorResult(body, fallback) {
  const parameters = body?.errorParameters;
  return {
    error: fallback,
    errorCode: typeof body?.errorCode === "string" ? body.errorCode : "REQUEST_FAILED",
    errorParameters:
      parameters && typeof parameters === "object" && !Array.isArray(parameters)
        ? Object.fromEntries(
            Object.entries(parameters).filter(
              ([, value]) => typeof value === "string" || typeof value === "number",
            ),
          )
        : {},
  };
}

module.exports = {
  publicErrorResult,
  serverOrigin,
  parsedChoice,
  assetPath,
  shellCacheControl,
  imageRequest,
  imageProxyCacheControl,
  createImageCache,
  subscriptionRequest,
  createSubscriptionStreams,
  versionMismatch,
};
