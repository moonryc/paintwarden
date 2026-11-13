import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createVaultStore } from "../store/vault-store.ts";
import { needsLegacySnapshot } from "../utils/legacy-screen.ts";

const tabs = [
  "dashboard",
  "miniatures",
  "paints",
  "wishlist",
  "schemes",
  "templates",
  "settings",
  "paint-tools",
] as const;
test("every screen and overlay launches without the legacy snapshot", () => {
  for (const tab of tabs)
    for (const plugins of [false, true])
      for (const schemeForm of [false, true])
        assert.equal(needsLegacySnapshot(tab, { plugins, schemeForm }), false, tab);
});

test("shell, actions and provider cannot activate a legacy transport", async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (url) => {
    const path = url instanceof Request ? url.url : typeof url === "string" ? url : url.href;
    requests.push(path);
    assert.equal(path, "/api/auth/status");
    return Response.json({ setupRequired: false, requireSignIn: false, authenticated: false });
  };
  try {
    const store = createVaultStore();
    await store.getState().checkServer();
    await store.getState().syncChanges();
    await store.getState().refresh();
    store.getState().setToken("");
    await store.getState().checkServer();
    assert.deepEqual(requests, Array(3).fill("/api/auth/status"));
    for (const path of ["/api/state", "/api/state?revision=1", "/api/changes?since=0"])
      await assert.rejects(store.getState().api(path, {}), /Legacy snapshot requests are disabled/);
    assert.ok(requests.every((path) => path === "/api/auth/status"));
  } finally {
    globalThis.fetch = original;
  }
  for (const file of [
    "../Vault.tsx",
    "../store/hooks.ts",
    "../store/vault-store.ts",
    "../utils/vault-query.ts",
    "./provider.tsx",
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /@tanstack|legacy-vault-query|legacy-vault-store|useVaultData\([^)]*legacyRequired/,
    );
    assert.doesNotMatch(source, /fetch\(["'`]\/api\/(?:state|changes)/);
  }
});

test("late pre-login auth status cannot restore another account", async () => {
  const original = globalThis.fetch;
  let resolveFirst!: (response: Response) => void;
  const oldResponse = new Promise<Response>((resolve) => {
    resolveFirst = resolve;
  });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls === 1 ? oldResponse : Response.json({ username: "new", authenticated: true });
  };
  try {
    const store = createVaultStore();
    const check = store.getState().checkServer();
    store.getState().setToken("new-token");
    resolveFirst(Response.json({ username: "old", authenticated: true }));
    await check;
    await store.getState().checkServer();
    assert.equal(store.getState().auth?.username, "new");
    assert.equal(store.getState().token, "new-token");
    assert.equal(store.getState().authGeneration, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("production import graph excludes TanStack and retained snapshot/row-delta code", () => {
  const visited = new Set<string>();
  const visit = (url: URL) => {
    const file = fileURLToPath(url);
    if (visited.has(file)) return;
    visited.add(file);
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /["']@tanstack\//, file);
    assert.doesNotMatch(source, /from ["'][^"']*legacy-vault-(?:store|query)/, file);
    for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*)["'](\.[^"']+)["']/g)) {
      const target = new URL(match[1], url);
      const dependency = [
        target,
        new URL(`${target.href}.ts`),
        new URL(`${target.href}.tsx`),
        new URL(`${target.href}/index.ts`),
      ].find((candidate) => /\.tsx?$/.test(candidate.pathname) && existsSync(candidate));
      if (dependency) visit(dependency);
    }
  };
  visit(new URL("../Vault.tsx", import.meta.url));
  assert.ok(visited.size > 100, "guard must traverse lazy screens and overlays");
});
