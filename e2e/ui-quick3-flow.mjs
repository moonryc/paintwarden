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
      await expect(page.getByRole("button", { name: pages.folders.addFolder, exact: true })).toHaveCount(0);
      const edit = page.getByRole("button", { name: pages.folders.selectItems, exact: true });
      await edit.click();
      await page.getByRole("button", { name: pages.folders.addFolder, exact: true }).click();
      let dialog = page.getByRole("dialog");
      await expect(dialog).toHaveAccessibleName(pages.folders.createFolder);
      await expect(page.locator(".MuiDialog-container")).toHaveCSS("opacity", "1");
      await dialog.screenshot({ path: path.join(artifacts, `add-folder-after-${locale}-${width}.png`) });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.getByRole("button", { name: components.addMiniature, exact: true }).click();
      dialog = page.getByRole("dialog");
      await expect(dialog).not.toHaveAccessibleName(pages.folders.createFolder);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.getByRole("button", { name: pages.folders.showFlat, exact: true }).click();
      await expect(page.getByRole("button", { name: pages.folders.addFolder, exact: true })).toHaveCount(0);
      await edit.click();
      const geometry = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.ok(geometry.scroll <= geometry.width, `No horizontal scroll ${locale}/${width}`);
      rows.push({ locale, width, ...geometry });
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
