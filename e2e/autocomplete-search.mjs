import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { expect as playwrightExpect } from "playwright/test";

const expect = playwrightExpect.configure({ timeout: 12_000 });

// Real authenticated mutations and production GraphQL reads; no mocked options/catalog.
export async function checkAutocompleteSearch({ page, artifacts, results }) {
  // At most three real command roots per operation, matching the production budget.
  // Batching fixture creation avoids exhausting the legitimate 120 operations/minute
  // limit when this check follows the full backup/SSE browser flow.
  for (let start = 0; start < 65; start += 3) {
    const indexes = Array.from({ length: Math.min(3, 65 - start) }, (_, offset) => start + offset);
    const response = await page.request.post("/api/graphql", {
      data: {
        query: `mutation AuditTemplates(${indexes.map((index) => `$input${index}: TemplateInput!`).join(", ")}) { ${indexes.map((index) => `item${index}: createTemplate(input: $input${index}) { templateId }`).join(" ")} }`,
        variables: Object.fromEntries(
          indexes.map((index) => [
            `input${index}`,
            {
              name: `Audit model ${String(index).padStart(3, "0")}`,
              manufacturer: "Synthetic audit studio",
              faction: "Synthetic faction",
            },
          ]),
        ),
      },
    });
    assert.equal(response.status(), 200);
    const body = await response.json();
    assert.equal(body.errors, undefined, JSON.stringify(body.errors));
  }
  await page.getByRole("button", { name: "Add miniature", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Add a miniature", exact: true })
    .getByRole("button", { name: "Miniature", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Add a miniature", exact: true });
  const input = dialog.getByRole("combobox", { name: "Model", exact: true });
  await input.click();
  await expect(page.getByRole("option").first()).toBeVisible();
  await expect(dialog.getByRole("progressbar")).toHaveCount(0);
  // Slow down only this real read's delivery to make the pending state observable.
  // The server executes the original request and its original body is passed through unchanged.
  const requests = [];
  await page.route("**/api/graphql", async (route) => {
    const body = route.request().postDataJSON();
    if (body?.operationName !== "TemplateSummaries") return route.continue();
    requests.push({ time: Date.now(), variables: body.variables });
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({ response });
  });
  const evidence = {
    fixtureTemplates: 65,
    responseDeliveryDelayMs: 150,
    tolerancePx: 1,
    requests,
    sequences: [],
  };
  for (const [mode, delay] of [
    ["slow", 260],
    ["quick", 15],
  ]) {
    await input.fill("");
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.waitForTimeout(250);
    await input.evaluate((element) => {
      const rect = (node) => {
        if (!node) return null;
        const { x, y, width, height } = node.getBoundingClientRect();
        return { x, y, width, height };
      };
      const sample = () => {
        const listbox = document.querySelector('[role="listbox"]');
        const popper = document.querySelector(".MuiAutocomplete-popper");
        return {
          time: performance.now(),
          value: element.value,
          dialog: rect(element.closest('[role="dialog"]')),
          field: rect(element.closest(".MuiAutocomplete-root")),
          input: rect(element),
          popper: rect(popper),
          listbox: rect(listbox),
          optionCount: listbox?.querySelectorAll('[role="option"]').length ?? 0,
          loadingReplacement: Boolean(popper?.querySelector(".MuiAutocomplete-loading")),
          popupText: popper?.textContent ?? "",
        };
      };
      window.__autocompleteAudit = { frames: [], keystrokes: [], sample, active: true };
      const tick = () => {
        if (!window.__autocompleteAudit.active) return;
        window.__autocompleteAudit.frames.push(sample());
        requestAnimationFrame(tick);
      };
      tick();
    });
    await page.screenshot({ path: path.join(artifacts, `autocomplete-${mode}-initial.png`) });
    for (const character of "Audit") {
      await input.press(character);
      await page.evaluate(() =>
        window.__autocompleteAudit.keystrokes.push(window.__autocompleteAudit.sample()),
      );
      if (mode === "slow")
        await page.screenshot({
          path: path.join(artifacts, `autocomplete-${mode}-${await input.inputValue()}.png`),
        });
      await page.waitForTimeout(delay);
    }
    await expect(input).toHaveValue("Audit");
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(artifacts, `autocomplete-${mode}-settled.png`) });
    const sequence = await page.evaluate(() => {
      window.__autocompleteAudit.active = false;
      return { frames: window.__autocompleteAudit.frames, keystrokes: window.__autocompleteAudit.keystrokes };
    });
    sequence.mode = mode;
    sequence.interKeyDelayMs = delay;
    sequence.drift = {};
    sequence.missingTargetFrames = {};
    const samples = [...sequence.frames, ...sequence.keystrokes];
    for (const target of ["dialog", "field", "input", "popper", "listbox"]) {
      const initial = sequence.frames[0][target];
      sequence.missingTargetFrames[target] = samples.filter((frame) => !frame[target]).length;
      sequence.drift[target] = Math.max(
        0,
        ...samples.flatMap((frame) =>
          initial && frame[target]
            ? ["x", "y", "width", "height"].map((axis) => Math.abs(frame[target][axis] - initial[axis]))
            : [],
        ),
      );
    }
    sequence.loadingReplacementFrames = sequence.frames.filter((frame) => frame.loadingReplacement).length;
    sequence.missingListboxFrames = sequence.frames.filter((frame) => !frame.listbox).length;
    evidence.sequences.push(sequence);
  }
  await writeFile(path.join(artifacts, "autocomplete-geometry.json"), JSON.stringify(evidence, null, 2));
  results.autocomplete = evidence.sequences.map(
    ({ mode, drift, loadingReplacementFrames, missingListboxFrames }) => ({
      mode,
      drift,
      loadingReplacementFrames,
      missingListboxFrames,
    }),
  );
  for (const sequence of evidence.sequences) {
    for (const [target, drift] of Object.entries(sequence.drift)) {
      assert.ok(drift <= 1, `${sequence.mode} ${target} moved/resized ${drift}px (maximum 1px)`);
      assert.equal(sequence.missingTargetFrames[target], 0, `${sequence.mode}: ${target} must stay mounted`);
    }
    assert.equal(
      sequence.loadingReplacementFrames,
      0,
      `${sequence.mode}: Loading must not replace loaded options`,
    );
    assert.equal(sequence.missingListboxFrames, 0, `${sequence.mode}: loaded listbox must remain mounted`);
  }
  results.checks.push(
    "PASS Model picker slow/quick typing: per-frame and per-keystroke dialog/field/popper/listbox drift <=1px; no Loading replacement",
  );
  await expect(dialog.getByRole("button", { name: "Load more models", exact: true })).toHaveCount(0);
  const listbox = page.getByRole("listbox");
  await listbox.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(page.getByRole("option", { name: "Audit model 064", exact: true })).toHaveCount(1);
  await listbox.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await page.screenshot({ path: path.join(artifacts, "autocomplete-infinite-scroll.png") });
  await page.getByRole("option", { name: "Audit model 064", exact: true }).click();
  await expect(dialog.getByRole("textbox", { name: /^Name/ })).toHaveValue("Audit model 064");
  results.checks.push(
    "PASS Model picker loads its next page by dropdown scroll without an external Load more button; final option applies to miniature name",
  );
  await input.click();
  await input.fill("");
  const stressText = "stress".repeat(30);
  await input.pressSequentially(stressText, { delay: 1 });
  await expect(input).toHaveValue(stressText);
  await expect(page.locator(".MuiAutocomplete-noOptions")).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "autocomplete-long-typing.png") });
  evidence.stress = {
    characters: stressText.length,
    inputValue: await input.inputValue(),
    errors: [...results.errors],
  };
  await input.fill("");
  await expect(page.getByRole("option").first()).toBeVisible();
  evidence.requestBudget = {
    maximumFirst: Math.max(...requests.map(({ variables }) => variables.first)),
    maximumSearchLength: Math.max(...requests.map(({ variables }) => (variables.search ?? "").length)),
    requests: requests.length,
  };
  await writeFile(path.join(artifacts, "autocomplete-geometry.json"), JSON.stringify(evidence, null, 2));
  results.autocompleteStress = evidence.stress;
  results.autocompleteRequestBudget = evidence.requestBudget;
  assert.deepEqual(
    results.errors,
    [],
    "Long typing must not produce React update-depth or other page/API errors",
  );
  assert.ok(requests.length > 0, "Real template search requests were observed");
  assert.ok(
    requests.every(({ variables }) => variables.first > 0 && variables.first <= 48),
    "Each template request stays within the 48-row budget",
  );
  assert.ok(
    requests.every(({ variables }) => (variables.search ?? "").length <= 128),
    "Server search variables stay within the 128-character budget",
  );
  assert.ok(
    requests.some(({ variables }) => variables.search === stressText.slice(0, 128)),
    "180-character input generated its normalized latest search request",
  );
  results.checks.push(
    "PASS 180-character fast Model typing and recovery without page/API errors; requests bounded to 48 rows and 128 search characters",
  );
}
