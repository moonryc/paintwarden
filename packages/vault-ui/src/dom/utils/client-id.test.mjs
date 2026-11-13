import assert from "node:assert/strict";
import test from "node:test";

import { createClientId } from "./client-id.ts";

test("creates a UUID when randomUUID is unavailable", () => {
  const source = {
    getRandomValues(bytes) {
      bytes.fill(0xab);
      return bytes;
    },
    randomUUID() {
      throw new Error("randomUUID is unavailable on HTTP LAN pages");
    },
  };
  assert.equal(createClientId(source), "abababab-abab-4bab-abab-abababababab");
});
