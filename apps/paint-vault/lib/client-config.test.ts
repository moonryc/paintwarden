import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { clientConfig } from "./client-config.ts";

test("desktop connection choice persists and rejects foreign origins", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-client-"));
  process.env.DATA_DIR = directory;
  process.env.PAINT_VAULT_DESKTOP = "1";
  const url = "http://127.0.0.1:3173/api/client-config";
  const put = (body: object, origin?: string) =>
    new Request(url, {
      method: "PUT",
      headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await (await clientConfig(new Request(url))).json()).mode, null);
    assert.equal(
      (
        await clientConfig(
          put({ mode: "remote", serverUrl: "https://vault.example.com" }, "https://evil.example"),
        )
      ).status,
      403,
    );
    assert.equal((await clientConfig(put({ mode: "remote", serverUrl: "file:///etc/passwd" }))).status, 400);
    assert.equal(
      (await clientConfig(put({ mode: "remote", serverUrl: "https://vault.example.com" }))).status,
      200,
    );
    assert.deepEqual(await (await clientConfig(new Request(url))).json(), {
      mode: "remote",
      serverUrl: "https://vault.example.com",
    });
    assert.equal((await clientConfig(put({ mode: "local" }))).status, 200);
    assert.deepEqual(await (await clientConfig(new Request(url))).json(), { mode: "local" });
  } finally {
    delete process.env.PAINT_VAULT_DESKTOP;
    rmSync(directory, { recursive: true, force: true });
  }
});
