import assert from "node:assert/strict";
import test from "node:test";

import { VaultInvalidationController, VAULT_FAMILIES, type Revision } from "./invalidation.ts";

const revision = (seq: string, epoch = "vault"): Revision => ({ epoch, seq });
test("no-change and duplicate SSE batches never evict or rerender", () => {
  const evictions: unknown[] = [];
  const controller = new VaultInvalidationController((...args) => evictions.push(args));
  let updates = 0;
  controller.listen(["LIBRARY"], () => updates++);
  controller.observe(revision("2"));
  controller.event({ ...revision("2"), reset: false, families: [] });
  controller.event({ ...revision("3"), reset: false, families: [] });
  controller.event({ ...revision("3"), reset: false, families: ["LIBRARY"] });
  assert.equal(updates, 0);
  assert.deepEqual(evictions, []);
  assert.deepEqual(controller.getCursor(), revision("3"));
});
test("typed family watermarks reject intersecting late reads but allow unrelated projections", () => {
  const controller = new VaultInvalidationController();
  controller.observe(revision("2147483647"));
  const baseline = controller.getBaseline();
  const ticket = controller.capture();
  controller.event({ ...revision("2147483649"), reset: false, families: ["LIBRARY", "PAINT"] });
  assert.equal(controller.accepts(ticket, revision("2147483648"), ["LIBRARY"]), false);
  assert.equal(controller.accepts(ticket, revision("2147483648"), ["TEMPLATES"]), true);
  assert.equal(controller.accepts(ticket, revision("2147483649"), ["LIBRARY"]), true);
  // A newer query is not a cursor acknowledgement of earlier unrelated changes.
  assert.equal(controller.accepts(ticket, revision("2147483655"), ["LIBRARY"]), true);
  assert.deepEqual(controller.getCursor(), revision("2147483649"));
  assert.equal(
    controller.getBaseline(),
    baseline,
    "ordinary event acknowledgements never restart a healthy stream",
  );
  assert.equal(controller.isFresh(revision("2147483648"), ["PAINT"]), false);
  assert.equal(controller.isFresh(revision("2147483649"), ["PAINT"]), true);
});
test("parallel bootstrap reads rewind to earliest envelope and never skip the interval", () => {
  const controller = new VaultInvalidationController();
  let streams = 0;
  controller.onCursor(() => streams++);
  assert.equal(controller.accepts(controller.capture(), revision("12"), ["LIBRARY"]), true);
  controller.event({ ...revision("14"), reset: false, families: ["LIBRARY"] });
  assert.equal(controller.accepts(controller.capture(), revision("10"), ["TEMPLATES"]), true);
  assert.deepEqual(controller.getCursor(), revision("10"));
  assert.equal(streams, 2);
  controller.event({ ...revision("14"), reset: false, families: ["PAINT"] });
  assert.deepEqual(controller.getCursor(), revision("14"));
  assert.equal(controller.accepts(controller.capture(), revision("13"), ["PAINT"]), false);
});
test("late parallel detail and picker reads cannot regress normalized Paint fields before SSE arrives", () => {
  const controller = new VaultInvalidationController();
  const ticket = controller.capture();
  assert.equal(controller.accepts(ticket, revision("10"), ["LIBRARY"]), true);
  assert.equal(controller.accepts(ticket, revision("8"), ["PAINT"]), false);
  assert.equal(controller.accepts(ticket, revision("9"), ["OPTIONS"]), false);
  assert.equal(controller.accepts(ticket, revision("11"), ["PAINT"]), true);
  assert.equal(controller.accepts(ticket, revision("10"), ["LIBRARY"]), false);
  assert.deepEqual(
    controller.getCursor(),
    revision("10"),
    "accepted newer projections must not acknowledge the stream",
  );
});
test("epoch reset rejects old-generation reads and refetches every active family", () => {
  const evictions: unknown[] = [];
  const controller = new VaultInvalidationController((...args) => evictions.push(args));
  controller.observe(revision("10"));
  const old = controller.capture();
  let refreshes = 0;
  for (const family of VAULT_FAMILIES) controller.listen([family], () => refreshes++);
  controller.event({ ...revision("1", "restored"), reset: true, families: [] });
  assert.equal(refreshes, VAULT_FAMILIES.length);
  assert.deepEqual(evictions, [[VAULT_FAMILIES, true]]);
  assert.equal(controller.accepts(old, revision("99"), ["LIBRARY"]), false);
  assert.equal(controller.accepts(old, revision("2", "restored"), ["LIBRARY"]), false);
  assert.equal(controller.accepts(controller.capture(), revision("0", "restored"), ["LIBRARY"]), false);
  assert.equal(controller.accepts(controller.capture(), revision("1", "restored"), ["LIBRARY"]), true);
  controller.event({ ...revision("100"), reset: true, families: ["LIBRARY"] });
  assert.deepEqual(
    controller.getCursor(),
    revision("1", "restored"),
    "an old aborted stream cannot reset back to its retired epoch",
  );
  controller.dispose();
  assert.equal(controller.accepts(controller.capture(), revision("99", "restored"), ["LIBRARY"]), false);
});
test("committed mutations invalidate filtered pages without advancing the stream cursor", () => {
  const controller = new VaultInvalidationController();
  controller.observe(revision("3"));
  const ticket = controller.capture();
  let refreshed = 0;
  const unsubscribe = controller.listen(["LIBRARY"], () => refreshed++);
  controller.committed(revision("9"), ["LIBRARY", "PAINT"]);
  assert.equal(refreshed, 1);
  assert.deepEqual(controller.getCursor(), revision("3"));
  assert.equal(controller.accepts(ticket, revision("8"), ["LIBRARY"]), false);
  controller.event({ ...revision("9"), reset: false, families: ["TEMPLATES"] });
  assert.equal(controller.accepts(ticket, revision("8"), ["TEMPLATES"]), false);
  unsubscribe();
  controller.committed(revision("10"), ["LIBRARY"]);
  assert.equal(refreshed, 1);
});
