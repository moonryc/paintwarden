import assert from "node:assert/strict";
import test from "node:test";
import { ownedBundledServerPid, independentProcessWriter } from "./home-miniatures-process-client.mjs";

test("local endpoint discovery accepts only direct owned bundled Node child", () => {
  const resources = "/private/tmp/phase3/Paintwarden.app/Contents/Resources";
  const executable = `${resources}/server/node server.mjs`;
  const ps = ` 100 1 /private/tmp/phase3/Paintwarden.app/Contents/MacOS/Paintwarden\n 101 100 ${executable}\n 102 99 ${executable}\n 103 100 /unowned/server/node server.mjs\n 104 100 ${resources}/server/node malicious.mjs\n`;
  assert.equal(ownedBundledServerPid(ps, 100, resources), 101);
  assert.throws(() => ownedBundledServerPid(ps, 98, resources), /Exactly one direct/);
  assert.throws(
    () => ownedBundledServerPid(ps + ` 105 100 ${executable}\n`, 100, resources),
    /Exactly one direct/,
  );
});

test("independent native process writer refuses non-loopback or non-HTTP server", () => {
  assert.throws(() => independentProcessWriter("http://example.com:1234"));
  assert.throws(() => independentProcessWriter("https://127.0.0.1:1234"));
});
