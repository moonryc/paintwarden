import assert from "node:assert/strict";
import path from "node:path";
import { expect as playwrightExpect } from "playwright/test";

const expect = playwrightExpect.configure({ timeout: 25_000 });

// Real production process termination/restart, not a mocked reconnect response.
// Each viewport loses an active SSE stream and issues fresh page + drawer reads.
export async function checkConnectionRecovery({
  page,
  title,
  artifacts,
  results,
  stopServer,
  restartServer,
}) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1050 });
    const search = page.getByRole("textbox", {
      name: "Search miniatures…",
      exact: true,
      includeHidden: true,
    });
    await search.fill("");
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await page.evaluate(() => {
      const samples = [];
      const sample = () => {
        const surfaces = [document.querySelector("main"), ...document.querySelectorAll('[role="dialog"]')];
        const counts = surfaces
          .filter(Boolean)
          .map(
            (surface) =>
              [...surface.querySelectorAll("[data-app-banner], .MuiAlert-standardError")].filter(
                (banner) =>
                  banner.closest('[role="dialog"]') === (surface.matches('[role="dialog"]') ? surface : null),
              ).length,
          );
        samples.push(counts);
      };
      window.__recoveryAudit = { samples, observer: new MutationObserver(sample) };
      window.__recoveryAudit.observer.observe(document.body, { childList: true, subtree: true });
      sample();
    });
    await stopServer();
    await expect(page.getByText("Connection lost. Reconnecting…", { exact: true })).toBeVisible();
    await page.screenshot({
      path: path.join(artifacts, `disconnected-page-${width}.png`),
      animations: "disabled",
    });
    // Both a new search and a newly mounted detail fail while the server is down.
    await page.getByText(title, { exact: true }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await search.fill("Synthetic", { force: true });
    await expect(page.locator("[data-app-banner]")).toHaveCount(2);
    await expect(drawer.locator(".MuiSkeleton-root")).toHaveCount(0);
    await page.screenshot({
      path: path.join(artifacts, `disconnected-${width}.png`),
      animations: "disabled",
    });
    const reads = [];
    const record = (response) => {
      if (response.url().endsWith("/api/graphql") && response.ok())
        reads.push(response.request().postDataJSON()?.operationName);
    };
    page.on("response", record);
    const events = await page.evaluate(() => window.__browserE2E.events.length);
    await restartServer();
    // Deliberately no Retry, focus, online event or click after restart.
    await expect(page.getByText("Connection lost. Reconnecting…", { exact: true })).toHaveCount(0);
    await expect(drawer.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.locator("[data-app-banner]")).toHaveCount(0);
    await expect
      .poll(() => reads.some((name) => /SearchFolderContents|MiniatureList|Home/.test(name ?? "")))
      .toBe(true);
    await expect.poll(() => reads.some((name) => /ProjectMiniatureDetails/.test(name ?? ""))).toBe(true);
    await page.waitForFunction((previous) => window.__browserE2E.events.length > previous, events);
    await page.screenshot({ path: path.join(artifacts, `recovered-${width}.png`), animations: "disabled" });
    page.off("response", record);
    const samples = await page.evaluate(() => {
      window.__recoveryAudit.observer.disconnect();
      return window.__recoveryAudit.samples;
    });
    assert.ok(
      samples.every((counts) => counts.every((count) => count <= 1)),
      `Stacked error banners: ${JSON.stringify(samples)}`,
    );
    results.checks.push({
      check: `connection recovery ${width}`,
      status: "PASS",
      reads,
      maxBannersPerSurface: Math.max(...samples.flat()),
    });
    await page.getByRole("button", { name: "Close project", exact: true }).click();
  }
}
