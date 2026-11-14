import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
const identifier = "PolyForm-Noncommercial-1.0.0";
const notice = "\nRequired Notice: Copyright (c) 2026 Ryan Moon (https://github.com/moonryc)\n";

test("LICENSE is the verbatim official PolyForm 1.0.0 text plus the required notice", () => {
  const license = read("LICENSE");
  assert.ok(license.endsWith(notice));
  // Official PolyForm repository commit 76a278c402bc43b8d2b561da140b0f3e17263015,
  // PolyForm-Noncommercial-1.0.0.md. Hash the original bytes, not normalized prose.
  assert.equal(
    createHash("sha256").update(license.slice(0, -notice.length)).digest("hex"),
    "c0ea4a896d2c8c394b29f9427589996db826cd501c512279ff0ed3ef48fabbe5",
  );
});

test("root and every workspace manifest and lock entry declare the project license", () => {
  const lock = json("package-lock.json");
  for (const manifest of [
    "package.json",
    ...new Set(
      json("package.json").workspaces.flatMap((pattern) =>
        globSync(`${pattern}/package.json`, { cwd: root }),
      ),
    ),
  ]) {
    assert.equal(json(manifest).license, identifier, manifest);
    const key = manifest === "package.json" ? "" : path.dirname(manifest);
    assert.equal(lock.packages[key].license, identifier, `lock: ${key}`);
  }
});

test("desktop, offline About, and Docker ship the project license", () => {
  const desktop = json("apps/paintwarden-electron/package.json");
  assert.ok(
    desktop.build.extraResources.some((item) => item.from === "../../LICENSE" && item.to === "LICENSE"),
  );
  assert.match(read("Dockerfile"), /COPY --from=builder --chown=node:node \/app\/LICENSE \/app\/LICENSE/);
  assert.match(read("packages/vault-ui/src/dom/Components/HelpAbout.tsx"), /LICENSE\?raw/);
});
