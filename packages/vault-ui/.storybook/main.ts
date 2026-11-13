import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));

// Packages imported by the shared UI and its stories. Vite pre-bundles them at startup; a package
// it only finds while a story loads makes it reload the page, and stories already loading can
// then pick up a second copy of React and fail with "Invalid hook call".
function importedPackages() {
  const files = [path.join(here, "preview.tsx")];
  for (const entry of readdirSync(path.join(here, "../src/dom"), { recursive: true, withFileTypes: true }))
    if (entry.isFile() && /\.tsx?$/.test(entry.name)) files.push(path.join(entry.parentPath, entry.name));
  const packages = new Set<string>();
  for (const file of files)
    for (const [, specifier] of readFileSync(file, "utf8").matchAll(
      /^import (?!type )[^;]*?from "([^".][^"?]*)";/gm,
    ))
      if (!/^(@paint-vault\/|@storybook\/|storybook\/|node:)/.test(specifier)) packages.add(specifier);
  return [...packages].sort();
}

// Storybook for the shared React UI. Stories sit beside their components as *.stories.tsx.
const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/dom/**/*.stories.tsx"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-vitest"],
  core: { disableTelemetry: true },
  // Match the web app's Vite settings so components build the same way.
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      resolve: { dedupe: ["react", "react-dom"] },
      optimizeDeps: { include: importedPackages(), esbuildOptions: { target: "esnext" } },
      build: {
        target: "esnext",
        rollupOptions: {
          onwarn(
            warning: { code?: string; message: string },
            defaultHandler: (warning: { code?: string; message: string }) => void,
          ) {
            // MUI marks browser components with this harmless React Server Components directive.
            if (warning.code === "MODULE_LEVEL_DIRECTIVE" && warning.message.includes('"use client"')) return;
            defaultHandler(warning);
          },
        },
      },
    }),
};

export default config;
