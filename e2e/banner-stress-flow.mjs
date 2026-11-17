import assert from "node:assert/strict";

// Real controls + real production GraphQL, not mocked errors. Also runs without
// autocomplete-shift's debounce so the request budget cannot depend on a picker.
export async function runBannerStressFlow(page) {
  const started = Date.now();
  const originalViewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  const requests = [];
  const rendererErrors = [];
  const response = (reply) => {
    if (!reply.url().includes("/api/graphql")) return;
    requests.push({
      operation: reply.request().postDataJSON()?.operationName,
      status: reply.status(),
    });
  };
  const error = (cause) => rendererErrors.push(cause.message);
  page.on("response", response);
  page.on("pageerror", error);
  try {
    await page.getByRole("button", { name: "Add miniature", exact: true }).click();
    // Folder views start on Folder; flat views already show the miniature form.
    await page.getByRole("dialog").waitFor();
    const addChoice = page.getByRole("group", { name: "What would you like to add?", exact: true });
    if (await addChoice.count())
      await addChoice.getByRole("button", { name: "Miniature", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add a miniature", exact: true });
    const model = dialog.getByRole("combobox", { name: "Model", exact: true });
    await model.fill("");
    for (const term of [
      "Space Marine Intercessor Sergeant with a bolt rifle and chainsword",
      "Stormcast Eternal Liberator with warhammer and shield",
      "Aeldari Guardian Defender with shuriken catapult",
    ]) {
      await model.fill("");
      await model.pressSequentially(term, { delay: 5 });
    }
    await dialog.getByRole("button", { name: "Close", exact: true }).first().click();
    // Fast normal navigation exposed a second source: the old key={tab}
    // remounted the identical folder browser on every Home view change.
    for (let index = 0; index < 40; index++) {
      // Windows runners can start narrower than the permanent drawer. Exercise
      // that real navigation path on every platform, including a 390px phone.
      if (index === 20) await page.setViewportSize({ width: 390, height: 844 });
      const tab = index % 2 ? "Workbench" : "Miniatures";
      const menu = page.getByRole("button", { name: "Open navigation", exact: true });
      if (await menu.isVisible()) await menu.click();
      await page
        .getByRole("navigation", { name: "Primary", exact: true })
        .getByRole("button", { name: tab, exact: true })
        .click();
      await page.getByRole("heading", { name: tab, exact: true, level: 1 }).waitFor();
    }
    const beforeFocus = requests.filter((entry) => entry.operation === "VaultInvalidation").length;
    await page.evaluate(async () => {
      for (let index = 0; index < 20; index++) window.dispatchEvent(new Event("focus"));
      // A real round-trip lets pending focus handlers settle, without sleeps.
      await fetch("/api/auth/status");
    });
    const afterFocus = requests.filter((entry) => entry.operation === "VaultInvalidation").length;
    assert.ok(
      afterFocus - beforeFocus <= 1,
      "Focus storms must coalesce; healthy SSE needs no catch-up poll",
    );
    assert.deepEqual(
      requests.filter((entry) => entry.status >= 400),
      [],
      "Normal heavy use must not hit rate limits",
    );
    assert.deepEqual(rendererErrors, [], "Typing must not cause React errors");
    assert.equal(
      await page.getByText("The request could not be completed. Please try again.", { exact: true }).count(),
      0,
    );
    const folderReads = requests.filter((entry) => entry.operation === "BrowseFolders").length;
    assert.ok(folderReads <= 2, "Switching Home views must reuse the same folder projection");
    return {
      durationMs: Date.now() - started,
      operations: requests.length,
      operationsByName: Object.fromEntries(
        [...new Set(requests.map((entry) => entry.operation))].map((name) => [
          name,
          requests.filter((entry) => entry.operation === name).length,
        ]),
      ),
      focusCatchups: afterFocus - beforeFocus,
      rendererErrors,
    };
  } finally {
    await page.setViewportSize(originalViewport);
    page.off("response", response);
    page.off("pageerror", error);
  }
}
