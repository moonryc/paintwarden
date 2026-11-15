// Real UI flow shared by production Chromium and the packaged Electron renderer.
// Only observes real HTTP/SSE; never injects application state or changes server timing.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect as playwrightExpect } from "playwright/test";
const expect = playwrightExpect.configure({ timeout: 20_000 });

export function observePluginStreams() {
  if (window.__pluginFlow) return;
  const state = (window.__pluginFlow = { jobs: [], changes: [], accepted: [], errors: [] });
  const original = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const request = args[0];
    const url = new URL(request instanceof Request ? request.url : String(request), location.href);
    const response = await original(...args);
    const method = request instanceof Request ? request.method : args[1]?.method;
    if (url.pathname === "/api/catalog-sources" && method === "POST") {
      void response
        .clone()
        .json()
        .then((body) => state.accepted.push({ status: response.status, ...body }));
    }
    if (url.pathname !== "/api/graphql/stream" || !response.ok) return response;
    const reader = response.clone().body.getReader();
    void (async () => {
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) return;
          buffer += decoder.decode(value, { stream: true });
          let boundary;
          while ((boundary = buffer.indexOf("\n\n")) >= 0) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            if (!block.includes("event: next")) continue;
            const json = block
              .split("\n")
              .find((line) => line.startsWith("data:"))
              ?.slice(5)
              .trim();
            if (!json) continue;
            const item = JSON.parse(json);
            if (item.data?.pluginInstallProgress) state.jobs.push(item.data.pluginInstallProgress);
            if (item.data?.vaultChanges) state.changes.push(item.data.vaultChanges);
            if (item.errors) state.errors.push(...item.errors);
          }
        }
      } catch {
        /* navigation/closing cancels these independent observation readers */
      }
    })();
    return response;
  };
}

export async function authenticatePluginFixture(
  page,
  { setup = false, username = "plugin-fixture-owner", password = "Synthetic-plugin-only-password-42" } = {},
) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Username", exact: true }).fill(username);
  await page.locator(`input[autocomplete="${setup ? "new-password" : "current-password"}"]`).fill(password);
  await page.getByRole("button", { name: setup ? "Create account" : "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: "Workbench", exact: true, level: 1 }).waitFor();
}

async function navigate(page, name) {
  const menu = page.getByRole("button", { name: "Open navigation", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("button", name === "Data & settings" ? { name: /Data & settings/ } : { name, exact: true })
    .click();
  await page.getByRole("heading", { level: 1, name, exact: true }).waitFor();
}
async function sources(page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query:
          "query PluginSmokeSources { sources { sources { id name counts { paints schemes templates } } } }",
      }),
    });
    const body = await response.json();
    if (!response.ok || body.errors) throw Error(JSON.stringify(body));
    return body.data.sources.sources;
  });
}
async function upload(page, zipPath) {
  await navigate(page, "Data & settings");
  await page.getByRole("button", { name: "Manage plugins", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Plugins", exact: true });
  await dialog.waitFor();
  const acceptedBefore = await page.evaluate(() => window.__pluginFlow.accepted.length);
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    dialog.getByRole("button", { name: /Upload.*zip/i }).click(),
  ]);
  const [accepted] = await Promise.all([
    page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/catalog-sources" && r.request().method() === "POST",
      { timeout: 120_000 },
    ),
    chooser.setFiles(zipPath),
  ]);
  assert.equal(accepted.status(), 202);
  // A 153MB upload exceeds Chromium's inspector response cache. Observe the
  // real fetch response in-page, rather than depending on CDP retaining its body.
  await page.waitForFunction((before) => window.__pluginFlow.accepted.length > before, acceptedBefore);
  const { job } = await page.evaluate(() => window.__pluginFlow.accepted.at(-1));
  assert.ok(job.id);
  await dialog.waitFor({ state: "hidden", timeout: 120_000 });
  await expect(page.getByRole("progressbar", { name: "Plugin installation" })).toBeVisible();
  return job.id;
}
async function waitJob(page, id, stage, minimum = 0) {
  await page.waitForFunction(
    ({ id, stage, minimum }) =>
      window.__pluginFlow?.jobs.some((job) => job.id === id && job.stage === stage && job.done >= minimum),
    { id, stage, minimum },
    { timeout: 180_000 },
  );
  return page.evaluate(
    ({ id, stage, minimum }) =>
      window.__pluginFlow.jobs.findLast((job) => job.id === id && job.stage === stage && job.done >= minimum),
    { id, stage, minimum },
  );
}

export async function runPluginInstallFlow({
  page,
  observerPage,
  width = 1440,
  artifacts,
  zipPath,
  verifyCancelled,
  verifyComplete,
  results = { checks: [] },
}) {
  await mkdir(artifacts, { recursive: true });
  const check = (message) => {
    results.checks.push(`PASS ${width}: ${message}`);
    console.log(`PASS ${width}: ${message}`);
  };
  await page.setViewportSize({ width, height: width < 600 ? 844 : 1050 });
  await page.context().addInitScript(observePluginStreams);
  // A native caller may attach after the initial provider subscription. A real reload
  // installs observation before the real app mounts; persisted authentication is retained.
  if (!(await page.evaluate(() => Boolean(window.__pluginFlow)))) {
    await page.evaluate(observePluginStreams);
    await page.reload();
  }
  await page.getByRole("heading", { level: 1, name: "Workbench", exact: true }).waitFor();
  if (observerPage) {
    await observerPage.context().addInitScript(observePluginStreams);
    if (!(await observerPage.evaluate(() => Boolean(window.__pluginFlow)))) {
      await observerPage.evaluate(observePluginStreams);
      await observerPage.reload();
    }
    await observerPage.getByRole("heading", { level: 1, name: "Workbench", exact: true }).waitFor();
  }
  const inspectPage = observerPage ?? page;
  assert.equal((await sources(inspectPage)).length, 0, "Fresh fixture must have no plugins");
  await navigate(page, "Data & settings");
  const automatic = page.waitForResponse(
    (r) => new URL(r.url()).searchParams.has("automatic") && r.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Manage plugins", exact: true }).click();
  let plugins = page.getByRole("dialog", { name: "Plugins", exact: true });
  await expect(plugins.getByText("No plugins yet", { exact: true })).toBeVisible();
  assert.deepEqual(await (await automatic).json(), { job: null, versions: [] });
  await expect(plugins.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByText("Plugin installation finished", { exact: true })).toHaveCount(0);
  await expect(plugins.locator("xpath=..")).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: path.join(artifacts, `${width}-fresh-plugins.png`),
    fullPage: false,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await navigate(page, "Workbench");
  check("fresh vault automatic refresh creates no job, toast or progress panel");
  const title = `Synthetic install companion ${width}`;
  await page.getByRole("button", { name: "Add miniature", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Add a miniature", exact: true })
    .getByRole("button", { name: "Miniature", exact: true })
    .click();
  let dialog = page.getByRole("dialog", { name: "Add a miniature", exact: true });
  await dialog.getByRole("textbox", { name: /^Name/ }).fill(title);
  await dialog.locator("button[type=submit]").click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Close project", exact: true }).click();

  const cancelledId = await upload(page, zipPath);
  const images = await waitJob(page, cancelledId, "IMAGES");
  assert.ok(images.total >= 800, `Real image progress expected, got ${images.total}`);
  await expect(page.getByRole("progressbar", { name: "Plugin installation", exact: true })).toHaveAttribute(
    "aria-valuenow",
    /\d/,
  );
  await page.screenshot({ path: path.join(artifacts, `${width}-images-global.png`), fullPage: false });
  assert.equal(
    (await sources(inspectPage)).length,
    0,
    "Second authenticated client must see no partial plugin",
  );
  await navigate(page, "Workbench");
  await page.getByText(title, { exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Edit miniature", exact: true });
  const notes = `Saved while plugin images were processing at ${width}px`;
  await dialog.getByRole("textbox", { name: /^Notes/ }).fill(notes);
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/graphql") &&
      r.request().postDataJSON()?.operationName === "UpdateProjectMiniature",
  );
  await dialog.locator("button[type=submit]").click();
  const saveBody = await (await saved).json();
  assert.equal(saveBody.errors, undefined, "Editing during install must persist successfully");
  await dialog.waitFor({ state: "hidden" });
  await page.screenshot({
    path: path.join(artifacts, `${width}-editing-during-install.png`),
    fullPage: false,
  });
  // The project drawer is an accessible modal: it correctly aria-hides the
  // background header until dismissed, even while installation keeps running.
  await page.getByRole("button", { name: "Close project", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "Plugin installation", exact: true })).toBeVisible();
  check("real image processing leaves navigation and miniature editing/save usable");
  await page.reload();
  await expect(page.getByRole("progressbar", { name: "Plugin installation" })).toBeVisible();
  await waitJob(page, cancelledId, "IMAGES", 300);
  await page.screenshot({ path: path.join(artifacts, `${width}-reloaded-progress.png`), fullPage: false });
  assert.equal((await sources(inspectPage)).length, 0, "Reload did not expose partial rows");
  await navigate(page, "Data & settings");
  await page.getByRole("button", { name: "Manage plugins", exact: true }).click();
  plugins = page.getByRole("dialog", { name: "Plugins", exact: true });
  await expect(plugins.getByRole("progressbar", { name: "Plugin installation" })).toBeVisible();
  await expect(plugins.locator("xpath=..")).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: path.join(artifacts, `${width}-running-plugins.png`),
    fullPage: false,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  const cancelResponse = page.waitForResponse(
    (r) => new URL(r.url()).searchParams.get("job") === cancelledId && r.request().method() === "DELETE",
  );
  await page.getByRole("button", { name: "Cancel installation", exact: true }).click();
  assert.equal((await cancelResponse).status(), 200);
  await waitJob(page, cancelledId, "CANCELLED");
  await expect(page.getByText("Plugin installation cancelled", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Plugin installation", exact: true })).toHaveCount(0);
  assert.equal((await sources(inspectPage)).length, 0, "Cancelled plugin must leave no source/catalog rows");
  if (verifyCancelled) await verifyCancelled();
  check("reload reattaches; cancellation cleans staged images and leaves no catalog changes");
  await page.reload();
  await expect(page.getByRole("progressbar", { name: "Plugin installation" })).toHaveCount(0);
  await expect(page.getByText("Plugin installation cancelled", { exact: true })).toHaveCount(0);
  await navigate(page, "Workbench");
  await page.getByText(title, { exact: true }).click();
  await expect(page.getByText(notes, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close project", exact: true }).click();
  const changeStart = await inspectPage.evaluate(() => window.__pluginFlow.changes.length);
  const successId = await upload(page, zipPath);
  await waitJob(page, successId, "IMAGES", 300);
  assert.equal((await sources(inspectPage)).length, 0, "Retry still hidden halfway through real processing");
  await page.screenshot({ path: path.join(artifacts, `${width}-retry-images.png`), fullPage: false });
  await waitJob(page, successId, "SUCCEEDED");
  await expect(page.getByText("Plugin installation finished", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Plugin installation", exact: true })).toHaveCount(0);
  const committed = await sources(inspectPage);
  assert.equal(committed.length, 1);
  assert.deepEqual(committed[0].counts, { paints: 3000, schemes: 300, templates: 500 });
  await inspectPage.waitForFunction(
    (start) => window.__pluginFlow.changes.slice(start).some((change) => change.families.includes("SOURCES")),
    changeStart,
  );
  const pluginChanges = await inspectPage.evaluate(
    (start) =>
      window.__pluginFlow.changes.slice(start).filter((change) => change.families.includes("SOURCES")),
    changeStart,
  );
  assert.equal(
    pluginChanges.length,
    1,
    "Exactly one committed plugin invalidation, not per-row progress changes",
  );
  if (verifyComplete) await verifyComplete(committed[0]);
  await page.screenshot({ path: path.join(artifacts, `${width}-installed.png`), fullPage: false });
  await navigate(page, "Data & settings");
  await page.getByRole("button", { name: "Manage plugins", exact: true }).click();
  plugins = page.getByRole("dialog", { name: "Plugins", exact: true });
  await expect(plugins.getByRole("progressbar")).toHaveCount(0);
  await expect(plugins.getByText("Plugin installation finished", { exact: true })).toHaveCount(0);
  await expect(plugins.locator("xpath=..")).toHaveCSS("opacity", "1");
  await expect(plugins.getByText("No plugins yet", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: path.join(artifacts, `${width}-completed-plugins.png`),
    fullPage: false,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await page.reload();
  await navigate(page, "Data & settings");
  await page.getByRole("button", { name: "Manage plugins", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Plugins", exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Plugin installation" })).toHaveCount(0);
  await expect(page.getByText("Plugin installation finished", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: path.join(artifacts, `${width}-reloaded-completed-plugins.png`),
    fullPage: false,
    animations: "disabled",
  });
  check("completion removes both panels; reopening and reloading do not replay terminal progress or toast");
  const evidence = await page.evaluate(() => window.__pluginFlow);
  assert.deepEqual(evidence.errors, []);
  results[`width${width}`] = { cancelledId, successId, committed, jobs: evidence.jobs, pluginChanges };
  await writeFile(
    path.join(artifacts, `${width}-flow.json`),
    JSON.stringify(results[`width${width}`], null, 2),
  );
  check("retry publishes all 3000 paints/300 schemes/500 templates atomically through one invalidation");
  return results;
}
