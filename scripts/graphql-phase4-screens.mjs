import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fixtureCredentials } from "./smoke-library-native.mjs";

// Keep these stable: the host pre-populates NOT RUN rows before invoking us.
export const checklistNames = [
  "Paints search and inventory filter use bounded GraphQL reads",
  "Paint details and quantity persist after reopening",
  "Wishlist project search filters the shopping projection",
  "Wishlist show-all opens persisted project associations",
  "Wishlist bought quantity persists in the Paint library",
  "Wishlist independently written stock refreshes visibly over SSE",
  "Schemes search and category filter read server projections",
  "Scheme detail and edit persist after reopening",
  "New scheme saves a real paint recipe and reopens",
  "Templates search and detail read server projections",
  "Template edit persists after reopening",
  "New template saves a reusable recipe and reopens",
  "Settings sections and account edit cancellation are functional",
  "Settings sign-in setting saves reversibly and survives navigation",
  "Plugins controls and deferred sharing search work without remote installs",
  "Paint Tools comparison and recipe selection render real paints",
  "Phase4 screens remain snapshot-free and free of renderer or GraphQL errors",
];

const gql = (entries, field) => entries.filter((entry) => entry.data?.data?.[field] != null);
const lastData = (entries, field) => gql(entries, field).at(-1)?.data.data[field];
const exact = (name) => ({ name, exact: true });

export async function runPhase4Screens({
  page,
  recorder,
  evidenceDir,
  label = "browser",
  fixture,
  secondClientWrite,
  pass,
  check,
}) {
  assert.equal(typeof check, "function", "Host must provide an isolating check(name, fn) helper");
  assert.equal(typeof secondClientWrite, "function");
  assert.ok(fixture?.paintId && fixture?.phase4?.missingPaintId, "An isolated Phase4 fixture is required");
  // pass belongs to the host; only check may append success after our assertions return.
  void pass;
  const f = { ...fixture, ...fixture.phase4 };
  const initial = recorder.mark();
  const errorStart = recorder.errors.length;
  await mkdir(evidenceDir, { recursive: true });
  const screenshot = async (screen) => {
    const file = path.join(evidenceDir, `${label}-phase4-${screen}.png`);
    await page.screenshot({ path: file, animations: "disabled" });
    return file;
  };
  const closeDialogs = async () => {
    // Recover from a failed control before visiting the next screen. This never records a PASS.
    for (let i = 0; i < 6; i += 1) {
      const dialogs = page.getByRole("dialog");
      if (!(await dialogs.count())) break;
      const top = dialogs.last();
      const close = top.getByRole("button", exact("Close"));
      if (await close.count()) await close.first().click();
      else await page.keyboard.press("Escape");
      await top.waitFor({ state: "hidden", timeout: 3000 });
    }
  };
  const nav = async (name, heading = name) => {
    await closeDialogs();
    const button =
      name === "Data & settings"
        ? page.getByRole("button", { name: /Data & settings$/ })
        : ["Paints", "Wishlist"].includes(name)
          ? page.getByRole("button", { name: new RegExp(`^${escapeRegex(name)}(?:\\s|$)`) })
          : page.getByRole("button", exact(name));
    await button.first().click();
    await page.getByRole("heading", { ...exact(heading), level: 2 }).waitFor({ timeout: 30000 });
  };
  const select = async (scope, name, option) => {
    await scope.getByRole("combobox", exact(name)).click();
    await page.getByRole("option", typeof option === "string" ? exact(option) : { name: option }).click();
  };
  const choose = async (scope, name, query, option = query) => {
    await scope.getByRole("combobox", exact(name)).fill(query);
    await page
      .getByRole("option", { name: typeof option === "string" ? new RegExp(escapeRegex(option)) : option })
      .first()
      .click();
  };
  const close = async (dialog) => {
    await dialog.getByRole("button", exact("Close")).first().click();
    await dialog.waitFor({ state: "hidden" });
  };
  const quantity = (name) => page.getByRole("textbox", exact(`${name} quantity`));
  const waitQuantity = async (name, value) => {
    await page.waitForFunction(
      ({ name, value }) =>
        [...document.querySelectorAll("input[aria-label]")].some(
          (input) => input.getAttribute("aria-label") === `${name} quantity` && input.value === String(value),
        ),
      { name, value },
    );
    assert.equal(await quantity(name).first().inputValue(), String(value));
  };
  const librarySearch = async (name) => {
    await page.getByPlaceholder("Search brand, range, or paint…", { exact: true }).fill(name);
    await page.getByRole("list", exact("Paint library")).getByText(name, { exact: true }).waitFor();
  };
  const stockSaved = async (mark) =>
    recorder.waitFor((entries) => gql(entries, "setPaintStock").length > 0, mark);
  // Card accessible names include readiness/category/count text, not only their title.
  const schemeCard = (name) =>
    page.locator("button[data-scheme-index]").filter({ has: page.getByText(name, { exact: true }) });
  const templateCard = (name) =>
    page.locator("button[data-template-index]").filter({ has: page.getByText(name, { exact: true }) });
  const schemeSearch = async (name) => {
    await page.getByPlaceholder("Search schemes…", { exact: true }).fill(name);
    await schemeCard(name).waitFor();
  };
  const templateSearch = async (name) => {
    await page.getByPlaceholder("Search templates…", { exact: true }).fill(name);
    await templateCard(name).waitFor();
  };
  const openTemplate = async (name) => {
    await templateSearch(name);
    await templateCard(name).click();
    const dialog = page.getByRole("dialog", exact(name));
    await dialog.waitFor();
    return dialog;
  };
  const openScheme = async (name) => {
    await schemeSearch(name);
    await schemeCard(name).click();
    const dialog = page.getByRole("dialog", exact(name));
    await dialog.waitFor();
    return dialog;
  };

  await check(checklistNames[0], async () => {
    const mark = recorder.mark();
    await nav("Paints");
    await librarySearch(f.paintName);
    await recorder.waitFor(
      (entries) => gql(entries, "library").some((e) => e.body.variables.search === f.paintName),
      mark,
    );
    await select(page, "Inventory", /^Owned \(/);
    await recorder.waitFor(
      (entries) => gql(entries, "library").some((e) => e.body.variables.filter === "OWNED"),
      mark,
    );
    await page.getByRole("list", exact("Paint library")).getByText(f.paintName, { exact: true }).waitFor();
    await select(page, "Inventory", /^All \(/);
    const reads = gql(recorder.slice(mark), "library");
    assert.ok(reads.length && reads.every((e) => e.body.variables.first <= 100));
    return { paintId: f.paintId, screenshot: await screenshot("paints") };
  });

  await check(checklistNames[1], async () => {
    await nav("Paints");
    await librarySearch(f.paintName);
    const list = page.getByRole("list", exact("Paint library"));
    const before = Number(await quantity(f.paintName).inputValue());
    const mark = recorder.mark();
    await list.getByRole("button", exact(`Increase ${f.paintName} quantity`)).click();
    await stockSaved(mark);
    await waitQuantity(f.paintName, before + 1);
    await list
      .getByRole("button", { name: new RegExp(escapeRegex(f.paintName)) })
      .filter({ hasText: f.paintName })
      .first()
      .click();
    const dialog = page.getByRole("dialog", exact(f.paintName));
    await dialog.waitFor();
    await dialog.getByRole("group", exact(`State for ${f.paintName}`)).waitFor();
    await close(dialog);
    await nav("Wishlist");
    await nav("Paints");
    await librarySearch(f.paintName);
    await waitQuantity(f.paintName, before + 1);
    return {
      paintId: f.paintId,
      persistedQuantity: before + 1,
      screenshot: await screenshot("paint-detail-stock"),
    };
  });

  await check(checklistNames[2], async () => {
    await nav("Wishlist");
    const mark = recorder.mark();
    await choose(page, "Miniature", f.wishlistMiniatureTitle);
    await recorder.waitFor(
      (entries) =>
        gql(entries, "wishlist").some((e) => e.body.variables.miniatureId === f.wishlistMiniatureId),
      mark,
    );
    await page.getByRole("button", exact(`Mark ${f.missingPaintName} as bought`)).waitFor();
    const view = lastData(recorder.slice(mark), "wishlist");
    assert.ok(view.shopping.nodes.some((row) => row.paint.id === f.missingPaintId && row.projectCount >= 1));
    return {
      miniatureId: f.wishlistMiniatureId,
      paintId: f.missingPaintId,
      screenshot: await screenshot("wishlist-project-search"),
    };
  });

  await check(checklistNames[3], async () => {
    await nav("Wishlist");
    await choose(page, "Miniature", f.wishlistMiniatureTitle);
    const mark = recorder.mark();
    await page
      .getByRole("button", {
        name: new RegExp(`^View all \\d+ projects? for ${escapeRegex(f.missingPaintName)}$`),
      })
      .click();
    const dialog = page.getByRole("dialog", exact(`Projects using ${f.missingPaintName}`));
    await dialog.getByText(f.wishlistMiniatureTitle, { exact: true }).waitFor();
    await recorder.waitFor(
      (entries) =>
        gql(entries, "wishlistRelatedProjects").some((e) =>
          e.data.data.wishlistRelatedProjects.nodes.some((m) => m.id === f.wishlistMiniatureId),
        ),
      mark,
    );
    const file = await screenshot("wishlist-project-associations");
    await close(dialog);
    return { miniatureId: f.wishlistMiniatureId, screenshot: file };
  });

  await check(checklistNames[4], async () => {
    await nav("Wishlist");
    await choose(page, "Miniature", f.wishlistMiniatureTitle);
    const mark = recorder.mark();
    await page.getByRole("button", exact(`Mark ${f.missingPaintName} as bought`)).click();
    await stockSaved(mark);
    await waitQuantity(f.missingPaintName, 1);
    const quantityMark = recorder.mark();
    await page.getByRole("button", exact(`Increase ${f.missingPaintName} quantity`)).click();
    await stockSaved(quantityMark);
    await waitQuantity(f.missingPaintName, 2);
    const file = await screenshot("wishlist-bought-quantity");
    await nav("Paints");
    await librarySearch(f.missingPaintName);
    await waitQuantity(f.missingPaintName, 2);
    return { paintId: f.missingPaintId, persistedQuantity: 2, screenshot: file };
  });

  await check(checklistNames[5], async () => {
    await nav("Wishlist");
    assert.ok(
      recorder.requests.some((e) => e.path === "/api/graphql/stream" && e.status === 200),
      "Production SSE connection must be open",
    );
    // An independent process/HTTP client writes after navigation; no reload or UI mutation follows.
    const mark = recorder.mark();
    await secondClientWrite(f.missingPaintId, 0);
    await recorder.waitFor(
      (entries) =>
        gql(entries, "wishlist").some((e) =>
          e.data.data.wishlist.shopping.nodes.some(
            (row) => row.paint.id === f.missingPaintId && row.paint.inventory?.quantity === 0,
          ),
        ),
      mark,
    );
    await page.getByRole("button", exact(`Mark ${f.missingPaintName} as bought`)).waitFor();
    return {
      paintId: f.missingPaintId,
      independentlyWrittenQuantity: 0,
      noReload: true,
      screenshot: await screenshot("wishlist-independent-stock-sse"),
    };
  });

  await check(checklistNames[6], async () => {
    const mark = recorder.mark();
    await nav("Schemes");
    await schemeSearch(f.editableSchemeName);
    await select(page, "Color category", /^Blue \(/);
    await recorder.waitFor(
      (entries) =>
        gql(entries, "schemes").some(
          (e) => e.body.variables.search === f.editableSchemeName && e.body.variables.category === "BLUE",
        ),
      mark,
    );
    await schemeCard(f.editableSchemeName).waitFor();
    return { schemeId: f.editableSchemeId, category: "BLUE", screenshot: await screenshot("schemes") };
  });

  let editedSchemeName = f.editableSchemeName;
  await check(checklistNames[7], async () => {
    await nav("Schemes");
    const preview = await openScheme(f.editableSchemeName);
    await preview.getByText(f.paintName, { exact: true }).first().waitFor();
    await preview.getByRole("button", exact("Edit scheme")).click();
    const editor = page.getByRole("dialog", exact("Color schemes"));
    const name = `${f.editableSchemeName} saved`;
    await editor.getByRole("textbox", exact("Scheme name")).fill(name);
    const mark = recorder.mark();
    await editor.getByRole("button", exact("Save")).click();
    await recorder.waitFor(
      (entries) =>
        gql(entries, "updateScheme").some(
          (e) => e.body.variables.id === f.editableSchemeId && e.body.variables.input.name === name,
        ),
      mark,
    );
    await editor.waitFor({ state: "hidden" });
    const reopened = await openScheme(name);
    editedSchemeName = name;
    await reopened.getByText(f.paintName, { exact: true }).first().waitFor();
    const file = await screenshot("scheme-edited-reopened");
    await close(reopened);
    return { schemeId: f.editableSchemeId, persistedName: name, screenshot: file };
  });

  await check(checklistNames[8], async () => {
    await nav("Schemes");
    await page.getByRole("button", exact("New scheme")).click();
    const editor = page.getByRole("dialog", exact("Color schemes"));
    const name = `${fixture.phase4.prefix ?? "Phase4Probe"} created scheme`;
    await editor.getByRole("textbox", exact("Scheme name")).fill(name);
    await select(editor, "Color category", "Blue");
    await editor.getByRole("button", exact("Step")).click();
    const step = page.getByRole("dialog", exact("Add step"));
    await select(step, "Paint step", "BASECOAT");
    await step.getByRole("button", exact("Add step")).click();
    await editor.getByRole("button", exact("Add paint")).first().click();
    const add = page.getByRole("dialog", exact("Add paint"));
    await choose(add, "Add paint", f.paintName);
    await add.waitFor({ state: "hidden" });
    const mark = recorder.mark();
    await editor.getByRole("button", exact("Save")).click();
    await recorder.waitFor(
      (entries) =>
        gql(entries, "createScheme").some(
          (e) =>
            e.body.variables.input.name === name &&
            e.body.variables.input.entries.some((item) => item.paintId === f.paintId),
        ),
      mark,
    );
    await editor.waitFor({ state: "hidden" });
    const reopened = await openScheme(name);
    await reopened.getByText(f.paintName, { exact: true }).first().waitFor();
    const file = await screenshot("scheme-created-reopened");
    await close(reopened);
    return { persistedName: name, paintId: f.paintId, screenshot: file };
  });

  await check(checklistNames[9], async () => {
    const mark = recorder.mark();
    await nav("Templates", "Miniature templates");
    const dialog = await openTemplate(f.templateName);
    await dialog.getByText("1 schemes · 1 paints", { exact: true }).waitFor();
    await recorder.waitFor(
      (entries) =>
        gql(entries, "templates").some(
          (e) =>
            e.body.variables.search === f.templateName &&
            e.data.data.templates.templates.nodes.some((t) => t.id === f.templateId),
        ),
      mark,
    );
    const file = await screenshot("templates-detail");
    await close(dialog);
    return { templateId: f.templateId, screenshot: file };
  });

  await check(checklistNames[10], async () => {
    await nav("Templates", "Miniature templates");
    const detail = await openTemplate(f.templateName);
    await detail.getByRole("button", exact("Edit")).click();
    const editor = page.getByRole("dialog", exact("Edit template"));
    const manufacturer = "Phase4 saved manufacturer";
    await editor.getByRole("textbox", exact("Manufacturer")).fill(manufacturer);
    const mark = recorder.mark();
    await editor.getByRole("button", exact("Save template")).click();
    await recorder.waitFor(
      (entries) =>
        gql(entries, "updateTemplate").some(
          (e) => e.body.variables.id === f.templateId && e.body.variables.input.manufacturer === manufacturer,
        ),
      mark,
    );
    await editor.waitFor({ state: "hidden" });
    // Saving invalidates asynchronously. Wait for the committed summary, then
    // reopen from a fresh screen rather than capturing an old card's props.
    await recorder.waitFor(
      (entries) =>
        gql(entries, "templates").some((entry) =>
          entry.data.data.templates.templates.nodes.some(
            (node) => node.id === f.templateId && node.manufacturer === manufacturer,
          ),
        ),
      mark,
    );
    await nav("Schemes");
    await nav("Templates", "Miniature templates");
    const reopened = await openTemplate(f.templateName);
    await reopened.getByRole("button", exact("Edit")).click();
    await editor.getByRole("textbox", exact("Manufacturer")).waitFor();
    assert.equal(await editor.getByRole("textbox", exact("Manufacturer")).inputValue(), manufacturer);
    const file = await screenshot("template-edited-reopened");
    await editor.getByRole("button", exact("Cancel")).click();
    return { templateId: f.templateId, persistedManufacturer: manufacturer, screenshot: file };
  });

  await check(checklistNames[11], async () => {
    await nav("Templates", "Miniature templates");
    await page.getByRole("button", exact("New template")).click();
    const editor = page.getByRole("dialog", exact("New template"));
    const name = "Phase4Probe created reusable template";
    await editor.getByRole("textbox", { name: /^Name/ }).fill(name);
    await editor.getByRole("textbox", exact("Manufacturer")).fill("Phase4 maker");
    await editor.getByRole("textbox", exact("Faction")).fill("Phase4 faction");
    await choose(editor, "Schemes", editedSchemeName);
    await choose(editor, "Required paints", f.paintName);
    const mark = recorder.mark();
    await editor.getByRole("button", exact("Save template")).click();
    await recorder.waitFor(
      (entries) =>
        gql(entries, "createTemplate").some(
          (e) =>
            e.body.variables.input.name === name &&
            e.body.variables.input.schemeIds.includes(f.editableSchemeId) &&
            e.body.variables.input.paints.some((p) => p.paintId === f.paintId),
        ),
      mark,
    );
    await editor.waitFor({ state: "hidden" });
    const reopened = await openTemplate(name);
    await reopened.getByText("1 schemes · 1 paints", { exact: true }).waitFor();
    await reopened.getByRole("button", exact("Edit")).click();
    const edit = page.getByRole("dialog", exact("Edit template"));
    await edit.getByRole("textbox", exact("Manufacturer")).waitFor();
    assert.equal(await edit.getByRole("textbox", exact("Manufacturer")).inputValue(), "Phase4 maker");
    assert.equal(await edit.getByRole("textbox", exact("Faction")).inputValue(), "Phase4 faction");
    await edit.getByRole("textbox", exact(f.paintName)).waitFor();
    await edit.getByText(editedSchemeName, { exact: true }).waitFor();
    const file = await screenshot("template-created-reopened");
    await edit.getByRole("button", exact("Cancel")).click();
    return { persistedName: name, schemeId: f.editableSchemeId, paintId: f.paintId, screenshot: file };
  });

  await check(checklistNames[12], async () => {
    await nav("Data & settings", "Data & settings");
    for (const section of ["Connection", "Catalog", "Account and security", "Backups"]) {
      await page.getByRole("heading", exact(section)).waitFor();
    }
    await page.getByRole("button", exact("Change username")).click();
    const dialog = page.getByRole("dialog", exact("Change username"));
    await dialog.getByRole("textbox", { name: /^New username/ }).fill("x");
    await dialog.getByText("Use 2–64 characters", { exact: true }).waitFor();
    assert.equal(await dialog.getByRole("button", exact("Change username")).isEnabled(), false);
    await dialog.getByRole("button", exact("Cancel")).click();
    await page.getByRole("button", exact("Change username")).click();
    assert.equal(await dialog.getByRole("textbox", { name: /^New username/ }).inputValue(), "");
    await dialog.getByRole("button", exact("Cancel")).click();
    return {
      layout: "Sections, not tabs (current product UI)",
      ownerCredentialsUnchanged: true,
      screenshot: await screenshot("settings"),
    };
  });

  await check(checklistNames[13], async () => {
    await nav("Data & settings", "Data & settings");
    const toggle = page.getByRole("switch", exact("Require sign-in"));
    const before = await toggle.isChecked();
    const set = async (value) => {
      if ((await toggle.isChecked()) === value) return;
      await toggle.click();
      const dialog = page.getByRole("dialog", exact(value ? "Require sign-in?" : "Turn off sign-in?"));
      const password = dialog.getByLabel(/^Current password/);
      if (await password.count()) await password.fill(fixtureCredentials.password);
      const mark = recorder.mark();
      await dialog.getByRole("button", exact(value ? "Turn on" : "Turn off")).click();
      await dialog.waitFor({ state: "hidden" });
      await recorder.waitFor(
        (entries) =>
          entries.some((e) => e.path === "/api/auth/settings" && e.status === 200) ||
          gql(entries, "setSignInRequirement").length > 0,
        mark,
      );
      assert.equal(await toggle.isChecked(), value);
    };
    try {
      await set(!before);
      await nav("Paints");
      await nav("Data & settings", "Data & settings");
      assert.equal(await toggle.isChecked(), !before, "Saved setting must survive screen navigation");
    } finally {
      await closeDialogs();
      await nav("Data & settings", "Data & settings");
      await set(before);
    }
    return { restoredOriginalRequireSignIn: before, screenshot: await screenshot("settings-restored") };
  });

  await check(checklistNames[14], async () => {
    await nav("Data & settings", "Data & settings");
    const mark = recorder.mark();
    await page.getByRole("button", exact("Manage plugins")).click();
    const plugins = page.getByRole("dialog", exact("Plugins"));
    await plugins.getByRole("textbox", exact("GitHub repository")).waitFor();
    assert.equal(await plugins.getByRole("button", exact("Add plugin")).isEnabled(), false);
    await plugins.getByRole("textbox", exact("GitHub repository")).fill("example/local-only-control-probe");
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some(
        (b) => b.textContent.trim() === "Add plugin" && !b.disabled,
      ),
    );
    assert.equal(await plugins.getByRole("button", exact("Add plugin")).isEnabled(), true);
    await plugins.getByRole("textbox", exact("GitHub repository")).fill("");
    // Do not submit a repository or request remote updates. The shareable picker is local data.
    await plugins.getByRole("button", exact("Create plugin")).click();
    const create = page.getByRole("dialog", exact("Create plugin"));
    const search = create.getByRole("textbox", exact("Search items to include"));
    await search.fill(f.templateName);
    const item = create.getByRole("checkbox", exact(f.templateName));
    await item.waitFor();
    await recorder.waitFor(
      (entries) =>
        gql(entries, "sourceShareable").some((e) =>
          e.data.data.sourceShareable.templates.some((t) => t.id === f.templateId),
        ),
      mark,
    );
    await item.check();
    assert.equal(await item.isChecked(), true);
    await search.fill("phase4-definitely-no-matching-item");
    assert.equal(await create.getByRole("checkbox", exact(f.templateName)).count(), 0);
    await search.fill(f.templateName);
    assert.equal(await item.isChecked(), true, "Search must retain selected persisted content");
    await create.getByRole("textbox", exact("Plugin name")).fill("Phase4 local share probe");
    await create.getByRole("textbox", exact("Version")).fill("1.2.3");
    assert.equal(await create.getByRole("textbox", exact("Version")).inputValue(), "1.2.3");
    const file = await screenshot("plugins-local-search");
    await close(create);
    await close(plugins);
    return {
      templateId: f.templateId,
      selectedAfterSearch: true,
      repositoryFormSubmitted: false,
      remoteUpdateControlClicked: false,
      caveat:
        "Plugins currently performs automatic background version/update probes on opening; this check proves local controls/search only, not remote repository availability.",
      screenshot: file,
    };
  });

  await check(checklistNames[15], async () => {
    // Paint Tools is optional in some packages. A missing control is a real NOT RUN/failure,
    // never an empty success; the host can classify this check as unavailable.
    await nav("Paint Tools");
    const compare = page.getByRole("tabpanel", exact("Paint compare"));
    await choose(compare, "Paint", f.paintName);
    await compare.getByText(f.paintName, { exact: true }).first().waitFor();
    await page.getByRole("button", exact("Recipe converter")).click();
    const convert = page.getByRole("tabpanel", exact("Recipe converter"));
    await choose(convert, "Source scheme", editedSchemeName);
    await convert.getByRole("list", exact("Scheme paint conversions")).waitFor();
    await convert.getByText(f.paintName, { exact: true }).first().waitFor();
    return { paintId: f.paintId, schemeId: f.editableSchemeId, screenshot: await screenshot("paint-tools") };
  });

  await check(checklistNames[16], async () => {
    await closeDialogs();
    await recorder.settle();
    const entries = recorder.slice(initial);
    assert.equal(
      entries.filter((e) => e.path === "/api/state").length,
      0,
      "No Phase4 screen may initialize a legacy snapshot",
    );
    assert.deepEqual(
      entries
        .filter((e) => e.data?.errors?.length)
        .map((e) => ({ operation: e.body?.operationName, errors: e.data.errors })),
      [],
    );
    assert.deepEqual(recorder.errors.slice(errorStart), []);
    return {
      observedRequests: entries.length,
      legacySnapshotRequests: 0,
      rendererErrors: 0,
      graphqlErrors: 0,
    };
  });
  return {
    checks: [
      {
        name: "Plugins remote repository installation and update availability",
        status: "NOT RUN",
        evidence:
          "Deliberately no remote install/update controls clicked. Automatic Plugins background probes are product behavior, not evidence of successful remote availability.",
      },
    ],
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
