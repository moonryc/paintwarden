import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { buildBugReportUrl } from "./support.ts";
const require = createRequire(import.meta.url);
const desktop = require("../../../../../apps/paintwarden-electron/desktop-support.cjs");
test("issue URL includes only template and safe prefillable diagnostic fields; desktop parity", () => {
  for (const language of ["en", "de", "ja", "zh-Hant", "private@example.invalid"]) {
    const input = {
      version: "1.0.0",
      os: "macOS",
      mode: "remote",
      language,
      recentErrors: ["PRIVATE"],
      notes: "PRIVATE",
      token: "PRIVATE",
    };
    const url = buildBugReportUrl(input);
    assert.equal(url, desktop.buildBugReportUrl(input));
    assert.equal(
      new URL(url).origin + new URL(url).pathname,
      "https://github.com/moonryc/paintwarden/issues/new",
    );
    assert.deepEqual(
      [...new URL(url).searchParams.keys()],
      ["template", "version", "os", "mode", "language"],
    );
    assert.ok(!url.includes("PRIVATE"));
  }
  const url = buildBugReportUrl({
    version: "PRIVATE",
    os: "/Users/PRIVATE",
    mode: "local",
    language: "PRIVATE",
  });
  assert.equal(new URL(url).searchParams.get("version"), "unknown");
  assert.ok(!url.includes("PRIVATE"));
});

test("browser summary/download never reads vault, secrets, addresses or raw errors; report uses noopener", async (t) => {
  const { getSupportSummary, reportBug, saveSupportBundle } = await import("./support.ts");
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  t.after(() => {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    else delete globalThis.navigator;
  });
  const opened = [];
  globalThis.window = {
    location: { hostname: "private-server.example.invalid" },
    open: (...args) => opened.push(args),
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { platform: "MacIntel PRIVATE" },
  });
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url, "/api/version");
    return {
      ok: true,
      json: async () => ({ version: "private@example.invalid", name: "PRIVATE", notes: "PRIVATE" }),
    };
  });
  const summary = await getSupportSummary("ja");
  assert.equal(summary.os, "macOS");
  assert.equal(summary.mode, "remote");
  assert.equal(summary.serverVersion, "unknown");
  assert.ok(!JSON.stringify(summary).includes("PRIVATE"));
  await reportBug("ja");
  assert.equal(opened.length, 1);
  assert.deepEqual(opened[0].slice(1), ["_blank", "noopener,noreferrer"]);
  assert.ok(!opened[0][0].includes("private-server"));
  let savedBlob;
  t.mock.method(URL, "createObjectURL", (blob) => {
    savedBlob = blob;
    return "blob:test";
  });
  t.mock.method(URL, "revokeObjectURL", () => {});
  const link = {
    click() {
      this.clicked = true;
    },
  };
  globalThis.document = { createElement: () => link };
  assert.equal(await saveSupportBundle("ja"), true);
  assert.equal(link.download, "paintwarden-support.json");
  assert.equal(link.clicked, true);
  assert.deepEqual(JSON.parse(await savedBlob.text()), summary);
});

test("desktop support actions delegate only a validated language, never renderer supplied URLs or data", async (t) => {
  const { getSupportSummary, reportBug, saveSupportBundle } = await import("./support.ts");
  const previous = globalThis.window;
  t.after(() => {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  });
  const calls = [];
  globalThis.window = {
    paintwardenDesktop: {
      getSupportSummary: async (language) => {
        calls.push(["summary", language]);
        return { version: "1.0.0" };
      },
      openBugReport: async (language) => {
        calls.push(["report", language]);
        return true;
      },
      saveSupportBundle: async (language) => {
        calls.push(["save", language]);
        return false;
      },
    },
  };
  await getSupportSummary("PRIVATE");
  await reportBug("ja");
  assert.equal(await saveSupportBundle("PRIVATE"), false);
  assert.deepEqual(calls, [
    ["summary", "en"],
    ["report", "ja"],
    ["save", "en"],
  ]);
});
