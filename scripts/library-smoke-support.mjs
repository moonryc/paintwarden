import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

export function attachLibraryRecorder(page) {
  const requests = [];
  const errors = [];
  const events = new EventEmitter();
  const pending = new Set();
  const byRequest = new WeakMap();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/")) return;
    let body;
    try {
      if (!url.pathname.startsWith("/api/auth/")) body = request.postDataJSON();
    } catch {
      /* Non-JSON file requests are not GraphQL. */
    }
    const entry = { path: url.pathname, method: request.method(), startedAt: performance.now(), body };
    requests.push(entry);
    byRequest.set(request, entry);
    events.emit("change");
  });
  page.on("response", (response) => {
    const entry = byRequest.get(response.request());
    if (!entry) return;
    entry.status = response.status();
    if (entry.path.endsWith("/stream")) {
      events.emit("change");
      return;
    }
    const promise = (async () => {
      try {
        let deadline;
        const text = await Promise.race([
          response.text(),
          new Promise((_, reject) => {
            deadline = setTimeout(
              () => reject(new Error("CDP response body unavailable after navigation")),
              5000,
            );
          }),
        ]).finally(() => clearTimeout(deadline));
        entry.bytes = Buffer.byteLength(text);
        entry.durationMs = performance.now() - entry.startedAt;
        try {
          if (!entry.path.startsWith("/api/auth/") && entry.path !== "/api/state")
            entry.data = JSON.parse(text);
        } catch {
          /* Some API responses are binary. */
        }
      } catch (error) {
        entry.readError = error.message;
      }
      events.emit("change");
    })();
    pending.add(promise);
    promise.finally(() => pending.delete(promise));
  });
  return {
    requests,
    errors,
    mark: () => requests.length,
    slice: (mark) => requests.slice(mark),
    settle: () => Promise.all([...pending]),
    waitFor(predicate, mark = 0, timeout = 20000) {
      return new Promise((resolve, reject) => {
        let timer;
        const check = () => {
          const entries = requests.slice(mark);
          if (predicate(entries)) {
            clearTimeout(timer);
            events.off("change", check);
            resolve(entries);
          }
        };
        timer = setTimeout(() => {
          events.off("change", check);
          reject(new Error("Timed out awaiting fixture API evidence"));
        }, timeout);
        events.on("change", check);
        check();
      });
    },
  };
}
export const libraryReads = (entries) => entries.filter((entry) => entry.data?.data?.library);
const frame = (page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const numberAttr = async (element, name) => Number(await element.getAttribute(name));

// Owner setup/fixture seeding happens in the host harness, before this function.
// Attach the recorder BEFORE loading the renderer/chooser. This function marks a clean
// Library navigation separately; pre-scenario legacy requests remain visible in raw evidence.
export async function runLibraryScenario({
  page,
  recorder,
  evidenceDir,
  label = "browser",
  initialNavigate = () => page.reload(),
  secondClientWrite,
}) {
  await mkdir(evidenceDir, { recursive: true });
  const checks = [];
  const metrics = {};
  recorder.scenario = { checks, metrics }; // Preserve completed checks if a later assertion fails.
  const pass = (name, evidence) => {
    checks.push({ status: "PASS", name, evidence });
    console.log("PASS", label, name);
  };
  const initial = recorder.mark();
  const started = performance.now();
  await initialNavigate();
  const list = page.getByRole("list", { name: "Paint library", exact: true });
  await list.waitFor({ state: "visible", timeout: 30000 });
  await recorder.waitFor((entries) => libraryReads(entries).length > 0, initial);
  await frame(page);
  await recorder.settle();
  const initialEntries = recorder.slice(initial);
  const firstReads = libraryReads(initialEntries);
  assert.equal(
    initialEntries.filter((entry) => entry.path === "/api/state").length,
    0,
    "Initial Library must not load legacy State",
  );
  assert.ok(firstReads.every((entry) => entry.body.variables.first <= 100));
  const loaded = await numberAttr(list, "data-loaded-count");
  assert.ok(loaded > 0 && loaded <= 100);
  metrics.initialLibrary = {
    elapsedToPaintMs: performance.now() - started,
    loaded,
    total: await numberAttr(list, "data-total-count"),
    dataBytes: firstReads.reduce((sum, entry) => sum + entry.bytes, 0),
    api: initialEntries.map(({ path, bytes, durationMs }) => ({ path, bytes, durationMs })),
  };
  pass("Initial production Library is bounded without /api/state", metrics.initialLibrary);
  assert.ok(
    recorder.requests.some((entry) => entry.path === "/api/graphql/stream"),
    "Production Library opens SSE",
  );

  const input = list.getByRole("textbox", { name: / quantity$/ }).first();
  // NumberField is a textbox with inputMode, not an HTML number spinbutton.
  await input.waitFor();
  const inputLabel = await input.getAttribute("aria-label");
  const paintName = inputLabel.replace(/ quantity$/, "");
  const paint = firstReads
    .flatMap((entry) => entry.data.data.library.nodes)
    .find((node) => node.name === paintName);
  assert.ok(paint, `Visible quantity paint ${paintName} exists in bounded payload`);
  const beforeQuantity = Number(await input.inputValue());
  const stockMark = recorder.mark();
  const stockStart = performance.now();
  await list.getByRole("button", { name: `Increase ${paintName} quantity`, exact: true }).click();
  await recorder.waitFor(
    (entries) =>
      entries.some(
        (entry) =>
          entry.data?.data?.setPaintStock || (entry.path === "/api/paint-state" && entry.status === 200),
      ),
    stockMark,
  );
  await page.waitForFunction(
    ({ label, quantity }) =>
      document.querySelector(`input[aria-label="${CSS.escape(label)}"]`)?.value === String(quantity),
    { label: inputLabel, quantity: beforeQuantity + 1 },
  );
  metrics.stockActionMs = performance.now() - stockStart;
  metrics.stockMutationResponseBytes = recorder
    .slice(stockMark)
    .filter((entry) => entry.data?.data?.setPaintStock || entry.path === "/api/paint-state")
    .reduce((sum, entry) => sum + (entry.bytes ?? 0), 0);
  pass("Visible quantity control saves stock", {
    paintId: paint.id,
    beforeQuantity,
    quantity: beforeQuantity + 1,
    elapsedMs: metrics.stockActionMs,
  });

  const more = page.getByRole("button", { name: "Load more paints", exact: true });
  await more.click();
  await page.waitForFunction(
    (previous) =>
      Number(document.querySelector('[aria-label="Paint library"]')?.getAttribute("data-loaded-count")) >
      previous,
    loaded,
  );
  const loadedWindow = await numberAttr(list, "data-loaded-count");
  await page.evaluate(() => window.scrollTo(0, 1000));
  await frame(page);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const updateMark = recorder.mark();
  const updateStart = performance.now();
  assert.equal(typeof secondClientWrite, "function", "Host must supply an independent stock writer");
  await secondClientWrite(paint.id, 7);
  const pageCount = Math.ceil(loadedWindow / loaded);
  await recorder.waitFor((entries) => {
    const reads = libraryReads(entries);
    return (
      reads.length >= pageCount &&
      reads.some((entry) =>
        entry.data.data.library.nodes.some((node) => node.id === paint.id && node.inventory?.quantity === 7),
      )
    );
  }, updateMark);
  await page.waitForFunction(
    (count) =>
      Number(document.querySelector('[aria-label="Paint library"]')?.getAttribute("data-loaded-count")) ===
      count,
    loadedWindow,
  );
  await frame(page);
  const refreshes = libraryReads(recorder.slice(updateMark));
  const lastRevision = refreshes.at(-1).data.data.library.revision;
  const coherent = refreshes.filter(
    (entry) => JSON.stringify(entry.data.data.library.revision) === JSON.stringify(lastRevision),
  );
  assert.ok(coherent.length >= pageCount, "All loaded pages refresh to one revision");
  assert.equal(await page.evaluate(() => window.scrollY), scrollBefore, "SSE preserves exact scroll offset");
  metrics.secondClientUpdateMs = performance.now() - updateStart;
  metrics.loadedWindowRefreshBytes = coherent.reduce((sum, entry) => sum + entry.bytes, 0);
  metrics.loadedWindowRefreshPages = coherent.length;
  pass("Independent stock write refreshes every loaded page via SSE and preserves scroll", {
    loadedWindow,
    pageCount,
    coherentReads: coherent.length,
    revision: lastRevision,
    scrollBefore,
    elapsedMs: metrics.secondClientUpdateMs,
  });

  const home = recorder.mark();
  await page.getByRole("button", { name: "Workbench", exact: true }).first().click();
  await recorder.waitFor((entries) => entries.some((entry) => entry.data?.data?.home), home);
  await page.getByText("What can you paint?", { exact: true }).waitFor({ timeout: 30000 });
  await page
    .getByRole("button", { name: /^Paints(?:\s|$)/ })
    .first()
    .click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("list", { name: "Paint library", exact: true }).waitFor();
  await page.waitForFunction(
    ({ label }) => document.querySelector(`input[aria-label="${CSS.escape(label)}"]`)?.value === "7",
    { label: inputLabel },
  );
  pass("Apollo Home navigation and return retain current stock", { paintId: paint.id, quantity: 7 });
  assert.deepEqual(recorder.errors, [], "No unexpected renderer errors");
  pass("No renderer page errors", []);
  await page.screenshot({ path: path.join(evidenceDir, `${label}-library.png`) });
  await writeFile(
    path.join(evidenceDir, `${label}-scenario.json`),
    JSON.stringify({ checks, metrics, requests: recorder.requests, errors: recorder.errors }, null, 2) + "\n",
  );
  return { checks, metrics };
}
