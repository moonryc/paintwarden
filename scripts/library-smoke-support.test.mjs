import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { attachLibraryRecorder, libraryReads } from "./library-smoke-support.mjs";

function request(path, body) {
  return {
    url: () => `http://phase2-library.localhost:12345${path}`,
    method: () => "POST",
    postDataJSON: () => body,
  };
}
function response(req, data) {
  return { request: () => req, status: () => 200, text: async () => JSON.stringify(data) };
}
test("recorder captures bounded Library response and markers without credentials", async () => {
  const page = new EventEmitter();
  const recorder = attachLibraryRecorder(page);
  const auth = request("/api/auth/login", { password: "private fixture password" });
  page.emit("request", auth);
  page.emit("response", response(auth, { token: "private-token" }));
  await recorder.settle();
  assert.equal(recorder.requests[0].body, undefined);
  assert.equal(recorder.requests[0].data, undefined);
  const mark = recorder.mark();
  const req = request("/api/graphql", { variables: { first: 48 } });
  const ready = recorder.waitFor((entries) => libraryReads(entries).length === 1, mark);
  page.emit("request", req);
  page.emit(
    "response",
    response(req, { data: { library: { nodes: [], revision: { epoch: "fixture", seq: "1" } } } }),
  );
  const entries = await ready;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].body.variables.first, 48);
  assert.ok(entries[0].bytes > 0);
  assert.equal(JSON.stringify(recorder.requests).includes("private-"), false);
});
test("recorder never consumes streaming response body", async () => {
  const page = new EventEmitter();
  const recorder = attachLibraryRecorder(page);
  const req = request("/api/graphql/stream", {});
  page.emit("request", req);
  page.emit("response", {
    request: () => req,
    status: () => 200,
    text: () => {
      throw new Error("Must not consume SSE");
    },
  });
  await recorder.settle();
  assert.equal(recorder.requests[0].status, 200);
  assert.equal(recorder.requests[0].readError, undefined);
});
