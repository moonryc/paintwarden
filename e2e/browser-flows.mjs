import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { unzipSync } from "fflate";
import { expect as playwrightExpect } from "playwright/test";
import sharp from "sharp";

import { checkScanAggregateFixture } from "./scan-aggregate.mjs";
import { checkSchemeRanking } from "./scheme-ranking.mjs";

const expect = playwrightExpect.configure({ timeout: 12_000 });
const username = "browser-fixture-owner";
const password = "Synthetic-browser-only-password-42";
const parentFolder = "Synthetic project";
const childFolder = "Synthetic nested folder";
const photoMiniature = "Synthetic photo scout";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const openFolder = (page, name) => page.getByTitle(`Open ${name}`, { exact: true });
// Read-only folder grids intentionally hide action menus; observe the miniature itself.
const miniatureTile = (page, name) => page.getByText(name, { exact: true });

async function authenticate(page, setup) {
  await page.goto("/");
  await expect(page).toHaveTitle("Paintwarden");
  await page.getByRole("textbox", { name: "Username", exact: true }).fill(username);
  await page.locator(`input[autocomplete="${setup ? "new-password" : "current-password"}"]`).fill(password);
  await page.getByRole("button", { name: setup ? "Create account" : "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: "Workbench", exact: true, level: 1 }).waitFor();
  await page.waitForFunction(() => window.__browserE2E.events.length > 0);
}

async function folderView(page) {
  const button = page.getByRole("button", { name: "Folder view", exact: true });
  if ((await button.getAttribute("aria-pressed")) !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

async function addChoice(page, choice) {
  await page.getByRole("button", { name: "Add miniature", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Add a miniature", exact: true })
    .getByRole("button", { name: choice, exact: true })
    .click();
}

async function createFolder(page, name) {
  await addChoice(page, "Folder");
  const dialog = page.getByRole("dialog", { name: "Create folder", exact: true });
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/graphql") &&
      response.request().postDataJSON()?.operationName === "CreateBrowserFolder",
  );
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  const body = await (await saved).json();
  await dialog.waitFor({ state: "hidden" });
  await openFolder(page, name).waitFor();
  return body.data.createFolder.revision;
}

async function createMiniature(page, name, photo) {
  await addChoice(page, "Miniature");
  const dialog = page.getByRole("dialog", { name: "Add a miniature", exact: true });
  await dialog.getByRole("textbox", { name: /^Name/ }).fill(name);
  if (photo) await dialog.locator("input[type=file]").setInputFiles(photo);
  const saved = page.waitForResponse((response) => {
    if (!response.url().endsWith("/api/graphql")) return false;
    return response.request().postDataJSON()?.operationName === "CreateProjectMiniature";
  });
  await dialog.locator("button[type=submit]").click();
  const body = await (await saved).json();
  assert.equal(body.errors, undefined, "Miniature creation returned GraphQL errors");
  await dialog.waitFor({ state: "hidden" });
  // Creation opens the saved miniature drawer; await it before dismissing, not a sleep.
  await page.getByRole("button", { name: "Close project", exact: true }).click();
  await miniatureTile(page, name).waitFor();
  assert.ok(body.data.createMiniature.miniatureId, "Creation returned a miniature id");
  return body.data.createMiniature;
}

async function enterNestedFolder(page) {
  await folderView(page);
  await openFolder(page, parentFolder).click();
  await openFolder(page, childFolder).click();
  const breadcrumbs = page.getByRole("navigation", { name: "Folder navigation" });
  await expect(breadcrumbs).toContainText(parentFolder);
  await expect(breadcrumbs).toContainText(childFolder);
}

async function settings(page) {
  await page.getByRole("button", { name: /Data & settings/ }).click();
  await page.getByRole("heading", { name: "Data & settings", exact: true, level: 1 }).waitFor();
}

async function checkHelpAbout(page, artifacts) {
  const help = page.getByRole("region", { name: "Help & About", exact: true });
  const originalViewport = page.viewportSize();
  const noticesText = await readFile(new URL("../THIRD_PARTY_NOTICES.txt", import.meta.url), "utf8");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1050 });
    await expect(help.getByRole("button")).toHaveCount(7);
    await expect(help.getByText("Channel", { exact: true })).toHaveCount(0);
    await expect(help.getByText(/Paintwarden is independent/)).toHaveCount(0);
    await expect(help.getByRole("link")).toHaveCount(0);
    await help.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, `help-list-${width}.png`), animations: "disabled" });
    const aboutRow = help.getByRole("button", { name: /^About Paintwarden\b/ });
    await aboutRow.click();
    const about = page.getByRole("dialog", { name: "About Paintwarden", exact: true });
    await expect(about.getByText("Beta", { exact: true })).toBeVisible();
    await expect(about.getByText("Stable", { exact: true })).toHaveCount(0);
    await expect(
      about.getByRole("link", { name: "Beta tester guide (English)", exact: true }),
    ).toHaveAttribute("href", "https://github.com/moonryc/paintwarden/blob/main/docs/beta-testers.md");
    if (width < 600) await expect(about).toHaveClass(/MuiDialog-paperFullScreen/);
    else await expect(about).not.toHaveClass(/MuiDialog-paperFullScreen/);
    await page.screenshot({ path: path.join(artifacts, `help-about-${width}.png`), animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(about).toHaveCount(0);
    await expect(aboutRow).toBeFocused();
    const noticesRow = help.getByRole("button", { name: /^Open-source licenses\b/ });
    await noticesRow.click();
    const notices = page.getByRole("dialog", { name: "Open-source licenses", exact: true });
    const content = notices.getByRole("region", { name: "Open-source licenses", exact: true });
    await expect(content).toBeVisible();
    await expect(content).toHaveAttribute("lang", "en");
    assert.equal(
      await content.textContent(),
      noticesText,
      "Help opens the complete offline third-party notices",
    );
    await page.screenshot({
      path: path.join(artifacts, `help-notices-${width}.png`),
      animations: "disabled",
    });
    await notices.getByRole("button", { name: "Close", exact: true }).click();
    await expect(notices).toHaveCount(0);
    await expect(noticesRow).toBeFocused();
    await help.getByRole("button", { name: /^Privacy\b/ }).click();
    const privacy = page.getByRole("dialog", { name: "Privacy", exact: true });
    await expect(
      privacy.getByRole("link", { name: "Privacy and network activity (English)", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(artifacts, `help-privacy-${width}.png`),
      animations: "disabled",
    });
    await privacy.getByRole("button", { name: "Close", exact: true }).click();
    await expect(privacy).toHaveCount(0);
  }
  if (originalViewport) await page.setViewportSize(originalViewport);
}

async function workbench(page) {
  await page.getByRole("button", { name: "Workbench", exact: true }).click();
  await page.getByRole("heading", { name: "Workbench", exact: true, level: 1 }).waitFor();
}

function backupSnapshot(bytes) {
  const zip = unzipSync(bytes);
  assert.ok(zip["backup.json"], "Export contains backup.json");
  const manifest = JSON.parse(Buffer.from(zip["backup.json"]).toString("utf8"));
  assert.equal(manifest.format, "paintwarden-backup");
  assert.equal(manifest.version, 2);
  // Row order and export wall-clock time are not vault content. Every row field is compared.
  const tables = Object.fromEntries(
    Object.entries(manifest.tables)
      .sort()
      .map(([key, rows]) => [
        key,
        rows
          .map((row) => Object.fromEntries(Object.entries(row).sort()))
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      ]),
  );
  const images = Object.fromEntries(
    Object.entries(zip)
      .filter(([name]) => name.startsWith("images/") && !name.endsWith("/"))
      .map(([name, data]) => [name.slice("images/".length), sha256(data)])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  assert.deepEqual(
    Object.keys(images).sort(),
    [...manifest.images].sort(),
    "Manifest image references match ZIP entries",
  );
  assert.ok(
    Object.keys(images).every((name) => !name.includes(".thumb-")),
    "Derived thumbnails must not enter backups",
  );
  return { tables, images };
}

async function exportBackup(page, artifacts, name) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const file = await download;
  assert.equal(await file.failure(), null, "Backup download succeeded");
  const destination = path.join(artifacts, name);
  await file.saveAs(destination);
  return { file: destination, snapshot: backupSnapshot(await readFile(destination)) };
}

async function replaceBackup(page, file) {
  await page.locator('input[type=file][accept=".zip,application/zip"]').setInputFiles(file);
  const dialog = page.getByRole("dialog", { name: "Restore backup", exact: true });
  await dialog.getByRole("radio", { name: /^Replace this vault/ }).check();
  const restored = page.waitForResponse(
    (response) =>
      response.url().includes("/api/backup?mode=replace") && response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Replace vault", exact: true }).click();
  const response = await restored;
  assert.equal(response.status(), 200, "Replace restore succeeded");
  await dialog.waitFor({ state: "hidden" });
  await expect(page.getByText("Vault replaced from backup", { exact: true })).toBeVisible();
}

async function verifyThumbnail(page, id, expectedHash) {
  const image = page.locator(`img[src*="/api/miniatures/${id}/image"]`);
  await expect(image).toHaveCount(1);
  await image.scrollIntoViewIfNeeded();
  await page.waitForFunction((id) => {
    const image = document.querySelector(`img[src*="/api/miniatures/${id}/image"]`);
    return image?.complete && image.naturalWidth > 0;
  }, id);
  const currentSrc = await image.evaluate((image) => image.currentSrc);
  const url = new URL(currentSrc);
  const width = Number(url.searchParams.get("w"));
  assert.ok([160, 320, 640].includes(width), "Rendered tile selected a bounded thumbnail, not the original");
  assert.ok(url.searchParams.get("v"), "Thumbnail retains immutable photo version");
  const response = await page.request.get(currentSrc, { timeout: 12_000 });
  assert.equal(response.status(), 200);
  assert.match(response.headers()["content-type"], /^image\/webp/);
  const thumbnail = await sharp(await response.body()).metadata();
  assert.equal(thumbnail.format, "webp");
  assert.equal(thumbnail.width, width);
  assert.equal(thumbnail.height, (width * 3) / 4);
  url.searchParams.delete("w");
  const original = await page.request.get(url.href, { timeout: 12_000 });
  assert.equal(original.status(), 200);
  const originalBytes = await original.body();
  const originalMetadata = await sharp(originalBytes).metadata();
  assert.equal(originalMetadata.width, 1024);
  assert.equal(originalMetadata.height, 768);
  // The real browser upload intentionally preprocesses PNG into WebP. Check its pixels,
  // then use the stored original hash for exact backup/restore comparisons.
  const { channels } = await sharp(originalBytes).stats();
  for (const [index, expected] of [0x42, 0x7e, 0xa8].entries())
    assert.ok(Math.abs(channels[index].mean - expected) < 8, "Uploaded synthetic photo retained its color");
  const originalHash = sha256(originalBytes);
  if (expectedHash) assert.equal(originalHash, expectedHash, "Restored original photo is byte-exact");
  return { width: thumbnail.width, height: thumbnail.height, format: thumbnail.format, originalHash };
}

async function streamState(page) {
  return page.evaluate(() => ({
    ...window.__browserE2E,
    href: location.href,
    navigations: performance.getEntriesByType("navigation").length,
  }));
}

async function assertLiveUpdate(page, before, payload, name) {
  await miniatureTile(page, name).waitFor();
  await page.waitForFunction(
    ({ count, revision }) =>
      window.__browserE2E.events.slice(count).some((event) => {
        const change = event.data?.vaultChanges;
        return (
          change?.epoch === revision.epoch &&
          BigInt(change.seq) >= BigInt(revision.seq) &&
          change.families.includes("HOME")
        );
      }),
    { count: before.events.length, revision: payload.revision },
  );
  const after = await streamState(page);
  assert.equal(after.href, before.href, "Passive observer did not navigate/reload");
  assert.equal(after.navigations, before.navigations, "Passive observer kept its original document");
  assert.equal(
    after.recoveries,
    before.recoveries,
    "No polling/focus/access-recovery query substituted for SSE",
  );
  assert.equal(
    after.streams,
    before.streams,
    "Update used existing SSE, not a reconnect/access-recovery refresh",
  );
}

export async function runBrowserFlows({ newPage, artifacts, results }) {
  const check = (name) => {
    results.checks.push(`PASS ${name}`);
    console.log(`PASS ${name}`);
  };
  const first = await newPage();
  await authenticate(first, true);
  const manifest = await first.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    return (await fetch(link.href)).json();
  });
  assert.equal(manifest.name, "Paintwarden");
  assert.equal(manifest.short_name, "Paintwarden");
  await expect(first.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
    "content",
    "Paintwarden",
  );
  results.branding = { title: await first.title(), name: manifest.name, shortName: manifest.short_name };
  for (const width of [1440, 390]) {
    await first.setViewportSize({ width, height: 1000 });
    await expect(first.getByRole("heading", { name: "Workbench", exact: true, level: 1 })).toBeVisible();
    await first.screenshot({ path: path.join(artifacts, `paintwarden-brand-${width}.png`), fullPage: true });
  }
  await first.setViewportSize({ width: 1440, height: 1000 });
  check("browser title, installed app name and Apple app title are Paintwarden");
  const second = await newPage();
  assert.equal((await second.context().cookies()).length, 0, "Second browser context starts unauthenticated");
  await authenticate(second, false);
  const firstSession = (await first.context().cookies()).find((cookie) => cookie.name === "pv_session");
  const secondSession = (await second.context().cookies()).find((cookie) => cookie.name === "pv_session");
  assert.ok(firstSession && secondSession, "Both browser contexts have sessions");
  assert.ok(
    firstSession.value !== secondSession.value,
    "UI login issued independent sessions (not copied storage)",
  );
  check("owner signup and independent browser login");

  await folderView(first);
  await createFolder(first, parentFolder);
  await openFolder(first, parentFolder).click();
  const folderRevision = await createFolder(first, childFolder);
  await openFolder(first, childFolder).click();
  await expect(first.getByRole("navigation", { name: "Folder navigation" })).toContainText(childFolder);
  await enterNestedFolder(second);
  // Finish initial cursor catch-up before the passive-observer window begins.
  for (const page of [first, second])
    await page.waitForFunction(
      (revision) =>
        window.__browserE2E.events.some(
          (event) =>
            event.data?.vaultChanges?.epoch === revision.epoch &&
            BigInt(event.data.vaultChanges.seq) >= BigInt(revision.seq),
        ),
      folderRevision,
    );
  check("nested Folders UI creates and navigates parent/child hierarchy");

  // A generated, metadata-free synthetic fixture: no personal photo, network asset, or catalog.
  const photo = await sharp({ create: { width: 1024, height: 768, channels: 3, background: "#427ea8" } })
    .png()
    .toBuffer();
  await writeFile(path.join(artifacts, "synthetic-photo.png"), photo);
  const upload = { name: "synthetic-photo.png", mimeType: "image/png", buffer: photo };
  const beforeFirst = await streamState(first);
  const created = await createMiniature(second, photoMiniature, upload);
  await assertLiveUpdate(first, beforeFirst, created, photoMiniature);
  results.thumbnail = await verifyThumbnail(first, created.miniatureId);
  check("browser photo upload and rendered WebP thumbnail with verified synthetic original");
  check("SSE update between independent authenticated contexts without reload or network polling");
  await second.context().close();

  await settings(first);
  await first.getByRole("combobox", { name: "Language", exact: true }).click();
  await first.getByRole("option", { name: "Español", exact: true }).click();
  await first.getByRole("heading", { name: "Datos y ajustes", exact: true, level: 1 }).waitFor();
  await expect(first.getByRole("combobox", { name: "Idioma", exact: true })).toHaveText("Español");
  await first.getByRole("combobox", { name: "Idioma", exact: true }).click();
  await first.getByRole("option", { name: "English", exact: true }).click();
  await first.getByRole("heading", { name: "Data & settings", exact: true, level: 1 }).waitFor();
  check("language switch loads Spanish UI and returns to English");
  await checkHelpAbout(first, artifacts);
  check(
    "compact Help list opens Beta About and complete offline notices at desktop and phone widths with focus restoration",
  );

  const baseline = await exportBackup(first, artifacts, "baseline.zip");
  assert.equal(baseline.snapshot.tables.miniatures.length, 1);
  assert.equal(baseline.snapshot.tables.folders.length, 2);
  assert.equal(Object.keys(baseline.snapshot.images).length, 1);
  assert.equal(
    Object.values(baseline.snapshot.images)[0],
    results.thumbnail.originalHash,
    "Backup stores the uploaded original byte-exactly",
  );
  const nested = baseline.snapshot.tables.folders.find((folder) => folder.name === childFolder);
  const parent = baseline.snapshot.tables.folders.find((folder) => folder.name === parentFolder);
  assert.equal(nested.parentId, parent.id);
  assert.ok(
    baseline.snapshot.tables.miniatures.every((mini) => mini.folderId === nested.id),
    "UI-created miniature belongs to the nested folder",
  );
  check("browser backup export includes exact fixture rows, hierarchy and photo");

  await workbench(first);
  await enterNestedFolder(first);
  await first.getByText(photoMiniature, { exact: true }).click();
  await first.getByRole("button", { name: "Edit", exact: true }).click();
  const edit = first.getByRole("dialog", { name: "Edit miniature", exact: true });
  await edit.getByRole("button", { name: "Delete miniature", exact: true }).click();
  await edit.getByRole("button", { name: "Tap again to delete miniature", exact: true }).click();
  await expect(miniatureTile(first, photoMiniature)).toHaveCount(0);
  await createFolder(first, "Post-backup extra folder");
  const extraPhoto = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#b74a31" } })
    .png()
    .toBuffer();
  await createMiniature(first, "Post-backup extra miniature", {
    name: "extra.png",
    mimeType: "image/png",
    buffer: extraPhoto,
  });
  await settings(first);
  const changed = await exportBackup(first, artifacts, "changed.zip");
  assert.notDeepEqual(changed.snapshot.tables, baseline.snapshot.tables);
  assert.equal(
    changed.snapshot.tables.miniatures.some((mini) => mini.id === created.miniatureId),
    false,
  );
  assert.notDeepEqual(
    changed.snapshot.images,
    baseline.snapshot.images,
    "Deletion/new upload changes actual backup image payload",
  );

  for (let iteration = 1; iteration <= 2; iteration++) {
    await replaceBackup(first, baseline.file);
    const restored = await exportBackup(first, artifacts, `restored-${iteration}.zip`);
    assert.deepEqual(
      restored.snapshot,
      baseline.snapshot,
      `Replace ${iteration} restores every row field and image byte exactly; extras removed`,
    );
  }
  check("Replace restore twice reproduces all exported rows/images exactly and removes post-backup extras");

  await workbench(first);
  await enterNestedFolder(first);
  await miniatureTile(first, photoMiniature).waitFor();
  await expect(miniatureTile(first, "Post-backup extra miniature")).toHaveCount(0);
  await expect(openFolder(first, "Post-backup extra folder")).toHaveCount(0);
  await verifyThumbnail(first, created.miniatureId, results.thumbnail.originalHash);
  await first.screenshot({ path: path.join(artifacts, "success.png"), animations: "disabled" });
  check("restored nested folder navigation, miniature rows and regenerated thumbnail remain usable");
}

export async function runSchemeRankingFlows({ newPage, artifacts, results }) {
  const first = await newPage();
  await authenticate(first, true);
  const noPhotoTitle = "Synthetic model without a photo";
  await createMiniature(first, noPhotoTitle);
  await expect(first.getByText(`Added ${noPhotoTitle}`, { exact: true })).toBeHidden();
  for (const width of [1440, 390]) {
    // Switch presentation before opening: changing breakpoint with the drawer open
    // remounts its responsive host during screenshot scrolling.
    await first.setViewportSize({ width, height: 1050 });
    await first.getByText(noPhotoTitle, { exact: true }).click();
    const scan = first.getByRole("button", { name: "Swatch Scan Beta", exact: true });
    await expect(scan).toBeDisabled();
    await expect(scan).toHaveAccessibleDescription("Add a photo to this miniature to use Swatch Scan.");
    await expect(
      first.getByText("Add a photo to this miniature to use Swatch Scan.", { exact: true }),
    ).toBeVisible();
    await scan.scrollIntoViewIfNeeded();
    await first.screenshot({
      path: path.join(artifacts, `scan-zero-no-photo-${width}.png`),
      animations: "disabled",
    });
    await first.getByRole("button", { name: "Edit recipe", exact: true }).click();
    await expect(first.getByRole("button", { name: "Done", exact: true })).toBeVisible();
    await expect(first.getByRole("button", { name: /Swatch Scan/ })).toHaveCount(0);
    await first.getByRole("button", { name: "Done", exact: true }).click();
    await first.getByRole("button", { name: "Close project", exact: true }).click();
  }
  results.checks.push(
    "PASS no-photo zero-state scan is disabled with photo hint; recipe edit mode hides scan at desktop and phone widths",
  );
  await first.setViewportSize({ width: 1440, height: 1050 });
  const scanTitle = "Synthetic scan model";
  const scanPhoto = await sharp({ create: { width: 1024, height: 768, channels: 3, background: "#427ea8" } })
    .composite([
      {
        input: await sharp({ create: { width: 512, height: 768, channels: 3, background: "#b74a31" } })
          .png()
          .toBuffer(),
        left: 512,
        top: 0,
      },
    ])
    .png()
    .toBuffer();
  const scanModel = await createMiniature(first, scanTitle, {
    name: "scan.png",
    mimeType: "image/png",
    buffer: scanPhoto,
  });
  // Exercise zero-state and edit-mode entries before the real sampling/ranking flow.
  await expect(first.getByText(`Added ${scanTitle}`, { exact: true })).toBeHidden();
  const scanEntry = first.getByRole("button", { name: /Swatch Scan.*Beta/ });
  for (const width of [1440, 390]) {
    await first.setViewportSize({ width, height: 1050 });
    await first.getByText(scanTitle, { exact: true }).click();
    await expect(first.getByRole("button", { name: "Swatch Scan Beta", exact: true })).toBeEnabled();
    await expect(first.getByText("No paints assigned yet", { exact: true })).toBeVisible();
    await scanEntry.scrollIntoViewIfNeeded();
    await first.screenshot({
      path: path.join(artifacts, `scan-zero-photo-${width}.png`),
      animations: "disabled",
    });
    await scanEntry.click();
    const zeroScanDialog = first.getByRole("dialog", { name: "Swatch Scan", exact: true });
    await expect(zeroScanDialog.getByRole("button", { name: "Sample at crosshair" })).toBeEnabled();
    await zeroScanDialog.getByRole("button", { name: "Close", exact: true }).click();
    await first.getByRole("button", { name: "Edit recipe", exact: true }).click();
    await expect(scanEntry).toBeEnabled();
    await expect(scanEntry).toHaveText(/Swatch Scan.*Beta.*Find paints from your miniature/);
    assert.equal(
      await scanEntry.evaluate((entry) => {
        const recipe = entry.closest("section");
        const heading = recipe.querySelector("#paint-recipe-heading");
        const schemes = recipe.querySelector("#recipe-schemes-heading");
        const paints = recipe.querySelector("#recipe-paints-heading");
        return (
          Boolean(heading.compareDocumentPosition(entry) & Node.DOCUMENT_POSITION_FOLLOWING) &&
          Boolean(entry.compareDocumentPosition(schemes) & Node.DOCUMENT_POSITION_FOLLOWING) &&
          Boolean(schemes.compareDocumentPosition(paints) & Node.DOCUMENT_POSITION_FOLLOWING)
        );
      }),
      true,
      "scan row follows Paint recipe heading, before Color schemes and Paint steps",
    );
    await scanEntry.scrollIntoViewIfNeeded();
    await first.screenshot({
      path: path.join(artifacts, `scan-zero-edit-${width}.png`),
      animations: "disabled",
    });
    await scanEntry.click();
    const scanDialog = first.getByRole("dialog", { name: "Swatch Scan", exact: true });
    await expect(scanDialog.getByRole("button", { name: "Sample at crosshair" })).toBeEnabled();
    await scanDialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(scanEntry).toBeVisible();
    await first.getByRole("button", { name: "Done", exact: true }).click();
    await expect(first.getByRole("button", { name: "Swatch Scan Beta", exact: true })).toBeEnabled();
    await first.getByRole("button", { name: "Close project", exact: true }).click();
  }
  await first.setViewportSize({ width: 1440, height: 1050 });
  results.checks.push(
    "PASS uploaded-photo zero-state scan opens without editing; edit row opens and returns to zero-state button on Done",
  );
  await checkSchemeRanking({
    page: first,
    miniatureId: scanModel.miniatureId,
    title: scanTitle,
    artifacts,
    results,
  });
}

export async function runScanAggregateFlows({ newPage, artifacts, results }) {
  const page = await newPage();
  await authenticate(page, true);
  const title = "Synthetic aggregate scan model";
  const photo = await sharp({ create: { width: 1024, height: 768, channels: 3, background: "#427ea8" } })
    .composite([
      {
        input: await sharp({ create: { width: 512, height: 768, channels: 3, background: "#b74a31" } })
          .png()
          .toBuffer(),
        left: 512,
        top: 0,
      },
    ])
    .png()
    .toBuffer();
  const model = await createMiniature(page, title, {
    name: "aggregate.png",
    mimeType: "image/png",
    buffer: photo,
  });
  await checkScanAggregateFixture({ page, miniatureId: model.miniatureId, title, artifacts, results });
}
