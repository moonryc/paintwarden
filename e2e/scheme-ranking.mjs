import assert from "node:assert/strict";
import path from "node:path";
import { expect as playwrightExpect } from "playwright/test";

const expect = playwrightExpect.configure({ timeout: 12_000 });

async function graphql(page, query, variables = {}) {
  const response = await page.request.post("/api/graphql", { data: { query, variables } });
  assert.equal(response.status(), 200);
  const body = await response.json();
  assert.equal(body.errors, undefined, JSON.stringify(body.errors));
  return body.data;
}

// Every paint/name/photo in this flow is synthetic. Seed through the real authenticated
// GraphQL commands, then exercise the production UI/transport, not mocked responses.
export async function checkSchemeRanking({ page, miniatureId, title, artifacts, results }) {
  await expect(page.getByText(`Added ${title}`, { exact: true })).toBeHidden();
  await page.getByText(title, { exact: true }).click();
  const scanEntry = page.getByRole("button", { name: /Swatch Scan.*Beta/ });
  // This fixture has no recipe rows, explicit steps or schemes yet. Enter directly
  // from its zero state; entering edit mode would miss the first-paint regression.
  await expect(page.getByText("No paints assigned yet", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit recipe", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Swatch Scan Beta", exact: true })).toBeEnabled();
  await scanEntry.click();
  const dialog = page.getByRole("dialog", { name: "Swatch Scan", exact: true });
  const photo = dialog.getByRole("img", { name: title, exact: true });
  await expect(dialog.getByRole("button", { name: "Sample at crosshair" })).toBeEnabled();
  const box = await photo.boundingBox();
  assert.ok(box);
  const samples = [];
  for (const fraction of [0.25, 0.75]) {
    await page.mouse.click(box.x + box.width * fraction, box.y + box.height / 2);
    const sampled = await dialog.getByRole("heading", { name: /^Sampled color:/ }).innerText();
    samples.push(sampled.match(/#[\da-f]{6}/i)[0]);
  }
  assert.notEqual(samples[0], samples[1]);
  const near = (hex) =>
    `#${(parseInt(hex.slice(1, 3), 16) + 8).toString(16).padStart(2, "0")}${hex.slice(3)}`;
  const paints = [
    { name: "Standalone nearest blue", colorHex: samples[0] },
    { name: "Standalone nearest red", colorHex: samples[1] },
    { name: "Scheme blue suggestion", colorHex: near(samples[0]) },
    { name: "Scheme red suggestion", colorHex: near(samples[1]) },
    { name: "Scheme ivory", colorHex: "#FFFFFF" },
    { name: "Uncolored scheme paint", colorHex: null },
  ].map((paint) => ({ ...paint, brand: "Synthetic studio" }));
  const imported = await graphql(
    page,
    `
      mutation Seed($paints: [CustomPaintImportInput!]!) {
        importCustomPaints(paints: $paints) {
          imported
        }
      }
    `,
    { paints },
  );
  assert.equal(imported.importCustomPaints.imported, paints.length);
  const colors = await graphql(
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
  const ids = new Map(colors.library.nodes.map((paint) => [paint.name, paint.id]));
  // Seed only after measuring the synthetic photo so the closest result is exact.
  // Assign the first paint while still in the zero-state scan session, before any
  // scheme is attached or Edit recipe is clicked.
  const initialPins = dialog.getByRole("list", { name: "Sample pins" });
  await initialPins.getByRole("button").first().click();
  const initialPaintList = dialog.getByRole("list", { name: "Closest paint matches" });
  const firstMatch = initialPaintList.getByRole("listitem").first();
  await expect(firstMatch).toContainText("Standalone nearest blue");
  await firstMatch.getByRole("button", { name: "Assign", exact: true }).click();
  const assign = page.getByRole("dialog", { name: "Assign paint to recipe", exact: true });
  await expect(assign.getByRole("combobox", { name: "Recipe step", exact: true })).toHaveText("New step");
  await expect(assign.getByRole("combobox", { name: "Stage", exact: true })).toHaveText("Basecoat");
  await assign.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(assign).toBeHidden();
  const assigned = await graphql(
    page,
    `
      query VerifyFirstPaint($id: ID!) {
        miniature(id: $id) {
          recipeSteps
          recipe(first: 40) {
            nodes {
              paint {
                id
              }
              step
              notes
              sortOrder
            }
          }
          schemes(first: 40) {
            totalCount
          }
        }
      }
    `,
    { id: miniatureId },
  );
  assert.deepEqual(assigned.miniature.recipeSteps, ["BASECOAT"]);
  assert.deepEqual(assigned.miniature.recipe.nodes, [
    { paint: { id: ids.get("Standalone nearest blue") }, step: "BASECOAT", notes: "", sortOrder: 0 },
  ]);
  assert.equal(assigned.miniature.schemes.totalCount, 0);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit recipe", exact: true })).toBeVisible();
  await expect(page.getByText("No paints assigned yet", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Swatch Scan/ })).toHaveCount(0);
  // Reopen the drawer to prove the first paint and step survived saving.
  await page.getByRole("button", { name: "Close project", exact: true }).click();
  await page.getByText(title, { exact: true }).click();
  await expect(page.getByText("Standalone nearest blue", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Swatch Scan/ })).toHaveCount(0);
  results.checks.push(
    "PASS zero-state scan assigns and persists the first paint and Basecoat step without Edit recipe",
  );
  // Continue the existing edit-mode ranking checks with a fresh two-pin session.
  await page.getByRole("button", { name: "Edit recipe", exact: true }).click();
  await expect(scanEntry).toBeEnabled();
  await expect(scanEntry).toContainText("Find paints from your miniature’s photo");
  await scanEntry.click();
  await expect(dialog.getByRole("button", { name: "Sample at crosshair" })).toBeEnabled();
  const reopenedBox = await photo.boundingBox();
  assert.ok(reopenedBox);
  for (const fraction of [0.25, 0.75]) {
    await page.mouse.click(
      reopenedBox.x + reopenedBox.width * fraction,
      reopenedBox.y + reopenedBox.height / 2,
    );
  }

  // A scheme with paints but no usable hex must be omitted.
  async function scheme(name, paintNames) {
    const data = await graphql(
      page,
      `
        mutation SeedScheme($input: SchemeInput!) {
          createScheme(input: $input) {
            schemeId
          }
        }
      `,
      {
        input: {
          name,
          category: "BLUE",
          entries: [
            { type: "DIVIDER", label: "BASECOAT", tone: "SECTION" },
            ...paintNames.map((name) => ({ type: "PAINT", paintId: ids.get(name) })),
          ],
        },
      },
    );
    return data.createScheme.schemeId;
  }
  const blueId = await scheme("Blue ranked scheme", ["Scheme blue suggestion", "Scheme ivory"]);
  const redId = await scheme("Red ranked scheme", ["Scheme red suggestion"]);
  const existingId = await scheme("Existing attached scheme", ["Scheme blue suggestion"]);
  await scheme("Uncolored scheme is hidden", ["Uncolored scheme paint"]);
  for (let i = 0; i < 9; i++) await scheme(`Trailing red scheme ${i}`, ["Scheme red suggestion"]);
  await graphql(
    page,
    `
      mutation Attach($id: ID!, $schemeIds: [ID!]!) {
        setMiniatureSchemes(id: $id, schemeIds: $schemeIds) {
          miniatureId
        }
      }
    `,
    { id: miniatureId, schemeIds: [existingId] },
  );

  const pins = dialog.getByRole("list", { name: "Sample pins" });
  const selectPin = async (index) => {
    await pins.getByRole("button").nth(index).click();
    await expect(pins.getByRole("button").nth(index)).toHaveAttribute("aria-pressed", "true");
  };
  const list = dialog.getByRole("list", { name: "Closest scheme matches" });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1050 });
    if (width === 390) {
      // ProjectDrawer switches its responsive host at this breakpoint, remounting the
      // session-only scan. Start the same two-pin session in the phone presentation.
      await expect(pins.getByRole("button")).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: "Sample at crosshair" })).toBeEnabled();
      const mobileBox = await photo.boundingBox();
      assert.ok(mobileBox);
      for (const fraction of [0.25, 0.75]) {
        await page.mouse.click(mobileBox.x + mobileBox.width * fraction, mobileBox.y + mobileBox.height / 2);
      }
      await expect(pins.getByRole("button")).toHaveCount(2);
    }
    await selectPin(0);
    await dialog.getByRole("button", { name: "By paint", exact: true }).click();
    const paintList = dialog.getByRole("list", { name: "Closest paint matches" });
    await expect(paintList.getByRole("listitem").first()).toContainText("Standalone nearest blue");
    await dialog.getByRole("button", { name: "By scheme", exact: true }).click();
    await expect(list.getByRole("listitem")).toHaveCount(10);
    const best = list.getByRole("listitem").first();
    await expect(best.getByRole("heading")).toHaveText("Blue ranked scheme");
    await expect(best).toContainText("Scheme blue suggestion");
    await expect(best).toContainText("Synthetic studio");
    await expect(best).toContainText(/Near-exact|Very close|Similar|Loose match/);
    await expect(best).toContainText(/ΔE/);
    await expect(list.getByText("Standalone nearest blue", { exact: true })).toHaveCount(0);
    await expect(dialog.getByText("Closest paint", { exact: true })).toHaveCount(0);
    await expect(list.getByText("Uncolored scheme is hidden", { exact: true })).toHaveCount(0);
    assert.equal(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
    if (width === 390) await best.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, `scheme-rank-${width}.png`), animations: "disabled" });
    await dialog.getByRole("button", { name: "More schemes", exact: true }).click();
    await expect(list.getByRole("listitem")).toHaveCount(12);
    await expect(dialog.getByRole("button", { name: "More schemes", exact: true })).toHaveCount(0);
    const existing = list
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: "Existing attached scheme", exact: true }) });
    await expect(existing.getByRole("button", { name: "Attach scheme" })).toBeDisabled();
    // Red selects a different best scheme. Moving back to blue must restore blue,
    // not blend all pins or use the most recent sample.
    await selectPin(1);
    await expect(list.getByRole("listitem").first()).toContainText("Scheme red suggestion");
    await expect(list.getByRole("listitem").first().getByRole("heading")).toHaveText("Red ranked scheme");
    await expect(list.getByRole("listitem")).toHaveCount(10);
    await selectPin(0);
    await expect(list.getByRole("listitem").first()).toContainText("Scheme blue suggestion");
    results.checks.push(
      `PASS selected-pin direct scheme ranking, paint highlight, tie order, paging and no overflow at ${width}`,
    );
  }
  await list.getByRole("listitem").first().getByRole("button", { name: "Attach scheme" }).click();
  await expect(
    list.getByRole("listitem").first().getByRole("button", { name: "Attach scheme" }),
  ).toBeDisabled();
  const attached = await graphql(
    page,
    `
      query Verify($id: ID!) {
        miniature(id: $id) {
          schemes(first: 40) {
            nodes {
              scheme {
                id
              }
            }
          }
        }
      }
    `,
    { id: miniatureId },
  );
  assert.deepEqual(
    attached.miniature.schemes.nodes.map((row) => row.scheme.id).sort(),
    [blueId, existingId].sort(),
  );
  results.schemeRanking = { samples, blueId, redId, existingId, bestSchemeExcludesNearestLibraryPaint: true };
  results.checks.push("PASS attach ranked scheme preserves existing attachment and already-attached state");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  // The responsive drawer host can remount ProjectRecipe and leave recipe edit mode.
  const editRecipe = page.getByRole("button", { name: "Edit recipe", exact: true });
  if (await editRecipe.isVisible()) {
    await expect(page.getByRole("button", { name: /Swatch Scan/ })).toHaveCount(0);
    await editRecipe.click();
  }
  await expect(scanEntry).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("button", { name: /Swatch Scan/ })).toHaveCount(0);
  results.checks.push(
    "PASS populated photo recipe hides Swatch Scan in view mode and retains the edit-mode scan row",
  );
}
