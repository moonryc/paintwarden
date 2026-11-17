import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import shellColors from "../packages/vault-ui/src/dom/theme-shell.json" with { type: "json" };
import { expect } from "playwright/test";

export async function runTitleBarFlow(application, page, artifacts) {
  const result = {
    screenshots: [],
    pixels: [],
    limitations:
      "Hidden capturePage excludes native traffic-light pixels. Their native position is checked through BrowserWindow. Real pointer drag/OS zoom/fullscreen gestures require visible manual acceptance.",
  };
  const chrome = page.locator('div[aria-hidden="true"]').filter({ hasText: /^Paintwarden$/ });
  await expect(chrome).toHaveCount(1);
  const original = await application.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    return {
      size: window.getSize(),
      buttons: process.platform === "darwin" ? window.getWindowButtonPosition() : undefined,
      background: window.getBackgroundColor(),
      visible: window.isVisible(),
    };
  });
  assert.equal(original.visible, false);
  assert.equal(original.background.toLowerCase(), shellColors.canvas);
  if (process.platform === "darwin") assert.deepEqual(original.buttons, { x: 7, y: 7 });
  result.native = original;
  for (const width of [1440, 390]) {
    await application.evaluate(
      ({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 800),
      width,
    );
    await expect(chrome).toHaveCSS("height", "28px");
    await expect(chrome).toHaveCSS("-webkit-app-region", "drag");
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      width: document.documentElement.scrollWidth,
      background: getComputedStyle(document.body).backgroundColor,
      drawer: getComputedStyle(document.documentElement).getPropertyValue("--surface").trim(),
      inset: getComputedStyle(document.documentElement).getPropertyValue("--desktop-titlebar-height"),
    }));
    assert.ok(dimensions.width <= dimensions.viewport, "No document horizontal overflow");
    assert.equal(dimensions.inset, "28px");
    assert.equal(dimensions.drawer, shellColors.surface);
    await expect(chrome).toHaveCSS(
      "background-color",
      `rgb(${shellColors.surface
        .slice(1)
        .match(/../g)
        .map((hex) => parseInt(hex, 16))
        .join(", ")})`,
    );
    assert.equal(dimensions.background, "rgb(32, 32, 32)");
    const capture = await application.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      assertHidden();
      function assertHidden() {
        if (window.isVisible()) throw new Error("E2E window must stay hidden");
      }
      const image = await window.webContents.capturePage({
        x: 0,
        y: 0,
        width: window.getContentSize()[0],
        height: 110,
      });
      const bytes = image.toBitmap();
      const size = image.getSize();
      // Avoid native buttons, centered title and the rounded window corners.
      const pixels = [];
      for (const [x, y] of [
        [100, 5],
        [120, 12],
        [130, 24],
      ]) {
        const offset = (y * size.width + x) * 4;
        pixels.push([...bytes.subarray(offset, offset + 4)]);
      }
      return { png: image.toPNG().toString("base64"), size, pixels };
    });
    for (const pixel of capture.pixels)
      assert.deepEqual(
        pixel,
        [
          ...shellColors.surface
            .slice(1)
            .match(/../g)
            .map((hex) => parseInt(hex, 16))
            .reverse(),
          255,
        ],
        "Title strip pixels equal the drawer surface token exactly (BGRA)",
      );
    const screenshot = path.join(artifacts, `titlebar-after-${width}.png`);
    await writeFile(screenshot, Buffer.from(capture.png, "base64"));
    result.screenshots.push(screenshot);
    result.pixels.push({ width, pixels: capture.pixels, dimensions });
  }
  // Exercise state IPC without entering a Space or ordering a hidden test window
  // onscreen. Native zoom/minimize preference routing has separate unit tests.
  for (const fullScreen of [true, false]) {
    await application.evaluate(({ BrowserWindow }, fullScreen) => {
      const window = BrowserWindow.getAllWindows()[0];
      const original = window.isFullScreen;
      window.isFullScreen = () => fullScreen;
      window.emit(fullScreen ? "enter-full-screen" : "leave-full-screen");
      window.isFullScreen = original;
    }, fullScreen);
    await expect(chrome).toHaveCount(fullScreen ? 0 : 1);
    await expect(page.locator("html")).toHaveCSS("--desktop-titlebar-height", fullScreen ? "0px" : "28px");
  }
  for (const focused of [true, false]) {
    await application.evaluate(({ BrowserWindow }, focused) => {
      const window = BrowserWindow.getAllWindows()[0];
      const original = window.isFocused;
      window.isFocused = () => focused;
      window.emit(focused ? "focus" : "blur");
      window.isFocused = original;
    }, focused);
    await expect(chrome.locator("span")).toHaveCSS("opacity", focused ? "1" : "0.55");
  }
  await application.evaluate(
    ({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size),
    original.size,
  );
  return result;
}
