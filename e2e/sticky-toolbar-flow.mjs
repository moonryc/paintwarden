import assert from "node:assert/strict";
import path from "node:path";
import { expect as playwrightExpect } from "playwright/test";

const expect = playwrightExpect.configure({ timeout: 12_000 });
// All production FilterToolbar usages (Home has two routes). Keep expected counts
// explicit so a missing/hidden label cannot silently shrink this regression's scope.
const routes = [
  { name: "Workbench", slug: "workbench", labels: 1 },
  { name: "Miniatures", slug: "miniatures", labels: 1 },
  { name: "Paints", slug: "paints", labels: 3 },
  { name: "Schemes", slug: "schemes", labels: 4 },
  { name: "Templates", slug: "templates", labels: 2 },
];

async function navigate(page, name) {
  let button = page.getByRole("button", { name, exact: true });
  if (!(await button.isVisible())) {
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    button = page.getByRole("button", { name, exact: true });
  }
  await button.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    // Allow scroll-triggered React updates and the compositor to reach the observer.
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
}

async function geometry(page) {
  return page.evaluate(() => {
    const toolbar = document.querySelector("[data-filter-toolbar]");
    const header = document.querySelector("main > header");
    const rect = (element) => {
      const { top, bottom, left, right, width, height } = element.getBoundingClientRect();
      return { top, bottom, left, right, width, height };
    };
    const labels = [...toolbar.querySelectorAll(".MuiInputLabel-root")].map((label) => {
      const bounds = rect(label);
      // MUI labels normally ignore pointer events. Temporarily enable hit-testing
      // without changing layout: this detects ancestor clipping AND occlusion by
      // the header/title strip, unlike Playwright's visibility check alone.
      const previous = label.style.getPropertyValue("pointer-events");
      const priority = label.style.getPropertyPriority("pointer-events");
      label.style.setProperty("pointer-events", "auto", "important");
      let uncovered;
      try {
        uncovered = [0.1, 0.5, 0.9].every((x) =>
          [1, bounds.height / 2, bounds.height - 1].every((y) => {
            const hit = document.elementFromPoint(bounds.left + bounds.width * x, bounds.top + y);
            return hit === label || label.contains(hit);
          }),
        );
      } finally {
        if (previous) label.style.setProperty("pointer-events", previous, priority);
        else label.style.removeProperty("pointer-events");
      }
      const style = getComputedStyle(label);
      return {
        text: label.textContent,
        bounds,
        uncovered,
        visible: style.display !== "none" && style.visibility === "visible" && Number(style.opacity) > 0,
      };
    });
    return {
      scrollY,
      toolbar: rect(toolbar),
      position: getComputedStyle(toolbar).position,
      header: rect(header),
      viewport: { width: innerWidth, height: innerHeight },
      overflow: [document.documentElement, document.body, document.querySelector("main"), toolbar].map(
        (element) => ({ name: element.tagName, client: element.clientWidth, scroll: element.scrollWidth }),
      ),
      labels,
    };
  });
}

function assertGeometry(sample, route, width) {
  const context = `${route.name} ${width}px at scrollY=${sample.scrollY}`;
  assert.equal(sample.position, "sticky", `${context}: real sticky toolbar`);
  assert.ok(
    sample.toolbar.top >= sample.header.bottom,
    `${context}: toolbar top ${sample.toolbar.top} must clear header bottom ${sample.header.bottom}`,
  );
  assert.equal(sample.labels.length, route.labels, `${context}: all filter labels present`);
  for (const label of sample.labels) {
    assert.ok(
      label.visible && label.uncovered,
      `${context}: label ${JSON.stringify(label.text)} must be visible, unclipped and nonoccluded`,
    );
    assert.ok(label.bounds.top >= sample.header.bottom, `${context}: ${label.text} clears header`);
    assert.ok(
      label.bounds.left >= 0 &&
        label.bounds.right <= sample.viewport.width &&
        label.bounds.bottom <= sample.viewport.height,
      `${context}: ${label.text} fits viewport`,
    );
  }
  for (const area of sample.overflow)
    assert.ok(
      area.scroll <= area.client,
      `${context}: no horizontal overflow in ${area.name} (${area.scroll}/${area.client})`,
    );
}

async function checkPopup({ page, anchor, popup, screenshot, kind }) {
  const element = await anchor.elementHandle();
  await anchor.click();
  await expect(popup).toBeVisible();
  await popup.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {})),
    );
  });
  await settle(page);
  const trigger = await element.evaluate((element) => {
    const bounds = (element.closest(".MuiInputBase-root") ?? element).getBoundingClientRect();
    return { top: bounds.top, bottom: bounds.bottom };
  });
  const bounds = await popup.boundingBox();
  assert.ok(bounds, `${kind} popup bounds`);
  const gapBelow = Math.abs(bounds.y - trigger.bottom);
  const gapAbove = Math.abs(trigger.top - (bounds.y + bounds.height));
  await page.screenshot({ path: screenshot, animations: "disabled" });
  assert.ok(
    Math.min(gapBelow, gapAbove) <= 4,
    `${kind}: popup must adjoin anchor (below gap ${gapBelow}px, above gap ${gapAbove}px)`,
  );
  await page.keyboard.press("Escape");
  await expect(popup).toBeHidden();
  return { kind, trigger, popup: bounds, gapBelow, gapAbove, screenshot };
}

async function assertOverlay({ page, surface, artifacts, name, width, fullScreen = false }) {
  await expect(surface).toBeVisible();
  await surface.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {})),
    );
  });
  await settle(page);
  const viewport = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    title:
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--desktop-titlebar-height")) ||
      0,
  }));
  const bounds = await surface.boundingBox();
  const screenshot = path.join(artifacts, `sticky-${name}-${width}.png`);
  await page.screenshot({ path: screenshot, animations: "disabled" });
  assert.ok(bounds && bounds.y >= viewport.title, `${name} ${width}px: surface clears native title strip`);
  assert.ok(
    bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1,
    `${name}: no horizontal overflow`,
  );
  assert.ok(bounds.y + bounds.height <= viewport.height + 1, `${name}: surface fits viewport vertically`);
  if (fullScreen) {
    assert.equal(
      bounds.y,
      viewport.title,
      `${name}: fullScreen surface starts immediately below title strip`,
    );
    assert.equal(
      bounds.y + bounds.height,
      viewport.height,
      `${name}: fullScreen surface reaches viewport bottom`,
    );
  }
  return { name, width, bounds, viewport, screenshot };
}

async function checkOverlays({ page, artifacts, resize }) {
  const evidence = [];
  for (const width of [1440, 390]) {
    if (resize) await resize(width);
    else await page.setViewportSize({ width, height: 1000 });
    await navigate(page, "Miniatures");
    if (width < 1024) {
      await page.getByRole("button", { name: "Open navigation", exact: true }).click();
      evidence.push(
        await assertOverlay({
          page,
          surface: page.locator(".MuiDrawer-paper"),
          artifacts,
          name: "navigation-drawer",
          width,
          fullScreen: true,
        }),
      );
      await page.getByRole("button", { name: "Close navigation", exact: true }).click();
      await expect(page.locator(".MuiDrawer-paper")).toHaveCount(0);
    }
    const folderView = page.getByRole("button", { name: "Folder view", exact: true });
    await folderView.click();
    await folderView.hover();
    evidence.push(
      await assertOverlay({ page, surface: page.getByRole("tooltip"), artifacts, name: "tooltip", width }),
    );
    await page.mouse.move(0, 0);
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    const edit = page.getByRole("button", { name: "Select items", exact: true });
    if ((await edit.getAttribute("aria-pressed")) !== "true") await edit.click();
    await page.getByRole("button", { name: "Add folder", exact: true }).click();
    const folder = page.getByRole("dialog", { name: "Create folder", exact: true });
    const folderName = `Synthetic sticky overlay folder ${width}`;
    await folder.getByRole("textbox", { name: "Name", exact: true }).fill(folderName);
    await folder.getByRole("button", { name: "Save", exact: true }).click();
    await expect(folder).toHaveCount(0);
    const actions = page.getByRole("button", { name: `Actions for ${folderName}`, exact: true });
    evidence.push(
      await checkPopup({
        page,
        anchor: actions,
        popup: page.locator(".MuiMenu-paper"),
        screenshot: path.join(artifacts, `sticky-context-menu-${width}.png`),
        kind: `FolderTile context Menu ${width}px`,
      }),
    );
    // Remove the synthetic folder immediately; default browser smoke snapshots
    // must not inherit catalog/project entities from these layout checks.
    await actions.click();
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    const deletion = page.getByRole("dialog", { name: "Delete folder", exact: true });
    await deletion.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(deletion).toHaveCount(0);
    await expect(page.getByTitle(`Open ${folderName}`, { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Add miniature", exact: true }).click();
    const form = page.getByRole("dialog", { name: "Add a miniature", exact: true });
    if (width < 640) await expect(form).toHaveClass(/MuiDialog-paperFullScreen/);
    evidence.push(
      await assertOverlay({
        page,
        surface: form,
        artifacts,
        name: "miniature-dialog",
        width,
        fullScreen: width < 640,
      }),
    );
    const miniatureName = `Synthetic sticky overlay miniature ${width}`;
    await form.getByRole("textbox", { name: /^Name/ }).fill(miniatureName);
    await form.locator("button[type=submit]").click();
    await page.getByRole("button", { name: "Close project", exact: true }).click();
    if ((await edit.getAttribute("aria-pressed")) !== "true") await edit.click();
    await page.getByRole("checkbox", { name: `Select ${miniatureName}`, exact: true }).check();
    await page.getByRole("button", { name: "Delete 1", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "Delete 1 miniature", exact: true });
    await confirm.getByRole("button", { name: "Delete 1 miniature", exact: true }).click();
    await expect(confirm).toHaveCount(0);
    const snackbar = page.locator("[data-content-snackbar]");
    await expect(snackbar).toContainText("Deleted 1 item");
    evidence.push(await assertOverlay({ page, surface: snackbar, artifacts, name: "snackbar", width }));
    await snackbar.getByRole("button", { name: "Close", exact: true }).click();
    await expect(snackbar).toHaveCount(0);
    await expect(page.getByText(miniatureName, { exact: true })).toHaveCount(0);
  }
  return evidence;
}

/** Same real-UI assertions in production Chromium and the hidden packaged app.
 * Uses the smoke's disposable authenticated vault; no mocks or personal data.
 * A test-only spacer supplies scroll runway without altering sticky positioning.
 */
export async function runStickyToolbarFlow({ page, artifacts, resize }) {
  const evidence = { pages: [], popups: [] };
  const originalViewport = page.viewportSize();
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    // 900 exercises the below-lg/tablet branch; 390 also exercises stacked filters.
    for (const width of [1440, 900, 390]) {
      if (resize) await resize(width);
      else await page.setViewportSize({ width, height: 1000 });
      for (const route of routes) {
        await navigate(page, route.name);
        const toolbar = page.locator("[data-filter-toolbar]");
        await expect(toolbar).toHaveCount(1);
        await expect(toolbar).toBeVisible();
        await expect(toolbar.locator(".MuiInputLabel-root")).toHaveCount(route.labels);
        await expect(toolbar.locator(".Mui-disabled")).toHaveCount(0);
        await expect(page.locator('main [aria-busy="true"], main [data-skeleton]')).toHaveCount(0);
        const screenshot = path.join(artifacts, `sticky-toolbar-${route.slug}-${width}.png`);
        const entry = { page: route.name, width, screenshot, samples: [] };
        evidence.pages.push(entry);
        try {
          const threshold = await toolbar.evaluate((element) => {
            window.scrollTo({ top: 0, behavior: "instant" });
            const spacer = document.createElement("div");
            spacer.dataset.stickyToolbarSpacer = "";
            spacer.setAttribute("aria-hidden", "true");
            spacer.style.cssText = "height: 2400px; width: 1px; pointer-events: none;";
            // Home's toolbar lives inside a section: a body-level spacer would
            // not lengthen its sticky containing block and gives false failures.
            element.parentElement.append(spacer);
            return Math.ceil(element.getBoundingClientRect().top);
          });
          await settle(page);
          await page.evaluate(() => {
            if (!PerformanceObserver.supportedEntryTypes.includes("layout-shift"))
              throw new Error("Chromium layout-shift observer required");
            window.__stickyToolbarShifts = [];
            window.__stickyToolbarObserver = new PerformanceObserver((list) => {
              for (const shift of list.getEntries())
                window.__stickyToolbarShifts.push({
                  value: shift.value,
                  hadRecentInput: shift.hadRecentInput,
                });
            });
            // No buffered startup entries; measure only this actual scroll sequence.
            window.__stickyToolbarObserver.observe({ type: "layout-shift", buffered: false });
          });
          for (const y of [threshold + 80, threshold + 240, threshold + 480, threshold + 160, 0]) {
            await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
            await settle(page);
            const sample = await geometry(page);
            entry.samples.push(sample);
            assert.equal(sample.scrollY, y, `${route.name}: fixture must actually scroll to ${y}`);
            assertGeometry(sample, route, width);
          }
          const stickyTops = entry.samples.slice(0, 4).map((sample) => sample.toolbar.top);
          assert.ok(
            Math.max(...stickyTops) - Math.min(...stickyTops) <= 1,
            `${route.name}: toolbar remains pinned during down/up scroll`,
          );
          entry.layoutShifts = await page.evaluate(() => {
            for (const shift of window.__stickyToolbarObserver.takeRecords())
              window.__stickyToolbarShifts.push({ value: shift.value, hadRecentInput: shift.hadRecentInput });
            window.__stickyToolbarObserver.disconnect();
            return window.__stickyToolbarShifts;
          });
          // Stronger than CLS: also count entries marked hadRecentInput, so UI
          // navigation cannot mask a scroll-induced regression behind its 500ms grace.
          entry.cls = entry.layoutShifts.reduce((sum, shift) => sum + shift.value, 0);
          assert.equal(entry.cls, 0, `${route.name} ${width}px: zero layout shift during scrolling`);
          await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), threshold + 240);
          await settle(page);
          await page.screenshot({ path: screenshot, animations: "disabled" });

          if (route.slug === "paints") {
            evidence.popups.push(
              await checkPopup({
                page,
                anchor: toolbar.getByRole("combobox", { name: "Plugin", exact: true }),
                popup: page.locator(".MuiMenu-paper"),
                screenshot: path.join(artifacts, `sticky-select-${width}.png`),
                kind: `Select ${width}px`,
              }),
            );
          }
          if (route.slug === "schemes") {
            evidence.popups.push(
              await checkPopup({
                page,
                anchor: toolbar.getByRole("combobox", { name: "Uses paints", exact: true }),
                // Empty real catalogs show No options rather than a listbox. The
                // actual Popper paper still has the production positioning rules.
                popup: page.locator(".MuiAutocomplete-popper .MuiAutocomplete-paper"),
                screenshot: path.join(artifacts, `sticky-autocomplete-${width}.png`),
                kind: `Autocomplete ${width}px`,
              }),
            );
          }
        } catch (error) {
          await page.screenshot({ path: screenshot, animations: "disabled" }).catch(() => {});
          throw error;
        } finally {
          await page.evaluate(() => {
            window.__stickyToolbarObserver?.disconnect();
            document.querySelectorAll("[data-sticky-toolbar-spacer]").forEach((element) => element.remove());
            window.scrollTo({ top: 0, behavior: "instant" });
          });
        }
      }
    }
    evidence.overlays = await checkOverlays({ page, artifacts, resize });
  } finally {
    if (resize) await resize(1440);
    else if (originalViewport) await page.setViewportSize(originalViewport);
  }
  await navigate(page, "Workbench");
  return evidence;
}
