import assert from "node:assert/strict";
import test from "node:test";

import { colors, themeVars } from "../theme-tokens.ts";

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test("beta badge tokens retain AA contrast on dark and light surfaces", () => {
  // Both colors are opaque tokens: surrounding light/dark surfaces cannot alter their contrast.
  const [low, high] = [luminance(colors.beta), luminance(colors.betaFg)].sort((a, b) => a - b);
  assert.ok((high + 0.05) / (low + 0.05) >= 4.5);
  assert.equal(themeVars["--beta"], colors.beta);
  assert.equal(themeVars["--beta-fg"], colors.betaFg);
  for (const other of [colors.brand, colors.ok, colors.rust, colors.gold, colors.sky]) {
    assert.notEqual(colors.beta, other);
  }
});
