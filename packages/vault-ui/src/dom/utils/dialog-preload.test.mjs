import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, Suspense } from "react";
import { renderToString } from "react-dom/server";

import { scheduleIdlePreload } from "./idle-preload.ts";
import { createPreloadable, preloadOnIntent } from "./preloadable.ts";

function scheduler(connection, withIdle = true) {
  let sequence = 0;
  const frames = new Map();
  const idle = new Map();
  const timers = new Map();
  const host = {
    connection,
    requestAnimationFrame: (callback) => {
      const id = ++sequence;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    requestIdleCallback: withIdle
      ? (callback, options) => {
          assert.equal(options.timeout, 2000);
          const id = ++sequence;
          idle.set(id, callback);
          return id;
        }
      : undefined,
    cancelIdleCallback: (id) => idle.delete(id),
    setTimeout: (callback, delay) => {
      assert.equal(delay, 1000);
      const id = ++sequence;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const flush = (queue) => {
    const callbacks = [...queue.values()];
    queue.clear();
    callbacks.forEach((callback) => callback());
  };
  return {
    host,
    frames,
    idle,
    timers,
    frame: () => flush(frames),
    run: () => {
      flush(idle);
      flush(timers);
    },
  };
}

test("idle preload waits for the first screen's paint and runs once", () => {
  const clock = scheduler();
  let calls = 0;
  scheduleIdlePreload(() => calls++, clock.host);
  assert.equal(calls, 0);
  clock.frame();
  assert.equal(clock.idle.size, 0);
  clock.frame();
  assert.equal(calls, 0);
  assert.equal(clock.idle.size, 1);
  clock.run();
  clock.run();
  assert.equal(calls, 1);
});

test("Save-Data and every slow effective connection skip idle preload", () => {
  for (const connection of [
    { saveData: true },
    ...["slow-2g", "2g", "3g"].map((effectiveType) => ({ effectiveType })),
  ]) {
    const clock = scheduler(connection);
    scheduleIdlePreload(() => assert.fail("preloaded a constrained connection"), clock.host);
    assert.equal(clock.frames.size, 0);
    clock.run();
  }
});

test("timer fallback runs after paint and cancellation handles every stage", () => {
  const clock = scheduler(undefined, false);
  let calls = 0;
  const cancel = scheduleIdlePreload(() => calls++, clock.host);
  clock.frame();
  clock.frame();
  assert.equal(clock.timers.size, 1);
  cancel();
  clock.run();
  assert.equal(calls, 0);
  const other = scheduler();
  const cancelFrame = scheduleIdlePreload(() => calls++, other.host);
  other.frame();
  cancelFrame();
  other.frame();
  other.run();
  assert.equal(calls, 0);
  const idle = scheduler();
  const cancelIdle = scheduleIdlePreload(() => calls++, idle.host);
  idle.frame();
  idle.frame();
  cancelIdle();
  idle.run();
  assert.equal(calls, 0);
  scheduleIdlePreload(() => calls++, clock.host);
  clock.frame();
  clock.frame();
  clock.run();
  assert.equal(calls, 1);
});

test("startup is inert; idle and repeated intent share one import promise", async () => {
  let calls = 0;
  let resolve;
  const imported = new Promise((yes) => {
    resolve = yes;
  });
  const dialog = createPreloadable(() => {
    calls++;
    return imported;
  });
  assert.equal(calls, 0);
  const hover = dialog.preload();
  assert.equal(dialog.preload(), hover); // focus
  assert.equal(dialog.preload(), hover); // pointerdown
  const clock = scheduler();
  scheduleIdlePreload(() => dialog.preload(), clock.host);
  clock.frame();
  clock.frame();
  clock.run();
  assert.equal(calls, 1);
  resolve({ default: () => createElement("p", null, "ready") });
  await hover;
  assert.equal(dialog.preload(), hover);
  assert.equal(calls, 1);
  const html = renderToString(
    createElement(
      Suspense,
      { fallback: createElement("p", null, "fallback") },
      createElement(dialog.Component),
    ),
  );
  assert.match(html, /ready/);
  assert.doesNotMatch(html, /fallback|template|client rendering/);
});

test("a rejected speculative import is shared with render rather than retried", async () => {
  const error = new Error("chunk unavailable");
  let calls = 0;
  const dialog = createPreloadable(() => {
    calls++;
    return Promise.reject(error);
  });
  const first = dialog.preload();
  await assert.rejects(first, error);
  assert.equal(dialog.preload(), first);
  await assert.rejects(dialog.preload(), error);
  assert.equal(calls, 1);
});

test("all real intent handlers share the idle/render promise and do not fire eagerly", async () => {
  let calls = 0;
  const dialog = createPreloadable(async () => {
    calls++;
    return { default: () => null };
  });
  const handlers = preloadOnIntent(dialog.preload);
  assert.equal(calls, 0);
  for (const handler of Object.values(handlers)) {
    handler();
    handler();
  }
  await dialog.preload();
  assert.equal(calls, 1);
  assert.deepEqual(Object.keys(handlers), ["onPointerEnter", "onFocus", "onPointerDown"]);
});
