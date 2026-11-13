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

test("late Home/list/detail envelopes cannot regress shared Miniature fields before SSE", () => {
  const controller = new VaultInvalidationController();
  const ticket = controller.capture();
  assert.equal(controller.accepts(ticket, revision("10"), ["HOME"]), true);
  assert.equal(controller.accepts(ticket, revision("9"), ["MINIATURES"]), false);
  assert.equal(controller.accepts(ticket, revision("11"), ["MINIATURES", "PAINT"]), true);
  assert.equal(controller.accepts(ticket, revision("10"), ["HOME"]), false);
  assert.equal(controller.accepts(ticket, revision("10"), ["LIBRARY"]), false);
  assert.deepEqual(controller.getCursor(), revision("10"));
  controller.event({ ...revision("1", "new"), reset: true, families: [] });
  assert.equal(controller.accepts(controller.capture(), revision("1", "new"), ["HOME"]), true);
});

test("REST refresh retires old reads and refetches metadata even at the same revision", () => {
  const evictions: unknown[] = [];
  const controller = new VaultInvalidationController((families, reset) =>
    evictions.push({ families, reset }),
  );
  const revision = { epoch: "vault", seq: "7" };
  controller.observe(revision);
  const ticket = controller.capture();
  let sourceReads = 0;
  controller.listen(["SOURCES"], () => sourceReads++);
  controller.refresh();
  assert.equal(controller.isCurrent(ticket), false);
  assert.equal(controller.accepts(ticket, revision, ["SOURCES"]), false);
  assert.equal(controller.accepts(controller.capture(), revision, ["SOURCES"]), true);
  assert.equal(sourceReads, 1);
  assert.equal(evictions.length, 1);
  assert.deepEqual(controller.getCursor(), revision);
});

test("command tickets survive projection resets but retire on identity changes and unknown-baseline resets", () => {
  const controller = new VaultInvalidationController();
  controller.observe(revision("1"));
  const command = controller.captureCommand();
  const read = controller.capture();
  controller.event({ ...revision("2"), reset: true, families: [] });
  controller.refresh();
  assert.equal(controller.isCommandCurrent(command), true);
  assert.equal(controller.isCurrent(read), false);
  assert.equal(controller.commitCommand(command, revision("3"), ["TEMPLATES"]), true);
  assert.deepEqual(controller.getCursor(), revision("2"), "command acknowledgement does not advance SSE");
  controller.event({ ...revision("1", "next"), reset: true, families: [] });
  assert.equal(controller.isCommandCurrent(command), false);
  assert.equal(controller.commitCommand(command, revision("99"), ["TEMPLATES"]), false);
  const nextCommand = controller.captureCommand();
  assert.equal(controller.commitCommand(nextCommand, revision("100"), ["TEMPLATES"]), false);
  assert.equal(
    controller.isCommandCurrent(nextCommand),
    true,
    "retired payload epoch cannot reset the next vault",
  );
  controller.dispose();
  assert.equal(controller.isCommandCurrent(nextCommand), false);

  const bootstrap = new VaultInvalidationController();
  const unknownCommand = bootstrap.captureCommand();
  bootstrap.event({ ...revision("1"), reset: true, families: [] });
  assert.equal(bootstrap.isCommandCurrent(unknownCommand), false);
});
