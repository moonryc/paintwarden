import assert from "node:assert/strict";
import test from "node:test";

import { limitRequestBody } from "./request-limits.ts";

const limit = { maxBytes: 4, message: "Too large" };
const post = (body: BodyInit, headers?: HeadersInit) =>
  new Request("http://localhost/", { method: "POST", body, headers });

test("a body within the limit reads normally", async () => {
  const limited = limitRequestBody(post("abcd"), limit)!;
  assert.equal(await limited.request.text(), "abcd");
  assert.equal(limited.exceeded(), false);
});

test("a declared length over the limit is refused without reading", () => {
  assert.equal(limitRequestBody(post("a", { "content-length": "5" }), limit), null);
});

test("an undeclared body fails once it passes the limit", async () => {
  const limited = limitRequestBody(post("abcde"), limit)!;
  await assert.rejects(limited.request.text());
  assert.equal(limited.exceeded(), true);
});

test("a request without a body passes through", () => {
  const request = new Request("http://localhost/");
  const limited = limitRequestBody(request, limit)!;
  assert.equal(limited.request, request);
  assert.equal(limited.exceeded(), false);
});
