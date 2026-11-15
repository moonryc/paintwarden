import assert from "node:assert/strict";
import path from "node:path";
import { expect as playwrightExpect } from "playwright/test";

import { averageLab, hexToLab, labToHex } from "../packages/paint-core/color-matching.ts";

const expect = playwrightExpect.configure({ timeout: 12_000 });

/** Continue the real two-color photo fixture, without mocking any index or mutation. */
export async function checkScanAggregate({
  page,
  dialog,
  photo,
  miniatureId,
  samples,
  graphql,
  scheme,
  ids,
  artifacts,
  results,
  existingIds,
}) {
  const combinedHex = labToHex(averageLab(samples.map(hexToLab)));
  assert.ok(samples.every((hex) => hex.toLowerCase() !== combinedHex.toLowerCase()));
  await graphql(
    page,
    `
      mutation Seed($paints: [CustomPaintImportInput!]!) {
        importCustomPaints(paints: $paints) {
          imported
        }
      }
    `,
    {
      paints: [{ name: "Combined Lab match", brand: "Synthetic studio", colorHex: combinedHex }],
    },
  );
  const library = await graphql(
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
  const combinedId = library.library.nodes.find((paint) => paint.name === "Combined Lab match").id;
  const coverageId = await scheme("Whole-photo coverage", [
    "Scheme blue suggestion",
    "Scheme red suggestion",
  ]);
  const pins = dialog.getByRole("list", { name: "Sample pins" });
  const paintList = dialog.getByRole("list", { name: "Closest paint matches" });
  const schemeList = dialog.getByRole("list", { name: "Closest scheme matches" });
  const all = () => dialog.getByRole("button", { name: "All pins (2)", exact: true });
  const thisPin = () => dialog.getByRole("button", { name: "This pin", exact: true });
  const sampleAt = async (fraction) => {
    await expect(dialog.getByRole("button", { name: "Sample at crosshair" })).toBeEnabled();
    await photo.scrollIntoViewIfNeeded();
    const box = await photo.boundingBox();
    assert.ok(box);
    await page.mouse.click(box.x + box.width * fraction, box.y + box.height / 2);
  };
  const shot = async (name, width, result) => {
    if (width === 390) await result.scrollIntoViewIfNeeded();
    assert.equal(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
    await page.screenshot({
      path: path.join(artifacts, `aggregate-${name}-${width}.png`),
      animations: "disabled",
    });
  };
  // Start at desktop, because the preceding selected-pin flow ends at phone width.
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1050 });
    await expect(pins.getByRole("button")).toHaveCount(0);
    await sampleAt(0.25);
    await expect(thisPin()).toBeDisabled();
    await sampleAt(0.75);
    await thisPin().click();
    await dialog.getByRole("button", { name: "By paint", exact: true }).click();
    for (const [i, name] of ["Standalone nearest blue", "Standalone nearest red"].entries()) {
      await pins.getByRole("button").nth(i).click();
      await expect(paintList.getByRole("listitem").first()).toContainText(name);
    }
    await shot("this-paint", width, paintList.getByRole("listitem").first());
    await dialog.getByRole("button", { name: "By scheme", exact: true }).click();
    for (const [i, name] of ["Blue ranked scheme", "Red ranked scheme"].entries()) {
      await pins.getByRole("button").nth(i).click();
      await expect(schemeList.getByRole("listitem").first().getByRole("heading")).toHaveText(name);
    }
    await shot("this-scheme", width, schemeList.getByRole("listitem").first());
    await all().click();
    const bestScheme = schemeList.getByRole("listitem").first();
    await expect(bestScheme.getByRole("heading")).toHaveText("Whole-photo coverage");
    await expect(bestScheme).toContainText("Pin 1 → paint");
    await expect(bestScheme).toContainText("Pin 2 → paint");
    await expect(bestScheme).toContainText("Scheme blue suggestion");
    await expect(bestScheme).toContainText("Scheme red suggestion");
    await expect(bestScheme).toContainText("Overall coverage · mean ΔE");
    await expect(bestScheme).toContainText("Worst pin · ΔE");
    await shot("all-scheme", width, bestScheme);
    if (width === 1440) {
      await bestScheme.getByRole("button", { name: "Attach scheme" }).click();
      await expect(bestScheme.getByRole("button", { name: "Attach scheme" })).toBeDisabled();
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
        [...existingIds, coverageId].sort(),
      );
    }
    await dialog.getByRole("button", { name: "By paint", exact: true }).click();
    const bestPaint = paintList.getByRole("listitem").first();
    await expect(bestPaint).toContainText("Combined Lab match");
    await expect(
      dialog.getByRole("heading", { name: `Combined 2 pins: ${combinedHex}`, exact: true }),
    ).toBeVisible();
    await shot("all-paint", width, bestPaint);
    if (width === 1440) {
      await bestPaint.getByRole("button", { name: "Assign", exact: true }).click();
      const assign = page.getByRole("dialog", { name: "Assign paint to recipe", exact: true });
      await expect(assign.getByRole("combobox", { name: "Recipe step", exact: true })).toHaveText("Basecoat");
      await assign.getByRole("button", { name: "Assign", exact: true }).click();
      await expect(assign).toBeHidden();
      const saved = await graphql(
        page,
        `
          query Verify($id: ID!) {
            miniature(id: $id) {
              recipe(first: 40) {
                nodes {
                  paint {
                    id
                  }
                  step
                }
              }
            }
          }
        `,
        { id: miniatureId },
      );
      assert.deepEqual(
        saved.miniature.recipe.nodes.map((row) => row.paint.id).sort(),
        [ids.get("Standalone nearest blue"), combinedId].sort(),
      );
      assert.ok(saved.miniature.recipe.nodes.every((row) => row.step === "BASECOAT"));
      // Three pins reweight the Lab mean; schemes must expose a match for the new pin.
      await sampleAt(0.35);
      const threeHex = labToHex(averageLab([samples[0], samples[1], samples[0]].map(hexToLab)));
      await expect(
        dialog.getByRole("heading", { name: `Combined 3 pins: ${threeHex}`, exact: true }),
      ).toBeVisible();
      assert.notEqual(threeHex, combinedHex);
      await dialog.getByRole("button", { name: "By scheme", exact: true }).click();
      await expect(bestScheme).toContainText("Pin 3 → paint");
      await pins.getByRole("button").nth(2).click();
      await page.keyboard.press("Delete");
      await expect(all()).toHaveAttribute("aria-pressed", "true");
      await expect(bestScheme).not.toContainText("Pin 3 → paint");
      await pins.getByRole("button").nth(1).click();
      await page.keyboard.press("Delete");
      await expect(thisPin()).toBeDisabled();
      await expect(thisPin()).toHaveAttribute("aria-pressed", "true");
      await sampleAt(0.75);
      await expect(all()).toHaveAttribute("aria-pressed", "true");
      await expect(bestScheme.getByRole("heading")).toHaveText("Whole-photo coverage");
    }
    results.checks.push(
      `PASS This pin vs All pins paint/scheme results differ from both individual pins; no overflow at ${width}`,
    );
  }
  // Scope is session storage, not tied to an open scan or its transient pins.
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  const editRecipe = page.getByRole("button", { name: "Edit recipe", exact: true });
  if (await editRecipe.isVisible()) await editRecipe.click();
  await page.getByRole("button", { name: /Swatch Scan.*Beta/ }).click();
  await sampleAt(0.25);
  await sampleAt(0.75);
  await expect(all()).toHaveAttribute("aria-pressed", "true");
  await expect(paintList.getByRole("listitem").first()).toContainText("Combined Lab match");
  await thisPin().click();
  results.scanAggregate = { samples, combinedHex, combinedId, coverageId };
  results.checks.push(
    "PASS combined-match recipe assignment, coverage scheme attachment, live 2↔3↔1 pin changes and session scope persistence",
  );
}

export async function checkScanAggregateFixture({ page, miniatureId, title, artifacts, results }) {
  const graphql = async (page, query, variables = {}) => {
    const response = await page.request.post("/api/graphql", { data: { query, variables } });
    assert.equal(response.status(), 200);
    const body = await response.json();
    assert.equal(body.errors, undefined, JSON.stringify(body.errors));
    return body.data;
  };
  await expect(page.getByText(`Added ${title}`, { exact: true })).toBeHidden();
  await page.getByText(title, { exact: true }).click();
  const scanEntry = page.getByRole("button", { name: /Swatch Scan.*Beta/ });
  await scanEntry.click();
  const dialog = page.getByRole("dialog", { name: "Swatch Scan", exact: true });
  const photo = dialog.getByRole("img", { name: title, exact: true });
  await expect(dialog.getByRole("button", { name: "Sample at crosshair" })).toBeEnabled();
  const box = await photo.boundingBox();
  assert.ok(box);
  const samples = [];
  for (const fraction of [0.25, 0.75]) {
    await page.mouse.click(box.x + box.width * fraction, box.y + box.height / 2);
    const label = await dialog.getByRole("heading", { name: /^Sampled color:/ }).innerText();
    samples.push(label.match(/#[\da-f]{6}/i)[0]);
  }
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  const near = (hex) =>
    `#${(parseInt(hex.slice(1, 3), 16) + 8).toString(16).padStart(2, "0")}${hex.slice(3)}`;
  const paints = [
    { name: "Standalone nearest blue", colorHex: samples[0] },
    { name: "Standalone nearest red", colorHex: samples[1] },
    { name: "Scheme blue suggestion", colorHex: near(samples[0]) },
    { name: "Scheme red suggestion", colorHex: near(samples[1]) },
    { name: "Scheme ivory", colorHex: "#FFFFFF" },
  ].map((paint) => ({ ...paint, brand: "Synthetic studio" }));
  await graphql(
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
  const library = await graphql(
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
  const ids = new Map(library.library.nodes.map((paint) => [paint.name, paint.id]));
  const scheme = async (name, paintNames) => {
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
  };
  const blueId = await scheme("Blue ranked scheme", ["Scheme blue suggestion", "Scheme ivory"]);
  await scheme("Red ranked scheme", ["Scheme red suggestion"]);
  const existingId = await scheme("Existing attached scheme", ["Scheme blue suggestion"]);
  await graphql(
    page,
    `
      mutation SeedRecipe($id: ID!, $paint: ID!, $schemes: [ID!]!) {
        setMiniatureRecipe(
          id: $id
          entries: [{ paintId: $paint, step: "BASECOAT", notes: "", sortOrder: 0 }]
          steps: ["BASECOAT"]
        ) {
          miniatureId
        }
        setMiniatureSchemes(id: $id, schemeIds: $schemes) {
          miniatureId
        }
      }
    `,
    { id: miniatureId, paint: ids.get("Standalone nearest blue"), schemes: [blueId, existingId] },
  );
  await page.getByRole("button", { name: "Edit recipe", exact: true }).click();
  await scanEntry.click();
  // Force the same remount boundary used between screenshot sizes in the flow.
  await page.setViewportSize({ width: 390, height: 1050 });
  await checkScanAggregate({
    page,
    dialog,
    photo,
    miniatureId,
    samples,
    graphql,
    scheme,
    ids,
    artifacts,
    results,
    existingIds: [blueId, existingId],
  });
}
