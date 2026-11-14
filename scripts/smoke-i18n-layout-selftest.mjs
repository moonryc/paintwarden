#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { measureLayout } from "./i18n-layout-checks.mjs";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(
    `<style>.narrow {width:20px;overflow:hidden}.hidden {position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}</style><div class="narrow"><span style="white-space:nowrap">Übersetzte Beschriftung</span></div><div class="narrow">22 benötigte Farben</div><span style="display:inline-flex;width:20px;white-space:nowrap">Keine Farben</span><div class="hidden"><span>Nur für Screenreader</span></div><div class="narrow">User/plugin title untouched</div><div>Kurzer Text</div>`,
  );
  const result = await page.evaluate(measureLayout, [
    "Übersetzte Beschriftung",
    "{{count, number}} benötigte Farben",
    "Keine Farben",
    "Nur für Screenreader",
    "Kurzer Text",
  ]);
  assert.deepEqual(
    result.clipped.map(({ text }) => text),
    ["Übersetzte Beschriftung", "22 benötigte Farben", "Keine Farben"],
  );
  assert.equal(result.overflow, false);
  assert.deepEqual(result.unresolvedKeys, []);
  console.log(
    "PASS: ancestor clipping, interpolated plurals, visible overflow; hidden a11y/data/fit exclusions",
  );
} finally {
  await browser.close();
}
