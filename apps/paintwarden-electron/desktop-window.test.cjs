const assert = require("node:assert/strict");
const { test } = require("node:test");
const { windowOptions, windowState, titleBarDoubleClick } = require("./desktop-window.cjs");
const colors = require("../../packages/vault-ui/src/dom/theme-shell.json");

test("native shell uses exactly the shared theme colors on every platform", () => {
  for (const platform of ["darwin", "win32", "linux"]) {
    const options = windowOptions(platform);
    assert.equal(options.backgroundColor, colors.canvas);
    assert.equal(options.titleBarStyle, "hidden");
    if (platform === "darwin") {
      assert.deepEqual(options.trafficLightPosition, { x: 7, y: 7 });
      assert.equal(options.vibrancy, undefined);
      assert.equal(options.titleBarOverlay, undefined);
    } else {
      assert.deepEqual(options.titleBarOverlay, {
        color: colors.canvas,
        symbolColor: colors.inkSoft,
        height: 28,
      });
    }
  }
});

test("title double click follows macOS preference, including None and restored zoom", () => {
  for (const [action, maximized, expected] of [
    ["Minimize", false, "minimize"],
    ["None", false, undefined],
    ["Maximize", false, "maximize"],
    ["Maximize", true, "unmaximize"],
    ["", false, "maximize"],
  ]) {
    const calls = [];
    const window = { isMaximized: () => maximized };
    for (const method of ["minimize", "maximize", "unmaximize"]) window[method] = () => calls.push(method);
    titleBarDoubleClick(window, {
      getUserDefault: (key, type) => {
        assert.equal(key, "AppleActionOnDoubleClick");
        assert.equal(type, "string");
        return action;
      },
    });
    assert.deepEqual(calls, expected ? [expected] : []);
  }
});

test("focus and fullscreen state comes from the native window", () => {
  assert.deepEqual(windowState({ isFocused: () => false, isFullScreen: () => true }), {
    focused: false,
    fullScreen: true,
  });
});
