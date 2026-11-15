import assert from "node:assert/strict";
import test from "node:test";
import { assessUnsigned } from "./check-mac-signature.mjs";

test("unsigned Gatekeeper assessment accepts only explicit policy rejection, never damage", () => {
  assert.match(assessUnsigned({ status: 3, stderr: "/tmp/Paintwarden.app: rejected\n" }), /rejected/);
  for (const result of [
    { status: 0, stderr: "/tmp/Paintwarden.app: accepted\n" },
    { status: 1, stderr: "/tmp/Paintwarden.app: rejected\n" },
    { status: 3, stderr: "/tmp/Paintwarden.app: rejected\nsource=damaged" },
    { status: 3, stderr: "/tmp/Paintwarden.app: rejected\ninvalid resource envelope" },
    {
      status: 3,
      stderr:
        "/tmp/Paintwarden.app: rejected\ncode has no resources but signature indicates they must be present (invalid)",
    },
    { status: 3, stderr: "assessment unavailable" },
    { status: null, error: new Error("tool missing") },
  ])
    assert.throws(() => assessUnsigned(result));
});
