import assert from "node:assert/strict";
import test from "node:test";

import { createVaultGraphQLClient } from "./client.ts";
import { PaintStockFragmentDoc } from "./generated/graphql.ts";
import { VaultInvalidationController } from "./invalidation.ts";
import { createPaintStockActions } from "./stock-actions.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const response = (quantity: number, seq: string) =>
  Response.json({
    data: {
      setPaintStock: {
        __typename: "PaintMutationResult",
        revision: { __typename: "VaultRevision", epoch: "vault", seq },
        paint: {
          __typename: "Paint",
          id: "paint",
          inventory: { __typename: "Inventory", state: "OWNED", stockLevel: "FULL", quantity },
        },
        clientMutationId: null,
        invalidatedFamilies: ["LIBRARY", "PAINT", "OPTIONS"],
      },
    },
  });

test("stock writes serialize per resource and failed older edits never undo newer optimistic stock", async () => {
  const first = deferred<Response>(),
    second = deferred<Response>(),
    beganSecond = deferred<void>();
  const variables: unknown[] = [];
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as { variables: unknown };
      variables.push(body.variables);
      if (variables.length === 1) return first.promise;
      beganSecond.resolve();
      return second.promise;
    },
  });
  const controller = new VaultInvalidationController();
  controller.observe({ epoch: "vault", seq: "1" });
  const scope = { ...transport, controller };
  const id = transport.client.cache.identify({ __typename: "Paint", id: "paint" });
  const original = {
    __typename: "Paint",
    id: "paint",
    inventory: { __typename: "Inventory", state: "OWNED", stockLevel: "FULL", quantity: 1 },
  };
  transport.client.cache.writeFragment({ id, fragment: PaintStockFragmentDoc, data: original });
  const quantity = () =>
    transport.client.cache.readFragment({ id, fragment: PaintStockFragmentDoc, optimistic: true })?.inventory
      ?.quantity;
  const errors: string[] = [];
  const actions = createPaintStockActions(scope, (message, tone) => {
    if (tone === "error") errors.push(message);
  });
  actions.setPaintState("paint", "OWNED", "FULL", 2);
  actions.setPaintState("paint", "OWNED", "FULL", 3);
  assert.equal(quantity(), 3);
  await turn();
  assert.equal(variables.length, 1);
  first.resolve(
    Response.json({
      errors: [{ message: "first save failed", extensions: { errorCode: "BAD_USER_INPUT" } }],
    }),
  );
  await beganSecond.promise;
  assert.equal(quantity(), 3);
  assert.deepEqual(errors, ["Check the entered information and try again."]);
  second.resolve(response(3, "2"));
  await turn();
  await turn();
  assert.equal(quantity(), 3);
  assert.deepEqual(
    controller.getCursor(),
    { epoch: "vault", seq: "1" },
    "mutation must not skip another client's event",
  );
  controller.dispose();
  transport.dispose();
});

test("pending stock results cannot write after an identity scope is disposed", async () => {
  const pending = deferred<Response>();
  const transport = createVaultGraphQLClient({ authHeaders: () => ({}), fetch: () => pending.promise });
  const controller = new VaultInvalidationController();
  const scope = { ...transport, controller };
  const actions = createPaintStockActions(scope, () => {});
  actions.setPaintState("paint", "OWNED", "FULL", 2);
  await turn();
  controller.dispose();
  transport.dispose();
  pending.resolve(response(2, "2"));
  await turn();
  await turn();
  assert.deepEqual(transport.client.cache.extract(), {});
});

for (const reset of ["same-epoch reset", "REST refresh"]) {
  test(`stock queue survives ${reset} but old read tickets cannot normalize mutation payloads`, async () => {
    const first = deferred<Response>();
    let requests = 0;
    const transport = createVaultGraphQLClient({
      authHeaders: () => ({}),
      fetch: async () => (++requests === 1 ? first.promise : response(3, "4")),
    });
    const controller = new VaultInvalidationController();
    controller.observe({ epoch: "vault", seq: "1" });
    const id = transport.client.cache.identify({ __typename: "Paint", id: "paint" });
    const write = (quantity: number) => {
      const data = {
        __typename: "Paint",
        id: "paint",
        inventory: { __typename: "Inventory", state: "OWNED", stockLevel: "FULL", quantity },
      };
      return transport.client.cache.writeFragment({ id, fragment: PaintStockFragmentDoc, data });
    };
    write(1);
    const errors: string[] = [];
    const actions = createPaintStockActions({ ...transport, controller }, (message) => errors.push(message));
    let commits = 0;
    try {
      actions.setPaintState("paint", "OWNED", "FULL", 2);
      actions.setPaintState("paint", "OWNED", "FULL", 3);
      await turn();
      if (reset === "REST refresh") controller.refresh();
      else controller.event({ epoch: "vault", seq: "3", reset: true, families: [] });
      // Simulate a fresh projection accepted after reset. Neither pending command's
      // older read generation may overwrite it, even though both writes succeed.
      write(9);
      controller.listen(["PAINT"], () => commits++);
      first.resolve(response(2, "2"));
      for (let index = 0; index < 5; index++) await turn();
      assert.equal(requests, 2);
      assert.equal(commits, 2);
      assert.deepEqual(errors, []);
      assert.equal(
        transport.client.cache.readFragment({ id, fragment: PaintStockFragmentDoc })?.inventory?.quantity,
        9,
      );
      assert.equal(
        transport.client.cache.readFragment({ id, fragment: PaintStockFragmentDoc, optimistic: true })
          ?.inventory?.quantity,
        9,
      );
    } finally {
      controller.dispose();
      transport.dispose();
    }
  });
}

for (const retire of ["epoch", "dispose"]) {
  test(`stock ${retire} retires queued writes and pending payloads`, async () => {
    const pending = deferred<Response>();
    let requests = 0;
    const transport = createVaultGraphQLClient({
      authHeaders: () => ({}),
      fetch: () => {
        requests++;
        return pending.promise;
      },
    });
    const controller = new VaultInvalidationController();
    controller.observe({ epoch: "vault", seq: "1" });
    const actions = createPaintStockActions({ ...transport, controller }, () =>
      assert.fail("retired stock scope must not notify"),
    );
    try {
      actions.setPaintState("paint", "OWNED", "FULL", 2);
      actions.setPaintState("paint", "OWNED", "FULL", 3);
      await turn();
      if (retire === "dispose") controller.dispose();
      else controller.event({ epoch: "next", seq: "1", reset: true, families: [] });
      pending.resolve(response(2, "2"));
      for (let index = 0; index < 5; index++) await turn();
      assert.equal(requests, 1);
      const inventory = transport.client.cache.readFragment({
        id: transport.client.cache.identify({ __typename: "Paint", id: "paint" }),
        fragment: PaintStockFragmentDoc,
        optimistic: true,
      })?.inventory;
      assert.equal(inventory, undefined);
    } finally {
      controller.dispose();
      transport.dispose();
    }
  });
}

test("offline stock failure rolls back its optimistic layer once; reconciliation never replays the mutation", async () => {
  let writes = 0;
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () => {
      writes++;
      throw new TypeError("fetch failed");
    },
  });
  const controller = new VaultInvalidationController();
  controller.observe({ epoch: "vault", seq: "1" });
  const scope = { ...transport, controller };
  const id = transport.client.cache.identify({ __typename: "Paint", id: "paint" });
  const original = {
    __typename: "Paint",
    id: "paint",
    inventory: { __typename: "Inventory", state: "OWNED", stockLevel: "FULL", quantity: 1 },
  };
  transport.client.cache.writeFragment({
    id,
    fragment: PaintStockFragmentDoc,
    data: original,
  });
  const quantity = () =>
    transport.client.cache.readFragment({ id, fragment: PaintStockFragmentDoc, optimistic: true })?.inventory
      ?.quantity;
  const errors: string[] = [];
  const actions = createPaintStockActions(scope, (message, tone) => {
    if (tone === "error") errors.push(message);
  });
  try {
    actions.setPaintState("paint", "OWNED", "FULL", 8);
    assert.equal(quantity(), 8);
    await turn();
    await turn();
    assert.equal(quantity(), 1);
    assert.equal(errors.length, 1, "the failed action is reported once, not silently lost");
    controller.refresh();
    await transport.client.refetchQueries({ include: "all" });
    await turn();
    assert.equal(writes, 1, "lost mutations must not be replayed");
    assert.equal(quantity(), 1, "no optimistic layer survives recovery");
    assert.equal(errors.length, 1);
  } finally {
    controller.dispose();
    transport.dispose();
  }
});
