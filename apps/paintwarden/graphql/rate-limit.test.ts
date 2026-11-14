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
  for (let i = 0; i < 4; i++) {
    const release = acquireOperation(request(`concurrent-${i}`, "Bearer session-concurrent"), true);
    assert.ok(release);
    releases.push(release);
  }
  assert.equal(acquireOperation(request("concurrent-5", "Bearer session-concurrent"), true), null);
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
