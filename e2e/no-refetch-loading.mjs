import assert from "node:assert/strict";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { expect as playwrightExpect } from "playwright/test";

const expect = playwrightExpect.configure({ timeout: 12_000 });
async function graphql(page, query, variables = {}) {
  const response = await page.request.post(new URL("/api/graphql", page.url()).href, {
    data: { query, variables },
  });
  assert.equal(response.status(), 200, await response.text());
  const body = await response.json();
  assert.equal(body.errors, undefined, JSON.stringify(body.errors));
  return body.data;
}

async function observePage(page, title, drawerPaint) {
  await expect(page.locator(".MuiSkeleton-root")).toHaveCount(0);
  // Observe the actual production DOM, including content behind overlays. Retain
  // element references, not selectors: replacing an identical node must fail.
  await page.evaluate(
    ({ title, drawerPaint }) => {
      const heading = document.querySelector("main h1");
      const tile = [...document.querySelectorAll("main *")].find(
        (el) => el.textContent === title && el.children.length === 0,
      );
      if (!heading || !tile) throw Error("Visible page sentinels missing");
      const sentinels = [heading, tile];
      if (drawerPaint) {
        const checklist = [...document.querySelectorAll('[role="dialog"] section ul')].find((el) =>
          el.textContent.includes(drawerPaint),
        );
        if (!checklist) throw Error("Expanded drawer Missing paints checklist sentinel missing");
        sentinels.push(checklist);
      }
      const state = { skeletons: 0, disconnected: false, records: [], pageLoadingMessages: [] };
      window.__noRefetch = state;
      state.observer = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (!(node instanceof Element)) continue;
            const count =
              Number(node.matches(".MuiSkeleton-root")) + node.querySelectorAll(".MuiSkeleton-root").length;
            state.skeletons += count;
            if (count) state.records.push({ count, parent: record.target.nodeName, time: performance.now() });
          }
          // Also detect a removal/reinsertion within the same observer batch.
          for (const node of record.removedNodes) {
            if (sentinels.some((sentinel) => node === sentinel || node.contains(sentinel)))
              state.disconnected = true;
          }
        }
        state.disconnected ||= sentinels.some((el) => !el.isConnected);
        for (const status of document.querySelectorAll('main [role="status"]')) {
          const text = status.textContent.trim();
          if (
            /^(?:Loading|Updating) (?:miniatures|paints|wishlist)/.test(text) &&
            !state.pageLoadingMessages.includes(text)
          )
            state.pageLoadingMessages.push(text);
        }
      });
      state.observer.observe(document.body, { childList: true, subtree: true });
      state.sentinels = sentinels;
    },
    { title, drawerPaint },
  );
}

async function finishObservation(page) {
  return page.evaluate(() => {
    const state = window.__noRefetch;
    state.observer.disconnect();
    return {
      skeletons: state.skeletons,
      disconnected: state.disconnected || state.sentinels.some((el) => !el.isConnected),
      records: state.records,
      pageLoadingMessages: state.pageLoadingMessages,
    };
  });
}

// Every record is synthetic and created with the authenticated real API. Only
// query latency is added (250ms); responses and invalidation transport are real.
export async function checkNoRefetchLoading({
  page,
  miniatureId,
  title,
  artifacts,
  results,
  assertRetention = true,
}) {
  const paintName = "Synthetic missing crimson";
  const schemeName = "Synthetic steady scheme";
  await graphql(
    page,
    `
      mutation {
        importCustomPaints(
          paints: [{ name: "Synthetic missing crimson", brand: "Synthetic studio", colorHex: "#B73142" }]
        ) {
          imported
        }
      }
    `,
  );
  const data = await graphql(
    page,
    `
      query {
        library(first: 100) {
          nodes {
            id
            name
          }
        }
      }
    `,
  );
  const paintId = data.library.nodes.find((paint) => paint.name === paintName).id;
  await graphql(
    page,
    `
      mutation ($id: ID!, $paint: ID!) {
        setMiniatureRecipe(id: $id, entries: [{ paintId: $paint, step: "BASECOAT" }], steps: ["BASECOAT"]) {
          miniatureId
        }
      }
    `,
    { id: miniatureId, paint: paintId },
  );
  const seeded = await graphql(
    page,
    `
      mutation ($paint: ID!) {
        createScheme(
          input: {
            name: "Synthetic steady scheme"
            category: "BLUE"
            entries: [{ type: DIVIDER, label: "BASECOAT", tone: "SECTION" }, { type: PAINT, paintId: $paint }]
          }
        ) {
          schemeId
        }
      }
    `,
    { paint: paintId },
  );
  await expect(page.getByText(`Added ${title}`, { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Workbench", exact: true }).click();
  await page.getByRole("heading", { name: "Workbench", level: 1, exact: true }).waitFor();
  const missingWishlistCount = page
    .locator("main button")
    .filter({ hasText: "Missing paints on wishlist" })
    .locator("b");
  await expect(missingWishlistCount).toHaveText("0 / 1");
  await page.getByText(title, { exact: true }).click();
  const drawer = page.getByRole("dialog", { name: title, exact: true });
  await expect(
    drawer.getByRole("button", { name: `Add ${paintName} to wishlist`, exact: true }),
  ).toBeVisible();

  const requests = new Set();
  let completedQueries = 0;
  const started = (request) => {
    if (request.url().endsWith("/api/graphql") && !/^\s*mutation\b/.test(request.postDataJSON()?.query ?? ""))
      requests.add(request);
  };
  const finished = (request) => {
    if (requests.delete(request)) completedQueries++;
  };
  page.on("request", started);
  page.on("requestfinished", finished);
  page.on("requestfailed", finished);
  let rejectBackgroundRead = false;
  let injectedFailures = 0;
  const delayQueries = async (route) => {
    const body = route.request().postDataJSON();
    if (!/^\s*mutation\b/.test(body?.query ?? "")) await new Promise((resolve) => setTimeout(resolve, 250));
    if (rejectBackgroundRead && body?.operationName === "MiniatureList") {
      injectedFailures++;
      await route.fulfill({
        status: 429,
        headers: {
          "content-type": "application/json",
          "x-paintwarden-e2e-expected": "background-rate-limit",
        },
        body: JSON.stringify({
          errors: [
            {
              message: "Synthetic background rate limit",
              extensions: {
                code: "RATE_LIMITED",
                errorCode: "TOO_MANY_GRAPHQL_OPERATIONS",
                errorParameters: {},
              },
            },
          ],
        }),
      });
      return;
    }
    await route.continue();
  };
  await page.route("**/api/graphql", delayQueries);
  results.noRefetchLoading = {};
  async function action(name, operationName, act, verify, sentinelTitle = title) {
    await expect.poll(() => requests.size).toBe(0);
    await observePage(page, sentinelTitle, name === "wishlist" ? paintName : undefined);
    await page.screenshot({ path: path.join(artifacts, `${name}-before.png`), animations: "disabled" });
    const before = completedQueries;
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/graphql") &&
        response.request().postDataJSON()?.operationName === operationName,
    );
    await act();
    const response = await responsePromise;
    const body = await response.json();
    assert.equal(body.errors, undefined, JSON.stringify(body.errors));
    const payload = Object.values(body.data)[0];
    await expect.poll(() => requests.size).toBeGreaterThan(0);
    await page.screenshot({ path: path.join(artifacts, `${name}-pending.png`), animations: "disabled" });
    // Wait for SSE delivery and resulting query completion, not a fixed sleep or
    // just the optimistic inventory state. Short flashes remain in the observer.
    await page.waitForFunction(
      (revision) =>
        window.__browserE2E.events.some(
          (event) =>
            event.data?.vaultChanges?.epoch === revision.epoch &&
            BigInt(event.data.vaultChanges.seq) >= BigInt(revision.seq),
        ),
      payload.revision,
    );
    await expect.poll(() => completedQueries).toBeGreaterThan(before);
    await expect.poll(() => requests.size).toBe(0);
    await verify();
    await page.screenshot({ path: path.join(artifacts, `${name}-after.png`), animations: "disabled" });
    const observed = await finishObservation(page);
    observed.completedQueries = completedQueries - before;
    if (name === "background-error") observed.injectedHttp429 = injectedFailures;
    results.noRefetchLoading[name] = observed;
    await writeFile(
      path.join(artifacts, "no-refetch-observations.json"),
      JSON.stringify(results.noRefetchLoading, null, 2),
    );
    if (assertRetention) {
      assert.deepEqual(
        observed.pageLoadingMessages,
        [],
        `${name} refetch must not show partial page loading text`,
      );
      assert.equal(observed.skeletons, 0, `${name} refetch must not add loading skeletons`);
      assert.equal(observed.disconnected, false, `${name} refetch must retain the visible page DOM`);
    }
    results.checks.push(
      `${assertRetention ? "PASS" : "OBSERVED"} ${name}: real mutation + SSE refetch DOM observation`,
    );
  }
  try {
    await drawer.getByRole("button", { name: /1 paint to gather/ }).click();
    await action(
      "wishlist",
      "SetPaintStock",
      () =>
        drawer
          .getByRole("button", { name: `Add ${paintName} to wishlist`, exact: true })
          .first()
          .click(),
      async () => {
        await expect(
          drawer.getByRole("button", { name: `Remove ${paintName} from wishlist`, exact: true }).first(),
        ).toBeVisible();
        await expect(missingWishlistCount).toHaveText("1 / 1");
      },
    );
    await drawer.getByRole("button", { name: "Close project", exact: true }).click();
    await page.getByRole("button", { name: "Miniatures", exact: true }).click();
    await page.getByRole("heading", { name: "Miniatures", level: 1, exact: true }).waitFor();
    await page.getByText(title, { exact: true }).click();
    await drawer.getByText(paintName, { exact: true }).first().click();
    const paintDialog = page.getByRole("dialog", { name: paintName, exact: true });
    await expect(paintDialog.getByRole("button", { name: "Owned", exact: true })).toBeEnabled();
    await action(
      "stock",
      "SetPaintStock",
      () => paintDialog.getByRole("button", { name: "Owned", exact: true }).click(),
      () => expect(paintDialog.getByText("Bottles on hand", { exact: true })).toBeVisible(),
    );
    await paintDialog.getByRole("button", { name: "Close", exact: true }).click();
    await drawer.getByRole("button", { name: "Edit recipe", exact: true }).click();
    await drawer.getByRole("button", { name: "Add a step", exact: true }).click();
    await action(
      "recipe",
      "SetProjectRecipe",
      () => drawer.getByRole("button", { name: "Confirm", exact: true }).click(),
      () => expect(drawer.getByRole("button", { name: "Done", exact: true })).toBeVisible(),
    );
    await drawer.getByRole("button", { name: "Add Scheme", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "Color schemes", exact: true });
    await picker.getByRole("button", { name: schemeName, exact: true }).click();
    await action(
      "scheme-attach",
      "SetProjectSchemes",
      () => picker.getByRole("button", { name: "Add scheme", exact: true }).click(),
      async () => {
        await expect(picker).toBeHidden();
        await expect(drawer.getByText(schemeName, { exact: true })).toBeVisible();
      },
    );
    const persisted = await graphql(
      page,
      `query($id: ID!) { miniature(id: $id) { recipeSteps schemes(first: 40) { nodes { scheme { id } } } } paint(id: "${paintId}") { paint { inventory { state quantity } } } }`,
      { id: miniatureId },
    );
    assert.ok(persisted.miniature.recipeSteps.length > 1, "Recipe edit persisted an additional step");
    assert.ok(
      persisted.miniature.schemes.nodes.some((row) => row.scheme.id === seeded.createScheme.schemeId),
    );
    assert.equal(persisted.paint.paint.inventory.state, "OWNED");
    await drawer.getByRole("button", { name: "Done", exact: true }).click();
    await drawer.getByText(paintName, { exact: true }).first().click();
    await expect(paintDialog.getByRole("button", { name: "Wishlist", exact: true })).toBeEnabled();
    rejectBackgroundRead = true;
    await action(
      "background-error",
      "SetPaintStock",
      () => paintDialog.getByRole("button", { name: "Wishlist", exact: true }).click(),
      async () => {
        assert.ok(injectedFailures > 0, "A loaded page refetch actually received HTTP 429");
      },
    );
    results.checks.push(
      "PASS failed background read retains existing miniature content (intentional HTTP 429)",
    );
    rejectBackgroundRead = false;
    await action(
      "background-recovery",
      "SetPaintStock",
      () => paintDialog.getByRole("button", { name: "Owned", exact: true }).click(),
      () => expect(paintDialog.getByText("Bottles on hand", { exact: true })).toBeVisible(),
    );
    await action(
      "wishlist-prepare",
      "SetPaintStock",
      () => paintDialog.getByRole("button", { name: "Wishlist", exact: true }).click(),
      () =>
        expect(paintDialog.getByRole("button", { name: "Wishlist", exact: true })).toHaveAttribute(
          "aria-pressed",
          "true",
        ),
    );
    await paintDialog.getByRole("button", { name: "Close", exact: true }).click();
    await drawer.getByRole("button", { name: "Close project", exact: true }).click();
    await page.getByRole("button", { name: /^Wishlist(?:\s+\d+)?$/ }).click();
    await page.getByRole("heading", { name: "Wishlist", level: 1, exact: true }).waitFor();
    await expect(
      page.getByRole("button", { name: `Mark ${paintName} as bought`, exact: true }),
    ).toBeVisible();
    await action(
      "wishlist-page-stock",
      "SetPaintStock",
      () => page.getByRole("button", { name: `Mark ${paintName} as bought`, exact: true }).click(),
      () =>
        expect(
          page.getByRole("button", { name: `Increase ${paintName} quantity`, exact: true }),
        ).toBeVisible(),
      paintName,
    );
  } finally {
    await page.unroute("**/api/graphql", delayQueries);
    page.off("request", started);
    page.off("requestfinished", finished);
    page.off("requestfailed", finished);
  }
}
