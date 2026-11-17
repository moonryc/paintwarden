import assert from "node:assert/strict";
import path from "node:path";
import { expect } from "playwright/test";

/** Real create forms and one atomic delete command, in a disposable browser/native vault. */
export async function runFolderEditFlow({ page, artifacts, resize }) {
  const evidence = [];
  const setEdit = async (value) => {
    const edit = page.getByRole("button", { name: "Select items", exact: true });
    if ((await edit.getAttribute("aria-pressed")) !== String(value)) await edit.click();
    await expect(edit).toHaveAttribute("aria-pressed", String(value));
  };
  const assertFits = async () => {
    const fit = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map((node) => ({
        width: node.clientWidth,
        scroll: node.scrollWidth,
      })),
    }));
    assert.ok(fit.scroll <= fit.width, "No page horizontal overflow");
    for (const dialog of fit.dialogs)
      assert.ok(dialog.scroll <= dialog.width, "No modal horizontal overflow");
  };
  const navigate = async (name) => {
    const button = page.getByRole("button", { name, exact: true });
    if (!(await button.isVisible()))
      await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await button.click();
  };
  for (const width of [1440, 390]) {
    if (resize) await resize(width);
    else await page.setViewportSize({ width, height: 1000 });
    for (const kind of ["MINIATURE", "TEMPLATE"]) {
      await navigate(kind === "MINIATURE" ? "Workbench" : "Templates");
      const addName = kind === "MINIATURE" ? "Add miniature" : "Add template";
      const noun = kind === "MINIATURE" ? "miniatures" : "templates";
      await page.getByRole("button", { name: "Folder view", exact: true }).click();
      await setEdit(false);
      await expect(page.getByRole("button", { name: "Add folder", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: addName, exact: true })).toBeVisible();
      await setEdit(true);
      await expect(page.getByRole("button", { name: "Add folder", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Flat view", exact: true }).click();
      await expect(page.getByRole("button", { name: "Add folder", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Folder view", exact: true }).click();
      await page.getByRole("button", { name: "Add folder", exact: true }).click();
      const folderName = `Edit flow ${kind} ${width}`;
      const folder = page.getByRole("dialog", { name: "Create folder", exact: true });
      await expect(folder.getByRole("group")).toHaveCount(0);
      await folder.getByRole("textbox", { name: "Name", exact: true }).fill(folderName);
      await assertFits();
      await folder.getByRole("button", { name: "Save", exact: true }).click();
      await expect(folder).toHaveCount(0);
      await page.getByTitle(`Open ${folderName}`, { exact: true }).click();
      await expect(page.getByRole("navigation", { name: "Folder navigation" })).toContainText(folderName);
      await expect(page.getByRole("button", { name: "Add folder", exact: true })).toBeVisible();
      await page.screenshot({
        path: path.join(artifacts, `separate-add-${kind}-${width}.png`),
        animations: "disabled",
      });
      const names = [`Synthetic ${kind} scout ${width}`, `Synthetic ${kind} captain ${width}`];
      for (const name of names) {
        await page.getByRole("button", { name: addName, exact: true }).click();
        const form = page.getByRole("dialog", {
          name: kind === "MINIATURE" ? "Add a miniature" : "New template",
          exact: true,
        });
        await expect(form.getByRole("group", { name: "What would you like to add?" })).toHaveCount(0);
        await form.getByRole("textbox", { name: /^Name/ }).fill(name);
        await assertFits();
        if (kind === "MINIATURE") {
          await form.locator("button[type=submit]").click();
          await page.getByRole("button", { name: "Close project", exact: true }).click();
        } else await form.getByRole("button", { name: "Save template", exact: true }).click();
        await expect(form).toHaveCount(0);
        await expect(page.getByText(name, { exact: true })).toBeVisible();
      }
      await setEdit(true);
      for (const name of names)
        await page.getByRole("checkbox", { name: `Select ${name}`, exact: true }).check();
      await page.getByRole("button", { name: "Delete 2", exact: true }).click();
      let confirm = page.getByRole("dialog", { name: `Delete 2 ${noun}`, exact: true });
      await expect(confirm.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
      for (const name of names) await expect(confirm.getByText(name, { exact: true })).toBeVisible();
      await assertFits();
      await page.screenshot({
        path: path.join(artifacts, `bulk-delete-${kind}-${width}.png`),
        animations: "disabled",
      });
      // Default Enter cancels, preserving selection and both entities.
      await page.keyboard.press("Enter");
      await expect(confirm).toHaveCount(0);
      for (const name of names) await expect(page.getByText(name, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Delete 2", exact: true }).click();
      confirm = page.getByRole("dialog", { name: `Delete 2 ${noun}`, exact: true });
      const commands = [];
      const listener = (request) => {
        if (
          request.url().endsWith("/api/graphql") &&
          request.method() === "POST" &&
          request.postDataJSON()?.operationName === "DeleteBrowserFolderItems"
        )
          commands.push(request.postDataJSON());
      };
      page.on("request", listener);
      const response = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/graphql") &&
          response.request().postDataJSON()?.operationName === "DeleteBrowserFolderItems",
      );
      await confirm.getByRole("button", { name: `Delete 2 ${noun}`, exact: true }).click();
      const payload = await (await response).json();
      assert.equal(payload.errors, undefined);
      await expect(confirm).toHaveCount(0);
      page.off("request", listener);
      assert.equal(commands.length, 1, "Exactly one batched mutation");
      assert.equal(commands[0].variables.ids.length, 2);
      for (const name of names) await expect(page.getByText(name, { exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Select items", exact: true })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await expect(page.getByRole("button", { name: "Add folder", exact: true })).toHaveCount(0);
      await expect(page.getByText("Deleted 2 items", { exact: true })).toBeVisible();
      await assertFits();
      evidence.push({
        width,
        kind,
        mutation: commands[0],
        revision: payload.data.deleteFolderItems.revision,
      });
    }
  }
  if (resize) await resize(1440);
  else await page.setViewportSize({ width: 1440, height: 1000 });
  await navigate("Workbench");
  return evidence;
}
