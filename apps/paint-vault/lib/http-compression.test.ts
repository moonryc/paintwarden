import assert from "node:assert/strict";
import { createServer, get, type IncomingHttpHeaders } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { compressJsonResponse, JSON_COMPRESSION_THRESHOLD } from "./http-compression";

const payload = JSON.stringify({ paints: "blue".repeat(2048) });
const request = (acceptEncoding?: string, init: RequestInit = {}) =>
  new Request("http://localhost/api/state", {
    ...init,
    headers: { ...(acceptEncoding ? { "accept-encoding": acceptEncoding } : {}), ...init.headers },
  });
const jsonResponse = (body = payload, headers: HeadersInit = {}) =>
  new Response(body, { headers: { "content-type": "application/json; charset=utf-8", ...headers } });

async function assertBody(result: Response, body: string, compressed: boolean) {
  assert.equal(result.headers.get("content-encoding"), compressed ? "gzip" : null);
  const bytes = Buffer.from(await result.arrayBuffer());
  assert.equal(compressed ? gunzipSync(bytes).toString() : bytes.toString(), body);
}

void test("compresses JSON at the byte threshold, but leaves smaller responses unchanged", async () => {
  for (const size of [JSON_COMPRESSION_THRESHOLD - 1, JSON_COMPRESSION_THRESHOLD, 16 * 1024]) {
    const body = JSON.stringify("x".repeat(size - 2));
    const result = await compressJsonResponse(
      request("gzip"),
      jsonResponse(body, { "content-length": String(size) }),
    );
    const compressed = size >= JSON_COMPRESSION_THRESHOLD;
    assert.equal(result.headers.get("content-length"), compressed ? null : String(size));
    assert.equal(result.headers.get("vary"), "Accept-Encoding");
    await assertBody(result, body, compressed);
  }
  const multibyte = JSON.stringify("é".repeat(600));
  assert.ok(multibyte.length < JSON_COMPRESSION_THRESHOLD);
  await assertBody(await compressJsonResponse(request("gzip"), jsonResponse(multibyte)), multibyte, true);
});

void test("negotiates gzip with quality values, explicit exclusions, and identity preference", async () => {
  const cases: [string | undefined, boolean][] = [
    [undefined, false],
    ["", false],
    ["br", false],
    ["x-gzip-not-supported", false],
    ["identity", false],
    ["gzip", true],
    ["GZip;Q=0.5", true],
    ["br;q=1, gzip;q=0.5", true],
    ["*;q=0.5", true],
    ["gzip;q=0, *;q=1", false],
    ["gzip;q=0.000", false],
    ["gzip;q=bogus", false],
    ["gzip;q=1.1", false],
    ["gzip;q=-1", false],
    ["*;q=0", false],
    ["gzip;q=0.5, identity;q=1", false],
    ["gzip;q=1, identity;q=0", true],
  ];
  for (const [acceptEncoding, compressed] of cases) {
    const result = await compressJsonResponse(request(acceptEncoding), jsonResponse());
    assert.equal(result.headers.get("vary"), "Accept-Encoding", acceptEncoding);
    await assertBody(result, payload, compressed);
  }
});

void test("preserves response metadata and merges Vary without duplicates", async () => {
  for (const vary of ["Origin", "Origin, accept-encoding", "*"]) {
    const result = await compressJsonResponse(
      request("gzip"),
      new Response(payload, {
        status: 201,
        statusText: "Created",
        headers: {
          "content-type": "application/problem+json",
          "content-length": String(Buffer.byteLength(payload)),
          "content-md5": "obsolete",
          "content-digest": "obsolete",
          etag: '"state-v1"',
          vary,
          "set-cookie": "pv_session=fixture; HttpOnly",
          "x-content-type-options": "nosniff",
        },
      }),
    );
    assert.equal(result.status, 201);
    assert.equal(result.statusText, "Created");
    assert.equal(result.headers.get("vary"), vary === "Origin" ? "Origin, Accept-Encoding" : vary);
    assert.equal(result.headers.get("etag"), 'W/"state-v1"');
    assert.equal(result.headers.get("content-md5"), null);
    assert.equal(result.headers.get("content-digest"), null);
    assert.equal(result.headers.get("set-cookie"), "pv_session=fixture; HttpOnly");
    assert.equal(result.headers.get("x-content-type-options"), "nosniff");
    await assertBody(result, payload, true);
  }
  const weak = await compressJsonResponse(request("gzip"), jsonResponse(payload, { etag: 'W/"v1"' }));
  assert.equal(weak.headers.get("etag"), 'W/"v1"');
  await weak.body?.cancel();
});

void test("does not transform images, ZIPs, non-JSON, encoded, partial, HEAD, or no-transform responses", async () => {
  const exclusions: Record<string, string>[] = [
    { "content-type": "image/png" },
    { "content-type": "image/svg+xml" },
    { "content-type": "application/zip" },
    { "content-type": "application/octet-stream" },
    { "content-type": "text/html" },
    { "content-encoding": "br" },
    { "content-range": "bytes 0-1023/2048" },
    { "cache-control": "private, no-transform" },
  ];
  for (const headers of exclusions) {
    const original = jsonResponse(payload, headers);
    const result = await compressJsonResponse(request("gzip"), original);
    assert.equal(result, original);
    assert.equal(await result.text(), payload);
  }
  for (const req of [
    request("gzip", { method: "HEAD" }),
    request("gzip", { headers: { "cache-control": "no-transform" } }),
  ]) {
    const original = jsonResponse();
    assert.equal(await compressJsonResponse(req, original), original);
    await original.body?.cancel();
  }
  for (const status of [204, 205, 304]) {
    const original = new Response(null, { status });
    assert.equal(await compressJsonResponse(request("gzip"), original), original);
  }
  const partial = new Response(payload, { status: 206, headers: { "content-type": "application/json" } });
  assert.equal(await compressJsonResponse(request("gzip"), partial), partial);
  await partial.body?.cancel();
});

void test("preserves chunked bodies on both sides of the threshold", async () => {
  for (const size of [100, JSON_COMPRESSION_THRESHOLD - 1, JSON_COMPRESSION_THRESHOLD + 256]) {
    const text = JSON.stringify("x".repeat(size - 2));
    const bytes = new TextEncoder().encode(text);
    let offset = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset === bytes.length) controller.close();
        else {
          controller.enqueue(bytes.slice(offset, offset + 100));
          offset = Math.min(offset + 100, bytes.length);
        }
      },
    });
    const result = await compressJsonResponse(
      request("gzip"),
      new Response(body, { headers: { "content-type": "application/json" } }),
    );
    await assertBody(result, text, size >= JSON_COMPRESSION_THRESHOLD);
  }
});

void test("checks streamed JSON across chunk boundaries and propagates cancellation", async () => {
  let reads = 0;
  let cancelled = false;
  const chunk = new TextEncoder().encode("x".repeat(128));
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      reads += 1;
      controller.enqueue(chunk);
    },
    cancel() {
      cancelled = true;
    },
  });
  const result = await compressJsonResponse(
    request("gzip"),
    new Response(body, { headers: { "content-type": "application/json" } }),
  );
  assert.equal(result.headers.get("content-encoding"), "gzip");
  assert.ok(reads <= 10, `only the threshold plus stream lookahead should be read, got ${reads}`);
  await result.body?.cancel();
  // CompressionStream forwards cancellation asynchronously through its transform.
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(cancelled, true);
});

void test("forwards compressed JSON over HTTP with no stale content length", async () => {
  const server = createServer(async (incoming, outgoing) => {
    const result = await compressJsonResponse(
      request(incoming.headers["accept-encoding"]),
      jsonResponse(payload, { "content-length": String(Buffer.byteLength(payload)) }),
    );
    outgoing.statusCode = result.status;
    result.headers.forEach((value, key) => outgoing.setHeader(key, value));
    await pipeline(Readable.fromWeb(result.body as NodeReadableStream), outgoing);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const { headers, bytes } = await new Promise<{
      headers: IncomingHttpHeaders;
      bytes: Buffer;
    }>((resolve, reject) => {
      get(`http://127.0.0.1:${address.port}/api/state`, { headers: { "accept-encoding": "gzip" } }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("error", reject);
        res.on("end", () => resolve({ headers: res.headers, bytes: Buffer.concat(chunks) }));
      }).on("error", reject);
    });
    assert.equal(headers["content-encoding"], "gzip");
    assert.equal(headers["content-length"], undefined);
    assert.equal(headers.vary, "Accept-Encoding");
    assert.equal(gunzipSync(bytes).toString(), payload);
    assert.ok(bytes.length < Buffer.byteLength(payload));
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
