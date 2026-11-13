import path from "node:path";
import { fileURLToPath } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

// Runs every story as a test in headless Chromium: a story passes when it renders without
// errors and its play function, if any, succeeds. Run with `npm run storybook:test`.
export default defineConfig({
  plugins: [storybookTest({ configDir: path.join(here, ".storybook") })],
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({}),
      instances: [{ browser: "chromium" }],
    },
  },
});
