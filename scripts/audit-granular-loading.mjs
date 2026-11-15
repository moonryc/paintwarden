#!/usr/bin/env node
// Isolated production benchmark/overflow gate. Never opens a personal profile or vault.
// node scripts/audit-granular-loading.mjs EVIDENCE_DIR [WEB_DIST] [--assert] [--matrix]
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { pseudoText } from "../packages/paint-i18n/runtime.ts";
import { tmpdir } from "node:os";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, _electron as electron } from "playwright";
import { createLibraryFixture } from "./library-fixture.mjs";
import {
  freePort,
  launchOwned,
  stopOwned,
  waitForOutput,
  fixtureCredentials,
} from "./smoke-library-native.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const evidence = path.resolve(process.argv[2]);
const webDist = path.resolve(
  (process.argv[3]?.startsWith("--") ? undefined : process.argv[3]) || "apps/paintwarden-web/dist",
);
const strict = process.argv.includes("--assert");
const matrix = process.argv.includes("--matrix");
const nativeExecutable = process.env.AUDIT_ELECTRON_EXECUTABLE;
let nativeApplication;
const languages = (
  process.env.AUDIT_LANGUAGES || (matrix ? "en,de,es,fr,it,ja,ko,nl,pl,pt-BR,ru,zh-Hans,zh-Hant,en-XA" : "en")
).split(",");
const widths = matrix ? [320, 360, 390, 768, 1024, 1280, 1440] : [1440, 390];
const routes = process.env.AUDIT_ROUTES?.split(",") || [
  "dashboard",
  "miniatures",
  "paints",
  "wishlist",
  "schemes",
  "templates",
  "paint-tools",
  "settings",
];
await mkdir(evidence, { recursive: true });
const fixture = await createLibraryFixture(root, "large");
if (matrix) {
  const require = createRequire(import.meta.url);
  const Database = require("better-sqlite3");
  const db = new Database(path.join(fixture.dataDir, "paintwarden.sqlite"));
  db.prepare("UPDATE paint_catalog SET name = ?, brand = ?, range = ? WHERE rowid % 17 = 0").run(
    "UnbrokenPaintName".repeat(11),
    "ExtremelyLongBrand".repeat(6),
    "LongPaintRange".repeat(8),
  );
  for (const [table, column] of [
    ["miniatures", "title"],
    ["miniature_templates", "name"],
    ["color_schemes", "name"],
  ])
    db.prepare(`UPDATE ${table} SET ${column} = ? WHERE rowid % 17 = 0`).run(
      "UnbrokenProjectName".repeat(10),
    );
  for (const kind of ["miniature", "template"])
    db.prepare("INSERT INTO folders(id,kind,name,created_at) VALUES (?,?,?,?)").run(
      randomUUID(),
      kind,
      "VeryLongFolderName".repeat(10),
      Date.now(),
    );
  db.close();
}
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const server = launchOwned(
  process.execPath,
  ["server.mjs"],
  {
    cwd: path.join(root, "apps/paintwarden/dist"),
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATA_DIR: fixture.dataDir,
      DATABASE_PATH: "",
      HOST: "127.0.0.1",
      PORT: String(port),
      WEB_DIST: webDist,
      PAINTWARDEN_DESKTOP: "",
      PAINTWARDEN_ALLOWED_HOSTS: "",
    },
  },
  path.join(evidence, "server.log"),
);
const report = {
  startedAt: new Date().toISOString(),
  node: process.version,
  webDist,
  fixture,
  network: { latencyMs: 120, downloadBytesPerSecond: 1_500_000, graphqlDelayMs: 450 },
  rows: [],
  errors: [],
};
let browser;
function observe() {
  window.__layoutAudit = { shifts: [], samples: [], shellAt: null, start: performance.now() };
  new PerformanceObserver((entries) => {
    for (const entry of entries.getEntries())
      window.__layoutAudit.shifts.push({
        value: entry.value,
        recentInput: entry.hadRecentInput,
        at: entry.startTime,
        fromStart: entry.startTime - window.__layoutAudit.start,
        fromShell:
          window.__layoutAudit.shellAt === null ? null : entry.startTime - window.__layoutAudit.shellAt,
        sources: entry.sources?.map((s) => s.node?.outerHTML?.slice(0, 220)),
        rects: entry.sources?.map((s) => ({
          previous: s.previousRect.toJSON(),
          current: s.currentRect.toJSON(),
        })),
      });
  }).observe({ type: "layout-shift", buffered: true });
  function frame() {
    const state = window.__layoutAudit;
    const header =
      document.querySelector("[data-page-header]") ||
      document.querySelector("main h2")?.parentElement?.parentElement;
    if (
      header &&
      !header.closest("[data-skeleton]") &&
      (!state.expected || header.textContent.includes(state.expected))
    ) {
      if (state.shellAt === null) state.shellAt = performance.now();
      const elements = [header, document.querySelector("[data-filter-toolbar]")].filter(Boolean);
      state.samples.push(
        elements.map((el) => {
          const b = el.getBoundingClientRect();
          return [b.x, b.y, b.width, b.height];
        }),
      );
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
function overflow() {
  const width = document.documentElement.clientWidth;
  const body = document.body;
  const offenders = [...body.querySelectorAll("*")]
    .filter((el) => {
      const b = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (
        !b.width ||
        !b.height ||
        style.visibility === "hidden" ||
        style.display === "none" ||
        el.closest('[aria-hidden="true"]')
      )
        return false;
      if (b.right <= width + 1 && b.left >= -1) return false;
      // Explicit internal scrollers and their clipped contents do not constitute page overflow.
      let parent = el.parentElement;
      while (parent && parent !== body) {
        const p = getComputedStyle(parent);
        if (
          ["auto", "scroll", "hidden", "clip"].includes(p.overflowX) &&
          parent.getBoundingClientRect().right <= width + 1
        )
          return false;
        parent = parent.parentElement;
      }
      return true;
    })
    .slice(0, 12)
    .map((el) => ({
      tag: el.tagName,
      text: el.textContent?.slice(0, 100),
      class: el.className,
      rect: el.getBoundingClientRect().toJSON(),
    }));
  return {
    width,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: body.scrollWidth,
    offenders,
  };
}
try {
  await waitForOutput(server, /"phase":"ready"/, "isolated production server");
  const response = await fetch(`${base}/api/auth/setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fixtureCredentials),
  });
  assert.equal(response.status, 200);
  const { token } = await response.json();
  if (!nativeExecutable) browser = await chromium.launch({ headless: true });
  for (const locale of languages)
    for (const width of widths) {
      let context;
      let page;
      if (nativeExecutable) {
        const profile = await mkdtemp(path.join(tmpdir(), "paintwarden-granular-native-"));
        await writeFile(
          path.join(profile, "client-connection.json"),
          JSON.stringify({ mode: "remote", serverUrl: base, language: locale }),
        );
        const env = {
          ...process.env,
          PAINTWARDEN_E2E: "1",
          PAINTWARDEN_DESKTOP_DATA_DIR: profile,
          PAINTWARDEN_DISABLE_UPDATES: "1",
        };
        delete env.ELECTRON_RUN_AS_NODE;
        nativeApplication = await electron.launch({
          executablePath: nativeExecutable,
          args: ["--hidden", "--lang=en-US"],
          env,
        });
        page = await nativeApplication.firstWindow();
        const identity = await nativeApplication.evaluate(({ app, BrowserWindow }, size) => {
          const win = BrowserWindow.getAllWindows()[0];
          win.setSize(size, 1000);
          return {
            packaged: app.isPackaged,
            hidden: !win.isVisible(),
            throttled: win.webContents.getBackgroundThrottling(),
            profile: app.getPath("userData"),
          };
        }, width);
        assert.ok(identity.packaged && identity.hidden && !identity.throttled);
        report.native ||= [];
        report.native.push(identity);
        context = page.context();
      } else {
        context = await browser.newContext({
          viewport: { width, height: 1000 },
          locale,
          reducedMotion: "reduce",
        });
      }
      await context.addCookies([
        { name: "pv_session", value: token, url: base, httpOnly: true, sameSite: "Strict" },
      ]);
      await context.addInitScript((locale) => localStorage.setItem("paintwarden-language", locale), locale);
      if (matrix)
        await context.addInitScript(() => {
          for (const page of ["dashboard", "miniatures", "templates"])
            localStorage.setItem(`paintwarden.folders.${page}.flat`, "false");
        });
      await context.addInitScript(observe);
      page ||= await context.newPage();
      page.on("pageerror", (error) => report.errors.push(error.message));
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: matrix ? 0 : 120,
        downloadThroughput: matrix ? -1 : 1_500_000,
        uploadThroughput: matrix ? -1 : 100_000,
      });
      await page.route("**/api/graphql", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, matrix ? 0 : 450));
        await route.continue();
      });
      const strings = JSON.parse(
        await readFile(
          path.join(root, `packages/paint-i18n/locales/${locale === "en-XA" ? "en" : locale}/pages.json`),
          "utf8",
        ),
      );
      const shellStrings = JSON.parse(
        await readFile(
          path.join(root, `packages/paint-i18n/locales/${locale === "en-XA" ? "en" : locale}/shell.json`),
          "utf8",
        ),
      );
      if (locale === "en-XA") {
        for (const resource of [strings, shellStrings])
          for (const [key, value] of Object.entries(resource))
            if (typeof value === "string") resource[key] = pseudoText(value);
      }
      const navKeys = {
        dashboard: "layoutWorkbench",
        miniatures: "layoutMiniatures",
        paints: "layoutPaints",
        wishlist: "layoutWishlist",
        schemes: "layoutSchemes",
        templates: "layoutTemplates",
        "paint-tools": "layoutPaintTools",
        settings: "layoutSettings",
      };
      const titleKeys = {
        dashboard: "homeWorkbenchTitle",
        miniatures: "homeMiniaturesTitle",
        paints: "libraryPaintsTitle",
        wishlist: "wishlistWishlist",
        schemes: "schemesTitle",
        templates: "templatesPageTitle",
        "paint-tools": "toolsTitle",
        settings: "settingsTitle",
      };
      if (nativeExecutable) {
        await page.goto("paintwarden://app", { waitUntil: "domcontentloaded" });
        await page.getByRole("textbox", { name: "Username", exact: true }).fill(fixtureCredentials.username);
        await page.locator('input[type="password"]').fill(fixtureCredentials.password);
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await page.waitForFunction(
          () =>
            !!document.querySelector("main h2") &&
            !document.querySelector("main [data-skeleton], main [aria-busy=true]"),
        );
      }
      for (const mode of matrix ? ["navigation"] : ["cold", "navigation"])
        for (const route of routes) {
          if (mode === "cold" || page.url() === "about:blank") {
            await page.goto(`${nativeExecutable ? "paintwarden://app" : base}/?audit=${route}`, {
              waitUntil: "domcontentloaded",
            });
            await page.waitForFunction(
              () =>
                !!document.querySelector("main h2") &&
                !document.querySelector("main [data-skeleton], main [aria-busy=true]"),
            );
          }
          const expected = strings[titleKeys[route]];
          const mobileNavigation = width < 1024;
          if (mobileNavigation) {
            await page.getByRole("button", { name: shellStrings.openNavigation, exact: true }).click();
          }
          const nav = page.locator(mobileNavigation ? ".MuiDrawer-paper" : "aside").filter({ visible: true });
          const target =
            route === "settings"
              ? nav.getByRole("button").filter({ hasText: strings.layoutSettings }).first()
              : nav.locator(".MuiListItemButton-root").filter({ hasText: strings[navKeys[route]] }).first();
          await target.evaluate((element, expected) => {
            window.__layoutAudit = {
              shifts: [],
              samples: [],
              shellAt: null,
              start: performance.now(),
              expected,
            };
            element.click();
          }, expected);
          await page.waitForFunction(
            (expected) =>
              [...document.querySelectorAll("main h2")].some((el) => el.textContent === expected) &&
              !document.querySelector("main [data-skeleton], main [aria-busy=true]"),
            expected,
            { timeout: 20_000 },
          );
          // Two stable post-response frames plus font readiness; sample through query settlement.
          await page.evaluate(
            async (duration) => {
              await document.fonts.ready;
              const start = performance.now();
              await new Promise((resolve) => {
                const frame = () =>
                  performance.now() - start > duration ? resolve() : requestAnimationFrame(frame);
                requestAnimationFrame(frame);
              });
            },
            matrix ? 350 : 1100,
          );
          const row = await page.evaluate(
            (settleMs) => {
              const state = window.__layoutAudit;
              const initial = state.samples[0] || [];
              let shellMovementPx = 0;
              for (const sample of state.samples)
                sample.forEach((box, i) =>
                  box.forEach((value, axis) => {
                    if (initial[i])
                      shellMovementPx = Math.max(shellMovementPx, Math.abs(value - initial[i][axis]));
                  }),
                );
              return {
                timeToShellMs: state.shellAt === null ? null : state.shellAt - state.start,
                timeToContentMs: performance.now() - state.start - settleMs,
                cls: state.shifts.filter((s) => !s.recentInput).reduce((sum, s) => sum + s.value, 0),
                allShifts: state.shifts.reduce((sum, s) => sum + s.value, 0),
                shellMovementPx,
                shifts: state.shifts,
              };
            },
            matrix ? 350 : 1100,
          );
          Object.assign(row, { route, mode, locale, width, overflow: await page.evaluate(overflow) });
          report.rows.push(row);
          await writeFile(path.join(evidence, "results.json"), JSON.stringify(report, null, 2));
          if (!matrix || row.overflow.documentWidth > width)
            await page.screenshot({ path: path.join(evidence, `${locale}-${width}-${mode}-${route}.png`) });
          console.log(
            JSON.stringify({
              route,
              mode,
              locale,
              width,
              shell: row.timeToShellMs,
              cls: row.cls,
              movement: row.shellMovementPx,
              overflow: row.overflow.documentWidth - row.overflow.width,
            }),
          );
        }
      if (nativeApplication) {
        await nativeApplication.close();
        nativeApplication = undefined;
      } else await context.close();
    }
  if (strict) {
    assert.deepEqual(report.errors, []);
    for (const row of report.rows) {
      assert.ok(
        row.overflow.documentWidth <= row.overflow.width + 1 &&
          row.overflow.bodyWidth <= row.overflow.width + 1,
        `${row.route} ${row.width} ${row.locale}: horizontal overflow`,
      );
      assert.ok(row.shellMovementPx <= 1, `${row.route} ${row.width}: shell moved ${row.shellMovementPx}px`);
      assert.ok(row.cls <= 0.001, `${row.route} ${row.width}: CLS ${row.cls}`);
    }
  }
} catch (error) {
  if (nativeApplication) {
    const page = nativeApplication.windows()[0];
    report.nativeFailureBody = await page
      ?.locator("body")
      .innerText()
      .catch(() => "unavailable");
    await page?.screenshot({ path: path.join(evidence, "native-failure.png") }).catch(() => {});
  }
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  await nativeApplication?.close();
  await browser?.close();
  await stopOwned(server.child);
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(evidence, "results.json"), JSON.stringify(report, null, 2));
}
