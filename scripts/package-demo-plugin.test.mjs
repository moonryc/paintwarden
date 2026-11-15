import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { unzipSync } from "fflate";

import { buildDemoPlugin } from "./package-demo-plugin.mjs";

test("release demo ZIP is reproducible across time zones and has no developer files", () => {
  const outputs = ["UTC", "America/Chicago", "Asia/Tokyo"].map((TZ) => {
    const child = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        'import {buildDemoPlugin} from "./scripts/package-demo-plugin.mjs"; process.stdout.write(Buffer.from(buildDemoPlugin()))',
      ],
      {
        cwd: new URL("../", import.meta.url),
        env: { ...process.env, TZ },
      },
    );
    assert.equal(child.status, 0, child.stderr.toString());
    return child.stdout;
  });
  assert.deepEqual(outputs[0], outputs[1]);
  assert.deepEqual(outputs[1], outputs[2]);
  const entries = Object.keys(unzipSync(buildDemoPlugin()));
  assert.deepEqual(
    entries.filter((name) => !name.startsWith("images/")),
    ["source.json", "catalog.json", "assets.json", "logo.svg", "LICENSE", "README.md"],
  );
  assert.ok(entries.every((name) => !name.startsWith("/") && !name.includes("..")));
});
