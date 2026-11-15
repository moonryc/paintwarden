import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { acquireOperation } from "./rate-limit.ts";

const credentialToken = (credential: string) => createHash("sha256").update(credential).digest("hex");
const request = (client: string, credential: string) =>
  new Request("http://127.0.0.1/api/graphql", {
    headers: { "x-paintwarden-client": client, authorization: `Bearer ${credentialToken(credential)}` },
  });

void test("client rate budget cannot be bypassed by rotating session headers", () => {
  for (let i = 0; i < 120; i++) {
    const release = acquireOperation(request("rate-client", `Bearer fake-${i}`), false);
    assert.ok(release);
    release();
    release(); // Cleanup is idempotent, including abort + body completion races.
  }
  assert.equal(acquireOperation(request("rate-client", "Bearer fresh"), false), null);
  const other = acquireOperation(request("other-client", "Bearer fresh"), false);
  assert.ok(other);
  other();
});

void test("one session is limited across multiple client addresses", () => {
  const releases: (() => void)[] = [];
  for (let i = 0; i < 8; i++) {
    const release = acquireOperation(request(`concurrent-${i}`, "Bearer session-concurrent"), true);
    assert.ok(release);
    releases.push(release);
  }
  assert.equal(acquireOperation(request("concurrent-9", "Bearer session-concurrent"), true), null);
  assert.equal(
    acquireOperation(
      new Request("http://127.0.0.1/api/graphql", {
        headers: {
          "x-paintwarden-client": "another-peer",
          cookie: `unrelated=new; pv_session=${credentialToken("Bearer session-concurrent")}; other=rotated`,
        },
      }),
      true,
    ),
    null,
  );
  releases.forEach((release) => release());
  const recovered = acquireOperation(request("concurrent-6", "Bearer session-concurrent"), true);
  assert.ok(recovered);
  recovered();
});

void test("long-lived streams cannot exhaust mutation/query concurrency and both budgets stay bounded", () => {
  const req = request("independent-budgets", "independent-session");
  const releaseStreams = Array.from({ length: 8 }, () => acquireOperation(req, true));
  assert.ok(releaseStreams.every(Boolean));
  assert.equal(acquireOperation(req, true), null);
  const releaseOperations = Array.from({ length: 4 }, () => acquireOperation(req, false));
  assert.ok(releaseOperations.every(Boolean));
  assert.equal(acquireOperation(req, false), null);
  releaseStreams.forEach((release) => release!());
  const recoveredStream = acquireOperation(req, true);
  assert.ok(recoveredStream);
  releaseOperations.forEach((release) => release!());
  const recoveredOperation = acquireOperation(req, false);
  assert.ok(recoveredOperation);
  recoveredStream();
  recoveredOperation();
});

void test("stream reconnect rates cannot starve edits or bypass client/session budgets", () => {
  // Rotating credentials does not evade a client's stream-start allowance.
  for (let i = 0; i < 120; i++) {
    const release = acquireOperation(request("stream-rate-client", `rotated-stream-${i}`), true);
    assert.ok(release);
    release();
  }
  assert.equal(acquireOperation(request("stream-rate-client", "fresh-stream-token"), true), null);
  const edit = acquireOperation(request("stream-rate-client", "fresh-edit-token"), false);
  assert.ok(edit, "120 stream reconnects must leave all ordinary rate slots available");
  edit();
  // Rotating addresses cannot evade a credential's stream-start allowance.
  for (let i = 0; i < 120; i++) {
    const release = acquireOperation(request(`stream-peer-${i}`, "one-stream-credential"), true);
    assert.ok(release);
    release();
  }
  assert.equal(acquireOperation(request("new-stream-peer", "one-stream-credential"), true), null);
  const credentialEdit = acquireOperation(request("new-stream-peer", "one-stream-credential"), false);
  assert.ok(credentialEdit);
  credentialEdit();
  // Exhausting the ordinary rate allowance must not prevent reconnecting live updates.
  const reconnect = acquireOperation(request("rate-client", "new-reconnect-credential"), true);
  assert.ok(reconnect);
  reconnect();
});

void test("independent budgets preserve the global 128-stream cap", () => {
  const releases: (() => void)[] = [];
  try {
    for (let i = 0; i < 128; i++) {
      const release = acquireOperation(request(`global-peer-${i}`, `global-session-${i}`), true);
      assert.ok(release);
      releases.push(release);
    }
    assert.equal(acquireOperation(request("global-overflow-peer", "global-overflow-session"), true), null);
    const operation = acquireOperation(request("global-overflow-peer", "global-overflow-session"), false);
    assert.ok(operation);
    operation();
  } finally {
    releases.forEach((release) => release());
  }
});

void test("only server-verified sessions receive the measured interactive request budget", () => {
  const verified = request("verified-interactive-client", "verified-interactive-session");
  for (let i = 0; i < 800; i++) {
    const release = acquireOperation(verified, false, true);
    assert.ok(release);
    release();
  }
  assert.equal(acquireOperation(verified, false, true), null, "authenticated budget remains bounded");
  const unverified = request("unverified-interactive-client", "unverified-interactive-session");
  for (let i = 0; i < 120; i++) {
    const release = acquireOperation(unverified, false);
    assert.ok(release);
    release();
  }
  assert.equal(
    acquireOperation(unverified, false),
    null,
    "a token-shaped string never proves authentication",
  );
  const concurrency = request("verified-concurrent-client", "verified-concurrent-session");
  const releases = Array.from({ length: 4 }, () => acquireOperation(concurrency, false, true));
  assert.ok(releases.every(Boolean));
  assert.equal(acquireOperation(concurrency, false, true), null, "retain four-operation concurrency guard");
  releases.forEach((release) => release!());
});
