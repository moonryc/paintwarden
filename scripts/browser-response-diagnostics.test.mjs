import assert from "node:assert/strict";
import test from "node:test";
import { isDiscardedResponseBody } from "../e2e/browser-response-diagnostics.mjs";
const discarded = new Error(
  "response.json: Protocol error (Network.getResponseBody): No data found for resource with given identifier",
);
test("only discarded response bodies are ignorable; live failures remain fatal", () => {
  assert.equal(isDiscardedResponseBody(discarded, { documentChanged: true }), true);
  assert.equal(
    isDiscardedResponseBody(discarded, { documentChanged: false, requestFailure: "net::ERR_ABORTED" }),
    true,
  );
  assert.equal(isDiscardedResponseBody(discarded, { documentChanged: false }), false);
  assert.equal(
    isDiscardedResponseBody(discarded, {
      documentChanged: false,
      requestFailure: "net::ERR_CONNECTION_RESET",
    }),
    false,
  );
  assert.equal(
    isDiscardedResponseBody(new SyntaxError("Unexpected token in JSON"), {
      documentChanged: true,
      requestFailure: "net::ERR_ABORTED",
    }),
    false,
  );
  assert.equal(isDiscardedResponseBody(new Error("GraphQL error"), { documentChanged: true }), false);
  assert.equal(isDiscardedResponseBody(new Error("HTTP 500"), { documentChanged: true }), false);
});
