import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export function sourceSnapshot() {
  const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const git = (...args) =>
    execFileSync("/usr/bin/git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 10000,
    });
  return {
    head: git("rev-parse", "HEAD").trim(),
    trackedStatus: git("status", "--short", "--untracked-files=no").trim(),
    trackedDiffSha256: createHash("sha256")
      .update(git("diff", "--binary", "HEAD"))
      .digest("hex"),
  };
}

export const miniatureReads = (entries) =>
  entries.filter((entry) => entry.data?.data?.home || entry.data?.data?.miniatures);
export const miniatureView = (entry) => entry.data.data.home ?? entry.data.data.miniatures;
const frame = (page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const count = async (list, attr = "data-loaded-count") => Number(await list.getAttribute(attr));
const noState = (entries) =>
  assert.equal(
    entries.filter((entry) => entry.path === "/api/state").length,
    0,
    "Migrated Home/Miniatures must never initialize the legacy snapshot",
  );
const hasGraphqlErrors = (entries) => entries.filter((entry) => entry.data?.errors?.length);

// Attach retained attachLibraryRecorder BEFORE chooser/owner setup. All setup
// traffic stays in raw evidence; timings below start at a clean default document.
export async function runHomeMiniaturesScenario({
  page,
  recorder,
  evidenceDir,
  label = "browser",
  initialNavigate = () => page.reload(),
  secondClientWrite,
  fixture,
}) {
  assert.ok(fixture?.miniatureId && fixture?.paintId, "An isolated Phase3 fixture is required");
  assert.equal(typeof secondClientWrite, "function");
  await mkdir(evidenceDir, { recursive: true });
  const checks = [],
    metrics = {};
  recorder.scenario = { checks, metrics };
  const pass = (name, evidence) => {
    checks.push({ status: "PASS", name, evidence });
    console.log("PASS", label, name);
  };
  const initial = recorder.mark();
  const start = performance.now();
  await initialNavigate();
  await page.getByRole("heading", { name: "Workbench", exact: true, level: 2 }).waitFor({ timeout: 30000 });
  const shelf = page.getByRole("list", { name: "Miniature shelf", exact: true });
  await shelf.waitFor({ timeout: 30000 });
  await recorder.waitFor((entries) => miniatureReads(entries).some((entry) => entry.data.data.home), initial);
  await frame(page);
  await recorder.settle();
  const first = recorder.slice(initial);
  noState(first);
  const reads = miniatureReads(first);
  assert.ok(reads.length && reads.every((entry) => entry.body.variables.first <= 100));
  assert.ok((await count(shelf)) > 0 && (await count(shelf)) <= 100);
  assert.ok(
    recorder.requests.some((entry) => entry.path === "/api/graphql/stream"),
    "Production SSE must connect",
  );
  metrics.defaultHome = {
    elapsedToPaintMs: performance.now() - start,
    loaded: await count(shelf),
    total: await count(shelf, "data-total-count"),
    projectionBytes: reads.reduce((sum, entry) => sum + entry.bytes, 0),
    completedApiBytes: first.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0),
    api: first.map(({ path, bytes, durationMs, body }) => ({
      path,
      bytes,
      durationMs,
      operationName: body?.operationName,
    })),
    method:
      "Single fresh default-document observation; production JSON bytes, navigation/render/harness time. Excludes streamed SSE bytes and JS/CSS/fonts. Not a percentile or Phase0 speedup.",
  };
  pass("Default Home first page is bounded, rendered and snapshot-free", metrics.defaultHome);
  await page.screenshot({ path: path.join(evidenceDir, `${label}-home.png`), animations: "disabled" });

  const filterMark = recorder.mark();
  await page.getByRole("combobox", { name: "Step", exact: true }).click();
  await page.getByRole("option", { name: /^Complete \(/ }).click();
  await recorder.waitFor(
    (entries) => miniatureReads(entries).some((entry) => entry.body.variables.stage === "COMPLETE"),
    filterMark,
  );
  await page.getByRole("combobox", { name: "Step", exact: true }).click();
  await page.getByRole("option", { name: /^All \(/ }).click();
  pass("Home painting-stage filter reads a server-filtered projection");

  // Two complete loaded pages, same-revision refresh, independent-client stock readiness.
  const search = page.getByPlaceholder("Search miniatures…", { exact: true });
  await search.fill(fixture.prefix);
  await recorder.waitFor(
    (entries) => miniatureReads(entries).some((entry) => entry.body.variables.search === fixture.prefix),
    filterMark,
  );
  await page.getByRole("button", { name: "Load more miniatures", exact: true }).click();
  await page.waitForFunction(
    () =>
      Number(document.querySelector('[aria-label="Miniature shelf"]')?.getAttribute("data-loaded-count")) >=
      96,
  );
  await page.evaluate(() => window.scrollTo(0, 1000));
  await frame(page);
  await page.waitForFunction(
    () => document.querySelector('[aria-label="Miniature shelf"]')?.getAttribute("aria-busy") === "false",
  );
  await recorder.settle();
  await frame(page);
  // Clicking the bottom Load more control can also trigger viewport prefetch.
  // Capture the actual idle loaded window AFTER scrolling, not before.
  const loadedWindow = await count(shelf);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const updateMark = recorder.mark(),
    updateStart = performance.now();
  await secondClientWrite(fixture.paintId, 0);
  await recorder.waitFor(
    (entries) =>
      miniatureReads(entries).some((entry) => {
        const view = miniatureView(entry);
        return (
          view.miniatures.nodes.some(
            (node) => node.id === fixture.miniatureId && node.readiness.missing === 1,
          ) &&
          miniatureReads(entries).filter(
            (candidate) =>
              JSON.stringify(miniatureView(candidate).revision) === JSON.stringify(view.revision),
          ).length >= Math.ceil(loadedWindow / 48)
        );
      }),
    updateMark,
  );
  await page.waitForFunction(
    (loaded) =>
      Number(document.querySelector('[aria-label="Miniature shelf"]')?.getAttribute("data-loaded-count")) ===
      loaded,
    loadedWindow,
  );
  await frame(page);
  assert.equal(await page.evaluate(() => window.scrollY), scrollBefore, "SSE retains scroll");
  const refresh = miniatureReads(recorder.slice(updateMark));
  const revision = miniatureView(refresh.at(-1)).revision;
  const coherent = refresh.filter(
    (entry) => JSON.stringify(miniatureView(entry).revision) === JSON.stringify(revision),
  );
  assert.ok(coherent.length >= Math.ceil(loadedWindow / 48), "All loaded pages refresh to one revision");
  metrics.secondClientReadinessMs = performance.now() - updateStart;
  metrics.loadedWindowRefreshBytes = coherent.reduce((sum, entry) => sum + entry.bytes, 0);
  pass("Independent stock command updates Home readiness across the loaded window via SSE", {
    loadedWindow,
    revision,
    scrollBefore,
    elapsedMs: metrics.secondClientReadinessMs,
    responseBytes: metrics.loadedWindowRefreshBytes,
  });
  const restoreMark = recorder.mark();
  await secondClientWrite(fixture.paintId, 2);
  await recorder.waitFor(
    (entries) =>
      miniatureReads(entries).some((entry) =>
        miniatureView(entry).miniatures.nodes.some(
          (node) => node.id === fixture.miniatureId && node.readiness.missing === 0,
        ),
      ),
    restoreMark,
  );

  await page.getByRole("button", { name: "Miniatures", exact: true }).first().click();
  await page.getByRole("heading", { name: "Miniatures", exact: true, level: 2 }).waitFor();
  const collectionMark = recorder.mark();
  await page.getByRole("combobox", { name: "Collection", exact: true }).click();
  await page.getByRole("option", { name: /^Wishlist \(/ }).click();
  await recorder.waitFor(
    (entries) =>
      miniatureReads(entries).some(
        (entry) =>
          entry.body.variables.ownership === "WISHLIST" &&
          miniatureView(entry).miniatures.nodes.every((node) => node.status === "WISHLIST"),
      ),
    collectionMark,
  );
  await page.getByRole("combobox", { name: "Collection", exact: true }).click();
  await page.getByRole("option", { name: /^All \(/ }).click();
  const collectionSearch = page.getByPlaceholder("Search miniatures…", { exact: true });
  const searchMark = recorder.mark();
  await collectionSearch.fill(fixture.prefix);
  await recorder.waitFor(
    (entries) =>
      miniatureReads(entries).some(
        (entry) => entry.body.variables.search === fixture.prefix && !entry.body.variables.workbench,
      ),
    searchMark,
  );
  pass("Miniatures collection filter and fuzzy search remain server-projected");

  // Page beyond the historical five-page boundary, then scroll to the last item.
  let pages = 1;
  while ((await count(shelf)) < (await count(shelf, "data-total-count"))) {
    assert.ok(pages++ < 80, "Fixture search unexpectedly exceeds 80 pages");
    const before = await count(shelf);
    // Auto-prefetch can finish after the loop condition but before this observation.
    if (before >= (await count(shelf, "data-total-count"))) break;
    try {
      await page.getByRole("button", { name: "Load more miniatures", exact: true }).click({ timeout: 5000 });
    } catch (error) {
      // Scrolling the control into view can itself finish viewport prefetch and
      // remove the last-page button. Accept only independently observed progress.
      const loaded = await count(shelf);
      if (loaded >= (await count(shelf, "data-total-count"))) break;
      if (loaded <= before) throw error;
    }
    await page.waitForFunction(
      (before) =>
        Number(document.querySelector('[aria-label="Miniature shelf"]')?.getAttribute("data-loaded-count")) >
        before,
      before,
    );
  }
  assert.ok((await count(shelf)) > 240, "More than five pages must load");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const finalTile = page.locator("[data-miniature-index]").filter({ hasText: fixture.finalTitle });
  await finalTile.getByRole("button").first().waitFor();
  const rendered = await page.locator("[data-miniature-index]").count();
  assert.ok(rendered < 100 && rendered < (await count(shelf)), "DOM stays viewport-bounded");
  await page.screenshot({ path: path.join(evidenceDir, `${label}-final-item.png`), animations: "disabled" });
  pass("Virtualized Miniatures reaches the final item beyond five pages with bounded DOM", {
    pages,
    loaded: await count(shelf),
    rendered,
    finalTitle: fixture.finalTitle,
  });

  // Programmatic focus only on a NON-TEXT tile button: exercise the virtual
  // boundary handoff, reverse Tab and Return activation, never auto-focus inputs.
  await page.evaluate(() => window.scrollTo(0, 0));
  await frame(page);
  const boundary = await page.evaluate(() => {
    const items = [...document.querySelectorAll("[data-miniature-index]")];
    const tile = items.at(-1),
      button = tile.querySelector("button");
    button.focus({ preventScroll: true });
    return Number(tile.getAttribute("data-miniature-index"));
  });
  await page.keyboard.press("Tab");
  await page.waitForFunction(
    (index) =>
      Number(
        document.activeElement?.closest("[data-miniature-index]")?.getAttribute("data-miniature-index"),
      ) ===
      index + 1,
    boundary,
  );
  await page.keyboard.press("Shift+Tab");
  await page.waitForFunction(
    (index) =>
      Number(
        document.activeElement?.closest("[data-miniature-index]")?.getAttribute("data-miniature-index"),
      ) === index,
    boundary,
  );
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Close project", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Close project", exact: true }).waitFor({ state: "hidden" });
  pass("Keyboard Tab/Shift+Tab crosses virtual boundary; Return opens and Escape dismisses project", {
    boundary,
  });

  const open = async (title) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await collectionSearch.fill(title);
    const tile = page.locator("[data-miniature-index]").filter({ hasText: title });
    await tile.getByRole("button").first().click();
    await page.getByRole("button", { name: "Close project", exact: true }).waitFor();
  };
  await open(fixture.miniatureTitle);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Edit miniature", exact: true });
  await edit.getByRole("textbox", { name: /^Notes/ }).fill("Phase3 smoke saved notes");
  await edit.getByRole("button", { name: /Save changes|Save miniature|^Save$/ }).click();
  await edit.waitFor({ state: "hidden" });
  await page.getByText("Phase3 smoke saved notes", { exact: true }).waitFor();
  await page.getByRole("tab", { name: /Complete$/ }).click();
  await page.getByRole("tab", { name: /Complete$/ }).waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('button[aria-current="step"]')].some((button) =>
      button.textContent.includes("Complete"),
    ),
  );
  await page.getByRole("button", { name: "Close project", exact: true }).click();
  await open(fixture.miniatureTitle);
  await page.getByText("Phase3 smoke saved notes", { exact: true }).waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('button[aria-current="step"]')].some((button) =>
      button.textContent.includes("Complete"),
    ),
  );
  pass("Miniature details edit and painting status persist after reopening");

  await page.getByRole("button", { name: "Edit recipe", exact: true }).click();
  await page.getByRole("button", { name: "Add Scheme", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Color schemes", exact: true });
  await picker.getByRole("textbox", { name: "Search color schemes", exact: true }).fill(fixture.schemeName);
  await picker.getByRole("button", { name: fixture.schemeName, exact: true }).click();
  await picker.getByRole("button", { name: "Add scheme", exact: true }).click();
  await picker.waitFor({ state: "hidden" });
  const remove = page.getByRole("button", {
    name: `Remove ${fixture.schemeName} from miniature`,
    exact: true,
  });
  await remove.waitFor();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Close project", exact: true }).click();
  await open(fixture.miniatureTitle);
  await page.getByRole("button", { name: "Edit recipe", exact: true }).click();
  await remove.waitFor();
  await remove.click();
  await remove.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Close project", exact: true }).click();
  await open(fixture.miniatureTitle);
  assert.equal(await page.getByText(fixture.schemeName, { exact: true }).count(), 0);
  pass("Scheme attach and detach persist after reopening the miniature");
  await page.getByRole("button", { name: "Close project", exact: true }).click();

  await open(fixture.brokenMiniatureTitle);
  await page.getByRole("button", { name: /1 paint needs attention/ }).click();
  const broken = page.getByText("Broken substitution", { exact: true }).first();
  await broken.waitFor();
  await page
    .getByText("Fix broken substitutions; buying the original paint won’t repair them.", { exact: true })
    .waitFor();
  const color = await broken.evaluate((element) => getComputedStyle(element).color);
  // Theme rust/red must not become neutral gray or a readiness-success green.
  const rgb = color.match(/[\d.]+/g)?.map(Number);
  assert.ok(rgb && rgb[0] > rgb[1] && rgb[0] > rgb[2], `Broken indicator must be red/rust, got ${color}`);
  await page.screenshot({
    path: path.join(evidenceDir, `${label}-broken-project.png`),
    animations: "disabled",
  });
  pass("Physically owned original with an empty active recipe remains red/broken", {
    physicalQuantity: 2,
    color,
    paintId: fixture.brokenPaintId,
  });
  await page.getByRole("button", { name: "Close project", exact: true }).click();
  await recorder.settle();
  noState(recorder.slice(initial));
  assert.deepEqual(
    hasGraphqlErrors(recorder.slice(initial)),
    [],
    "No GraphQL errors in successful interaction",
  );
  assert.deepEqual(recorder.errors, [], "No renderer exceptions");
  pass("All migrated interactions remain snapshot-free with no renderer/GraphQL errors");
  await writeFile(
    path.join(evidenceDir, `${label}-scenario.json`),
    JSON.stringify({ checks, metrics }, null, 2) + "\n",
  );
  return { checks, metrics };
}
