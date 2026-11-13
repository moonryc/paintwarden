import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";
import { reactClickToComponent } from "vite-plugin-react-click-to-component";

// Names the service worker's cache after this build's files, so a new release replaces the old cache.
function serviceWorkerVersion(): Plugin {
  let outDir = "";
  let build = "";
  return {
    name: "paint-vault-service-worker-version",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    generateBundle(_, bundle) {
      build = createHash("sha256").update(Object.keys(bundle).sort().join("\n")).digest("hex").slice(0, 12);
    },
    closeBundle() {
      const file = path.join(outDir, "sw.js");
      const source = readFileSync(file, "utf8");
      if (!source.includes("__PAINT_VAULT_BUILD__")) throw new Error("sw.js has no build placeholder");
      writeFileSync(file, source.replaceAll("__PAINT_VAULT_BUILD__", build));
    },
  };
}

export default defineConfig({
  plugins: [react(), reactClickToComponent(), serviceWorkerVersion()],
  base: "./",
  optimizeDeps: { esbuildOptions: { target: "esnext" } },
  build: {
    target: "esnext",
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        // MUI marks browser components with this harmless React Server Components directive.
        if (warning.code === "MODULE_LEVEL_DIRECTIVE" && warning.message.includes('"use client"')) return;
        defaultHandler(warning);
      },
    },
  },
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: process.env.PAINT_VAULT_WEB_HOST || "0.0.0.0",
    port: Number(process.env.PAINT_VAULT_WEB_PORT || 3000),
    strictPort: true,
    proxy: {
      "/api": { target: `http://127.0.0.1:${process.env.PAINT_VAULT_API_PORT || "3175"}`, xfwd: true },
    },
  },
});
