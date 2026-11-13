import assert from "node:assert/strict";
import test from "node:test";

import { withImageMutation } from "./image-mutations";

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("image mutations serialize entire operations, allow nested helpers, and release after failure", async () => {
  const entered = gate();
  const release = gate();
  const events: string[] = [];
  const first = withImageMutation(async () => {
    events.push("first");
    await Promise.all([
      withImageMutation(async () => events.push("nested one")),
      withImageMutation(async () => events.push("nested two")),
    ]);
    entered.resolve();
    await release.promise;
    throw new Error("failed operation");
  });
  const failure = assert.rejects(first, /failed operation/);
  await entered.promise;
  const second = withImageMutation(async () => {
    events.push("second");
  });
  await Promise.resolve();
  assert.deepEqual(events, ["first", "nested one", "nested two"]);
  release.resolve();
  await Promise.all([failure, second]);
  assert.deepEqual(events, ["first", "nested one", "nested two", "second"]);
});

test("an inherited context cannot bypass the queue after its outer operation finishes", async () => {
  const start = gate();
  let inherited!: Promise<void>;
  await withImageMutation(async () => {
    inherited = start.promise
      .then(() => withImageMutation(async () => events.push("inherited")))
      .then(() => undefined);
  });
  const entered = gate();
  const release = gate();
  const events: string[] = [];
  const next = withImageMutation(async () => {
    entered.resolve();
    await release.promise;
    events.push("next");
  });
  await entered.promise;
  start.resolve();
  await Promise.resolve();
  assert.deepEqual(events, []);
  release.resolve();
  await Promise.all([next, inherited]);
  assert.deepEqual(events, ["next", "inherited"]);
});
