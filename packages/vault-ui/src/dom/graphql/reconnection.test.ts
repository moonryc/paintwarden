import assert from "node:assert/strict";
import { test } from "node:test";

import { VaultReconnection, reconnectDelay } from "./reconnection";

void test("recovery backs off, coalesces failures, retries immediately and cancels on disposal", async () => {
  const delays: number[] = [];
  let scheduled: (() => void) | undefined;
  let online = false;
  let probes = 0;
  let recovered = 0;
  const recovery = new VaultReconnection(
    async () => {
      probes++;
      if (!online) throw new TypeError("fetch failed");
    },
    () => {
      recovered++;
    },
    (callback, delay) => {
      delays.push(delay);
      scheduled = callback;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    () => {
      scheduled = undefined;
    },
  );
  const states: boolean[] = [];
  recovery.subscribe(() => states.push(recovery.getSnapshot()));
  recovery.disconnected();
  recovery.disconnected();
  assert.deepEqual(delays, [1000]);
  for (let i = 0; i < 5; i++) {
    scheduled?.();
    await recovery.retry();
  }
  assert.deepEqual(delays, [1000, 2000, 5000, 10_000, 30_000, 30_000]);
  online = true;
  await recovery.retry(); // online/focus/manual retry, without waiting for a timer
  assert.equal(probes, 6);
  assert.equal(recovered, 1);
  assert.deepEqual(states, [true, false]);
  assert.equal(scheduled, undefined);
  assert.equal(reconnectDelay(100), 30_000);
  recovery.disconnected();
  recovery.dispose();
  await recovery.retry();
  assert.equal(probes, 6);
});

void test("late probe success cannot refetch or publish into a disposed account scope", async () => {
  let resolve!: () => void;
  let recovered = false;
  const recovery = new VaultReconnection(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
    () => {
      recovered = true;
    },
  );
  recovery.disconnected();
  const request = recovery.retry();
  recovery.dispose();
  resolve();
  await request;
  assert.equal(recovered, false);
});
