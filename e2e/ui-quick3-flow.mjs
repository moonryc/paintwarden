// Optional acceptance matrix: actual packaged renderer, throwaway native-smoke profile.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect } from "playwright/test";

export async function runQuick3Flow(application, page, artifacts) {
  const rows = [];
  const root = path.resolve(import.meta.dirname, "../packages/paint-i18n/locales");
  const setSize = async (width) => {
    await application.evaluate(
      ({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 900),
      width,
    );
    // Hidden native resize can leave media queries stale across a navigation;
    // keep the headless renderer viewport in sync with the real window bounds.
    await page.setViewportSize({ width, height: 900 });
  };
  for (const locale of [
    "en",
    "de",
    "es",
    "fr",
    "it",
    "ja",
    "ko",
    "nl",
    "pl",
    "pt-BR",
    "ru",
    "zh-Hans",
    "zh-Hant",
  ]) {
    const pages = JSON.parse(await readFile(path.join(root, locale, "pages.json")));
    const components = JSON.parse(await readFile(path.join(root, locale, "components.json")));
    const shell = JSON.parse(await readFile(path.join(root, locale, "shell.json")));
    const navigate = async (name) => {
      const target = page.getByRole("button", { name, exact: typeof name === "string" });
      // Hidden macOS windows occasionally retain narrow media-query state
      // across reloads even after their native bounds grow. Use the real menu.
      if (!(await target.isVisible()))
        await page.getByRole("button", { name: shell.openNavigation, exact: true }).click();
      await target.click();
    };
    await page.evaluate((locale) => window.paintwardenDesktop.setLanguage(locale), locale);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    for (const width of [1440, 390]) {
      await setSize(1440);
      await navigate(new RegExp(pages.layoutSettings));
      await setSize(width);
      const section = page.getByRole("region", { name: pages.settingsData, exact: true });
      await expect(section).toBeVisible();
      if (["en", "de", "ja"].includes(locale))
        await section.screenshot({ path: path.join(artifacts, `settings-after-${locale}-${width}.png`) });
      await setSize(1440);
      await navigate(pages.layoutMiniatures);
      await page.getByRole("button", { name: pages.folders.showFolders, exact: true }).click();
      await setSize(width);
      await page.getByRole("button", { name: components.addMiniature, exact: true }).click();
      let dialog = page.getByRole("dialog");
      const group = dialog.getByRole("group", { name: pages.folders.addChoice, exact: true });
      await expect(group.getByRole("button").nth(0)).toHaveText(pages.folders.folder);
      await expect(group.getByRole("button").nth(0)).toHaveAttribute("aria-pressed", "true");
      await expect(group.getByRole("button").nth(1)).toHaveText(pages.folders.miniature);
      await expect(page.locator(".MuiDialog-container")).toHaveCSS("opacity", "1");
      const before = await group.boundingBox();
      if (["en", "de", "ja"].includes(locale))
        await dialog.screenshot({ path: path.join(artifacts, `add-folder-after-${locale}-${width}.png`) });
      await group.getByRole("button").nth(1).click();
      dialog = page.getByRole("dialog");
      const switched = dialog.getByRole("group", { name: pages.folders.addChoice, exact: true });
      await expect(switched.getByRole("button").nth(1)).toBeFocused();
      const after = await switched.boundingBox();
      assert.ok(
        Math.abs(after.y - before.y) <= 1,
        `Stationary switch ${locale}/${width}: ${before.y}→${after.y}`,
      );
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.getByRole("button", { name: pages.folders.showFlat, exact: true }).click();
      await page.getByRole("button", { name: components.addMiniature, exact: true }).click();
      dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("group", { name: pages.folders.addChoice, exact: true })).toHaveCount(0);
      await expect(page.locator(".MuiDialog-container")).toHaveCSS("opacity", "1");
      if (["en", "de", "ja"].includes(locale))
        await dialog.screenshot({ path: path.join(artifacts, `add-flat-after-${locale}-${width}.png`) });
      const geometry = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.ok(geometry.scroll <= geometry.width, `No horizontal scroll ${locale}/${width}`);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      rows.push({ locale, width, switchY: before.y, switchedY: after.y, ...geometry });
    }
  }
  await page.evaluate(() => window.paintwardenDesktop.setLanguage("en"));
  await page.reload();
  await setSize(1280);
  const home = page.getByRole("button", { name: "Workbench", exact: true });
  if (!(await home.isVisible()))
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await home.click();
  await writeFile(path.join(artifacts, "ui-quick3-matrix.json"), JSON.stringify(rows, null, 2));
  return rows;
}
