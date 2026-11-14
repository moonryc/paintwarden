import assert from "node:assert/strict";
import { test } from "node:test";

import { i18n, translateServerError } from "@paint-vault/i18n/runtime";

import { createVaultStore } from "../store/vault-store";
import { exportBackupFile } from "../utils/backup-export";
import { preprocessImage, rotateImage } from "../utils/image";
import { PublicError, publicErrorMessage } from "../utils/public-error";

void test("only explicitly localized errors can supply UI text", () => {
  assert.equal(publicErrorMessage(new PublicError("translated"), "fallback"), "translated");
  for (const error of [new Error("Failed to fetch private-host"), "raw diagnostic", { message: "raw" }])
    assert.equal(publicErrorMessage(error, "fallback"), "fallback");
});

void test("auth status hides network, JSON and HTTP diagnostics behind localized access text", async (t) => {
  const previous = i18n.language;
  await i18n.changeLanguage("de");
  try {
    for (const fetchResponse of [
      () => Promise.reject(new TypeError("Failed to fetch private-host")),
      () => Promise.resolve(new Response("private invalid JSON")),
      () => Promise.resolve(new Response("private server diagnostic", { status: 500 })),
    ]) {
      t.mock.method(globalThis, "fetch", fetchResponse);
      const store = createVaultStore();
      await store.getState().checkServer();
      assert.equal(store.getState().authError, i18n.t("shell:couldNotCheckVaultAccess"));
      assert.equal(store.getState().authLoading, false);
      assert.equal(store.getState().auth, null);
      t.mock.restoreAll();
    }
  } finally {
    await i18n.changeLanguage(previous);
  }
});

void test("REST actions retain stable localized server errors but hide unknown network/server text", async (t) => {
  const previous = i18n.language;
  await i18n.changeLanguage("de");
  try {
    for (const [response, expected] of [
      [() => Promise.reject(new TypeError("Failed to fetch private-host")), i18n.t("shell:requestFailed")],
      [
        () => Promise.resolve(Response.json({ error: "private legacy diagnostic" }, { status: 400 })),
        translateServerError({}),
      ],
      [
        () =>
          Promise.resolve(
            Response.json(
              { errorCode: "INVALID_SELECTION", errorParameters: { value1: "paint" } },
              { status: 400 },
            ),
          ),
        translateServerError({ errorCode: "INVALID_SELECTION", errorParameters: { value1: "paint" } }),
      ],
    ] as const) {
      t.mock.method(globalThis, "fetch", response);
      const notices: string[] = [];
      let refreshed = 0;
      const store = createVaultStore({
        notify: (message) => notices.push(message),
        refresh: async () => {
          refreshed += 1;
        },
      });
      await assert.rejects(store.getState().api("/api/auth/settings", {}), (error: unknown) => {
        assert.ok(error instanceof PublicError);
        assert.equal(error.message, expected);
        return true;
      });
      assert.deepEqual(notices, [expected]);
      assert.equal(refreshed, 1);
      t.mock.restoreAll();
    }
  } finally {
    await i18n.changeLanguage(previous);
  }
});

void test("backup export hides network/body/desktop diagnostics and preserves desktop cancellation", async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  // Import the modules before defining a window: i18n uses Vite-only resource
  // loading in a browser, while this test intentionally runs in Node.
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  try {
    for (const fetchResponse of [
      () => Promise.reject(new TypeError("Failed to fetch private-host")),
      () => Promise.resolve(new Response("private server diagnostic", { status: 500 })),
      () => Promise.resolve({ ok: true, blob: () => Promise.reject(new Error("private body diagnostic")) }),
    ]) {
      t.mock.method(globalThis, "fetch", fetchResponse);
      await assert.rejects(
        exportBackupFile(() => ({})),
        (error: unknown) => {
          assert.ok(error instanceof PublicError);
          assert.equal(error.message, i18n.t("shell:exportFailed"));
          return true;
        },
      );
      t.mock.restoreAll();
    }
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { paintVaultDesktop: { saveBackup: () => Promise.reject(new Error("private desktop path")) } },
    });
    await assert.rejects(
      exportBackupFile(() => ({})),
      { message: i18n.t("shell:exportFailed") },
    );
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { paintVaultDesktop: { saveBackup: async () => false } },
    });
    assert.equal(await exportBackupFile(() => ({})), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

void test("image preprocessing/rotation hide native decode and network diagnostics", async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "createImageBitmap");
  Object.defineProperty(globalThis, "createImageBitmap", {
    configurable: true,
    value: () => Promise.reject(new Error("private image decoder diagnostic")),
  });
  try {
    const image = new File(["not an image"], "photo.webp");
    await assert.rejects(preprocessImage(image), (error: unknown) => {
      assert.ok(error instanceof PublicError);
      assert.equal(error.message, i18n.t("components:couldNotImportThatImage"));
      return true;
    });
    await assert.rejects(rotateImage(image), { message: i18n.t("components:couldNotRotatePhoto") });
    t.mock.method(globalThis, "fetch", () => Promise.reject(new TypeError("Failed to fetch private-host")));
    await assert.rejects(rotateImage("/api/images/photo"), {
      message: i18n.t("components:couldNotRotatePhoto"),
    });
  } finally {
    if (previous) Object.defineProperty(globalThis, "createImageBitmap", previous);
    else Reflect.deleteProperty(globalThis, "createImageBitmap");
  }
});
