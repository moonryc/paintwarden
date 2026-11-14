import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import {
  BlockedUrlError,
  ResponseTooLargeError,
  createPublicDownloader,
  downloadPublic,
  isPublicAddress,
} from "./public-fetch.ts";

test("only public addresses are allowed", () => {
  for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])
    assert.equal(isPublicAddress(address), true, address);
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::",
    "::1",
    "fc00::1",
    "fd12::1",
    "fe80::1",
    "fe80::1%en0",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:10.0.0.1",
    "::7f00:1",
    "64:ff9b::7f00:1",
    "2002:7f00:1::",
    "not an address",
  ])
    assert.equal(isPublicAddress(address), false, address);
});

let requests = 0;
const server = createServer((request, response) => {
  requests += 1;
  if (request.url === "/image") {
    response.writeHead(200, { "content-type": "Image/PNG; charset=binary" });
    response.end("abcd");
  } else if (request.url === "/to-image") {
    response.writeHead(302, { location: "/image" });
    response.end();
  } else if (request.url === "/to-private") {
    response.writeHead(302, { location: "http://10.0.0.1/secret" });
    response.end();
  } else if (request.url === "/loop") {
    response.writeHead(302, { location: "/loop" });
    response.end();
  } else if (request.url === "/chunked") {
    response.writeHead(200);
    response.write("abc");
    response.end("def");
  } else {
    response.writeHead(404);
    response.end();
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
test.after(() => server.close());
const port = (server.address() as AddressInfo).port;
const local = (path: string) => new URL(`http://127.0.0.1:${port}${path}`);
const download = createPublicDownloader((address) => address === "127.0.0.1");
const options = { maxBytes: 5 };

test("a permitted address downloads, following redirects", async () => {
  const image = await download(local("/to-image"), options);
  assert.equal(image.status, 200);
  assert.equal(image.contentType, "image/png");
  assert.equal(Buffer.from(image.bytes).toString(), "abcd");
});

test("a redirect to a private address is blocked", async () => {
  await assert.rejects(download(local("/to-private"), options), BlockedUrlError);
});

test("redirects are limited", async () => {
  await assert.rejects(download(local("/loop"), options), /Too many redirects/);
});

test("a response over the limit is refused even without a declared length", async () => {
  await assert.rejects(download(local("/chunked"), options), ResponseTooLargeError);
});

test("private destinations are never contacted", async () => {
  const before = requests;
  await assert.rejects(downloadPublic(local("/image"), options), BlockedUrlError);
  // A hostname is judged by what it resolves to, not by how it looks.
  await assert.rejects(downloadPublic(new URL(`http://localhost:${port}/image`), options), BlockedUrlError);
  await assert.rejects(downloadPublic(new URL(`http://2130706433:${port}/image`), options), BlockedUrlError);
  assert.equal(requests, before);
});

test("other schemes, credentials and plain HTTP when HTTPS is required are blocked", async () => {
  await assert.rejects(download(new URL("file:///etc/passwd"), options), BlockedUrlError);
  await assert.rejects(download(new URL(`http://a:b@127.0.0.1:${port}/image`), options), BlockedUrlError);
  await assert.rejects(download(local("/image"), { ...options, httpsOnly: true }), BlockedUrlError);
});
