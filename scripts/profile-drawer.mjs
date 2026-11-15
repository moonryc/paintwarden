// Packaged-only, isolated synthetic vault. Run with pinned Node 22.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { _electron as electron } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const out = path.resolve(process.argv[2] ?? "outputs/drawer-perf");
await mkdir(out, { recursive: true });
const profile =
  process.env.DRAWER_PROFILE ?? (await mkdtemp(path.join(tmpdir(), "paintwarden-drawer-perf-")));
if (process.env.DRAWER_FRESH_CODE_CACHE === "1") {
  assert.ok(
    path.basename(profile).startsWith("paintwarden-drawer-perf-"),
    "Only synthetic temp profiles may be cleared",
  );
  for (const directory of ["Code Cache", "Cache", "GPUCache"])
    await rm(path.join(profile, "electron", directory), { recursive: true, force: true });
}
const executablePath =
  process.env.DRAWER_EXECUTABLE ??
  path.join(root, "dist/electron/mac-arm64/Paintwarden.app/Contents/MacOS/Paintwarden");
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([k]) =>
      !/^(PAINTWARDEN_|DATA_DIR$|DATABASE_PATH$|PORT$|HOST$|NODE_OPTIONS$|ELECTRON_RUN_AS_NODE$)/i.test(k),
  ),
);
Object.assign(env, {
  PAINTWARDEN_DESKTOP_DATA_DIR: profile,
  PAINTWARDEN_DISABLE_UPDATES: "1",
  NODE_ENV: "production",
  LANG: "en_US.UTF-8",
  LC_ALL: "en_US.UTF-8",
});
const app = await electron.launch({
  executablePath,
  args: [
    "--lang=en-US",
    "--window-position=-10000,-10000",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
  ],
  env,
  timeout: 60000,
});
let page;
const report = { profile, executablePath, node: process.version, runs: [] };
try {
  await app.evaluate(({ app, BrowserWindow }) => {
    const hide = (win) => {
      win.webContents.setBackgroundThrottling(false);
      win.setPosition(-10000, -10000); /* offscreen, not hidden: real frame cadence */
    };
    BrowserWindow.getAllWindows().forEach(hide);
    app.on("browser-window-created", (_, win) => {
      hide(win);
    });
  });
  page = await app.firstWindow();
  const local = page.getByRole("button", { name: "Use this computer", exact: true });
  await page.waitForFunction(
    () =>
      /use this computer/i.test(document.body.innerText) ||
      document.body.innerText.includes("Workbench") ||
      document.body.innerText.includes("Set up Paintwarden"),
  );
  if (await local.count()) await local.evaluate((el) => el.click());
  if (!process.env.DRAWER_PROFILE)
    await page.getByRole("heading", { name: "Set up Paintwarden", exact: true }).waitFor({ timeout: 60000 });
  if (await page.getByRole("heading", { name: "Set up Paintwarden", exact: true }).count()) {
    await page.getByRole("textbox", { name: "Username", exact: true }).fill("drawer-perf-owner");
    await page.locator('input[autocomplete="new-password"]').fill("Synthetic-drawer-perf-2026!");
    await page.getByRole("button", { name: "Create account", exact: true }).click({ force: true });
  }
  if (await page.locator('input[autocomplete="current-password"]').count()) {
    await page.getByRole("textbox", { name: "Username", exact: true }).fill("drawer-perf-owner");
    await page.locator('input[autocomplete="current-password"]').fill("Synthetic-drawer-perf-2026!");
    await page.getByRole("button", { name: "Sign in", exact: true }).evaluate((el) => el.click());
  }
  await page.getByRole("heading", { name: "Workbench", exact: true }).first().waitFor({ timeout: 60000 });
  if (!process.env.DRAWER_PROFILE) {
    report.fixture = await page.evaluate(async () => {
      const api = async (route, body, method = "POST") => {
        const r = await fetch(`/api/${route}`, {
          method,
          headers: { "content-type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(`${route}: ${JSON.stringify(data)}`);
        return data;
      };
      await api("catalog", {
        paints: Array.from({ length: 30 }, (_, i) => ({
          brand: "DrawerPerf",
          range: "Synthetic",
          name: `Paint ${i}`,
          colorHex: `#${(0x334455 + i * 1000).toString(16)}`,
        })),
      });
      const paints = (await api("catalog?q=DrawerPerf&pageSize=100", undefined, "GET")).items;
      await api("paint-state", { paintIds: paints.map((p) => p.id), state: "OWNED", quantity: 2 }, "PUT");
      const schemes = [];
      for (let i = 0; i < 9; i++)
        schemes.push(
          (
            await api("color-schemes", {
              name: `Perf scheme ${i}`,
              category: "BLUE",
              entries: [
                { type: "DIVIDER", label: "BASECOAT", tone: "SECTION", role: null },
                ...paints.slice(0, 3).map((p) => ({ type: "PAINT", paintId: p.id })),
              ],
            })
          ).id,
        );
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 1200;
      const ctx = canvas.getContext("2d");
      const gradient = ctx.createLinearGradient(0, 0, 1600, 1200);
      gradient.addColorStop(0, "#287baa");
      gradient.addColorStop(1, "#c48c54");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1600, 1200);
      const photo = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      for (let i = 0; i < 60; i++) {
        const mini = await api("miniatures", {
          title: i === 59 ? "ZZZ Heavy miniature" : `Perf miniature ${String(i).padStart(3, "0")}`,
          status: "OWNED",
          paintingStatus: "IN_PROGRESS",
          notes: "Isolated synthetic performance fixture",
          manufacturer: "Synthetic",
          scale: "28mm",
        });
        if (i % 10 === 0 || i === 59) {
          await api("miniature-schemes", { miniatureId: mini.id, schemeIds: schemes }, "PUT");
          for (const paint of paints)
            await api("requirements", {
              miniatureId: mini.id,
              paintId: paint.id,
              step: "BASECOAT",
              notes: "Synthetic recipe step",
            });
          const form = new FormData();
          form.append("image", photo, "synthetic.jpg");
          const r = await fetch(`/api/miniatures/${mini.id}/image`, { method: "POST", body: form });
          if (!r.ok) throw new Error(await r.text());
        }
      }
      return { miniatures: 60, schemes: 9, recipeRows: 30, photo: "1600x1200 JPEG", paints: paints.length };
    });
    await writeFile(path.join(out, "profile.txt"), profile);
    // A real fresh launch, not this seeding session, is the cold measurement.
    console.log(JSON.stringify(report, null, 2));
  } else {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const session = await page.context().newCDPSession(page);
    await session.send("Performance.enable");
    await session.send("Page.setWebLifecycleState", { state: "active" });
    await session.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    // Opt-in boundary render/commit measures, DOM/paint completion, long tasks,
    // GraphQL request waterfall and Electron/renderer CPU. No profiling React build.
    await page.evaluate(() => {
      window.__drawerProbe = { longTasks: [], mutations: [], commits: [] };
      new PerformanceObserver((list) =>
        window.__drawerProbe.longTasks.push(
          ...list.getEntries().map((e) => ({ start: e.startTime, duration: e.duration })),
        ),
      ).observe({ type: "longtask", buffered: true });
    });
    for (let i = 0; i < 4; i++) {
      // Cold = first drawer after fresh process launch. No hover/pointerdown is simulated.
      const tile = page.getByRole("button", { name: /ZZZ Heavy miniature/ });
      // The home list is paged. Use its normal search rather than bypassing navigation.
      if (!(await tile.count())) {
        const search = page.getByRole("textbox", { name: /search/i }).first();
        await search.fill("ZZZ Heavy");
      }
      await tile.waitFor({ state: "attached" });
      if (i === 0 && process.env.DRAWER_INTENT === "1") {
        const prefetched = page.waitForResponse(
          (response) => response.request().postDataJSON()?.operationName === "ProjectMiniatureDetails",
        );
        await tile.dispatchEvent("pointerover");
        await prefetched;
      }
      const metrics0 = await session.send("Performance.getMetrics");
      const cpu0 = await app.evaluate(({ app }) =>
        app.getAppMetrics().map((m) => ({ pid: m.pid, type: m.type, cpu: m.cpu })),
      );
      const requests = [];
      const requestListener = (request) => {
        if (/graphql/.test(request.url()))
          requests.push({
            request,
            at: Date.now(),
            query: request.postDataJSON()?.operationName,
            body: request.postDataJSON(),
          });
      };
      page.on("request", requestListener);
      const finishedListener = (request) => {
        const item = requests.find((item) => item.request === request);
        if (item) {
          item.finishedAt = Date.now();
          item.timing = request.timing();
        }
      };
      page.on("requestfinished", finishedListener);
      await page.evaluate(() => {
        const p = window.__drawerProbe;
        p.start = performance.now();
        p.shell = null;
        p.complete = null;
        p.longTasks = [];
        p.commits = [];
        p.visible = null;
        p.settled = null;
        p.photoReady = null;
        performance.clearMeasures();
        performance.clearMarks("paintwarden:profile-drawer");
        performance.mark("paintwarden:profile-drawer");
        const frame = () => {
          const rect = document.querySelector('[role="dialog"]')?.getBoundingClientRect();
          if (rect && rect.left < innerWidth - 2) p.visible ??= performance.now();
          if (p.complete !== null && rect && Math.abs(rect.right - innerWidth) < 1)
            p.settled ??= performance.now();
          if (
            p.complete !== null &&
            [...document.querySelectorAll('[role="dialog"] img')].every(
              (img) => img.complete && img.naturalWidth > 0,
            )
          )
            p.photoReady ??= performance.now();
          if (p.complete === null || p.settled === null || p.photoReady === null)
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
        const observer = new MutationObserver(() => {
          if (p.shell === null && document.querySelector('[role="dialog"]')) p.shell = performance.now();
          if (
            p.complete === null &&
            document.querySelector('[role="dialog"]')?.textContent.includes("Perf scheme 8")
          )
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                p.complete ??= performance.now();
              }),
            );
        });
        observer.observe(document.body, { childList: true, subtree: true });
        p.observer = observer;
      });
      await tile.evaluate((el) => el.click());
      await page.waitForFunction(
        () =>
          window.__drawerProbe.complete !== null &&
          window.__drawerProbe.settled !== null &&
          [...document.querySelectorAll('[role="dialog"] img')].every(
            (img) => img.complete && img.naturalWidth > 0,
          ),
        null,
        {
          timeout: 60000,
          polling: "raf",
        },
      );
      const sample = await page.evaluate(() => {
        const p = window.__drawerProbe;
        p.observer.disconnect();
        return {
          startEpochMs: performance.timeOrigin + p.start,
          shellMs: p.shell - p.start,
          visibleMs: p.visible - p.start,
          animationSettledMs: p.settled - p.start,
          photoDecodedMs: p.photoReady - p.start,
          endToEndMs: Math.max(p.complete, p.settled, p.photoReady) - p.start,
          commits: performance
            .getEntriesByType("measure")
            .filter((e) => e.name.startsWith("paintwarden:drawer:"))
            .map((e) => ({ boundary: e.name, renderToCommitMs: e.duration })),
          completeMs: p.complete - p.start,
          longTasks: p.longTasks.filter((e) => e.start >= p.start),
          resources: performance
            .getEntriesByType("resource")
            .filter((e) => e.startTime >= p.start)
            .map((e) => ({
              name: e.name,
              startMs: e.startTime - p.start,
              duration: e.duration,
              bytes: e.transferSize,
            })),
        };
      });
      const metrics1 = await session.send("Performance.getMetrics");
      const before = Object.fromEntries(metrics0.metrics.map((m) => [m.name, m.value]));
      sample.cpu = Object.fromEntries(
        metrics1.metrics
          .filter((m) => /TaskDuration|ScriptDuration|LayoutDuration|RecalcStyleDuration/.test(m.name))
          .map((m) => [m.name, (m.value - before[m.name]) * 1000]),
      );
      sample.electronCPU = {
        before: cpu0,
        after: await app.evaluate(({ app }) =>
          app.getAppMetrics().map((m) => ({ pid: m.pid, type: m.type, cpu: m.cpu })),
        ),
      };
      sample.requests = requests.map(({ query, at, finishedAt, timing, body }) => ({
        query,
        startMs: at - sample.startEpochMs,
        durationMs: finishedAt - at,
        timing,
        variables: body.variables,
      }));
      sample.kind =
        i === 0
          ? process.env.DRAWER_INTENT === "1"
            ? "intent-prefetched-first-open"
            : "cold-first-open"
          : "warm-reopen";
      report.runs.push(sample);
      page.off("request", requestListener);
      page.off("requestfinished", finishedListener);
      await page.getByRole("button", { name: "Close project", exact: true }).evaluate((el) => el.click());
      await page.getByRole("dialog").waitFor({ state: "detached" });
    }
    report.errors = errors;
    assert.deepEqual(errors, []);
    await writeFile(path.join(out, "results.json"), JSON.stringify(report, null, 2));
    console.log(
      JSON.stringify(
        report.runs.map(
          ({
            kind,
            shellMs,
            visibleMs,
            animationSettledMs,
            completeMs,
            commits,
            longTasks,
            requests,
            cpu,
          }) => ({
            kind,
            shellMs,
            completeMs,
            visibleMs,
            animationSettledMs,
            commits,
            longTasks,
            queries: requests.length,
            cpu,
          }),
        ),
        null,
        2,
      ),
    );
  }
} catch (error) {
  console.error(
    "Page:",
    await page?.url(),
    await page?.locator("body").innerText(),
    await page
      ?.locator("input")
      .evaluateAll((els) => els.map((el) => ({ name: el.name, value: el.value, type: el.type }))),
  );
  throw error;
} finally {
  await app.close();
}
