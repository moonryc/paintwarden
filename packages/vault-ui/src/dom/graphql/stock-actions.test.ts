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
  let syncs = 0;
  const actions = createPaintStockActions(
    scope,
    (message, tone) => {
      if (tone === "error") errors.push(message);
    },
    async () => {
      syncs++;
    },
  );
  actions.setPaintState("paint", "OWNED", "FULL", 2);
  actions.setPaintState("paint", "OWNED", "FULL", 3);
  assert.equal(quantity(), 3);
  await turn();
  assert.equal(variables.length, 1);
  first.resolve(Response.json({ errors: [{ message: "first save failed" }] }));
  await beganSecond.promise;
  assert.equal(quantity(), 3);
  assert.deepEqual(errors, ["first save failed"]);
  second.resolve(response(3, "2"));
  await turn();
  await turn();
  assert.equal(quantity(), 3);
  assert.equal(syncs, 1);
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
  let syncs = 0;
  const actions = createPaintStockActions(
    scope,
    () => {},
    async () => {
      syncs++;
    },
  );
  actions.setPaintState("paint", "OWNED", "FULL", 2);
  await turn();
  controller.dispose();
  transport.dispose();
  pending.resolve(response(2, "2"));
  await turn();
  await turn();
  assert.deepEqual(transport.client.cache.extract(), {});
  assert.equal(syncs, 0);
});
