import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const output = path.join(import.meta.dirname, "dist");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await build({
  entryPoints: [path.join(import.meta.dirname, "server/main.ts")],
  outfile: path.join(output, "server.mjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  external: [
    "@nestjs/*",
    "better-sqlite3",
    "drizzle-orm",
    "drizzle-orm/*",
    "express",
    "reflect-metadata",
    "rxjs",
    "graphql",
    "graphql-yoga",
  ],
  tsconfig: path.join(import.meta.dirname, "tsconfig.json"),
  logLevel: "info",
});
await cp(path.join(root, "apps/paint-vault-web/dist"), path.join(output, "web-dist"), { recursive: true });
await cp(path.join(import.meta.dirname, "drizzle"), path.join(output, "drizzle"), { recursive: true });
// esbuild flattens import.meta.url to server.mjs; keep the reviewed schema beside it.
await cp(path.join(import.meta.dirname, "graphql/schema.graphql"), path.join(output, "schema.graphql"));
