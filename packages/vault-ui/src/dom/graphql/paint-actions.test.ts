import assert from "node:assert/strict";
import test from "node:test";

import { createVaultGraphQLClient } from "./client.ts";
import { VaultInvalidationController } from "./invalidation.ts";
import { createPaintCommands } from "./paint-actions.ts";

const paint = { brand: "Brand", range: "Base", name: "Paint", colorHex: "#123456", sourceUrl: null };
const revision = { epoch: "vault", seq: "2" };
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const payload = (field: string, extra: object = {}) =>
  Response.json({
    data: {
      [field]: {
        revision,
        invalidatedFamilies: ["LIBRARY", "PAINT", "OPTIONS", "HOME", "MINIATURES", "WISHLIST"],
        clientMutationId: null,
        ...extra,
      },
    },
  });
type Request = { operationName: string; variables: Record<string, unknown> };
function setup(fetch: (request: Request) => Promise<Response>) {
  const requests: Request[] = [];
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (url, init) => {
      assert.equal(url, "/api/graphql", "commands never use legacy REST endpoints");
      const request = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as Request;
      requests.push(request);
      return fetch(request);
    },
  });
  const controller = new VaultInvalidationController();
  controller.observe({ epoch: "vault", seq: "1" });
  const errors: string[] = [];
  const commands = createPaintCommands({ ...transport, controller }, (message, tone) => {
    if (tone === "error") errors.push(message);
  });
  return {
    commands,
    controller,
    requests,
    errors,
    dispose() {
      controller.dispose();
      transport.dispose();
    },
  };
}

void test("custom paint CRUD uses typed GraphQL inputs and invalidates projections without advancing stream", async () => {
  const fixture = setup(async ({ operationName }) => {
    if (operationName === "ImportCustomPaints")
      return payload("importCustomPaints", { imported: 1, skipped: 0 });
    return payload(operationName === "UpdateCustomPaint" ? "updateCustomPaint" : "deleteCustomPaint", {
      paintId: "user:paint",
    });
  });
  const invalidations: string[] = [];
  fixture.controller.listen(["LIBRARY"], () => invalidations.push("library"));
  const outputPaint = { ...paint, id: "forbidden-output-id", isCustom: true, __typename: "Paint" };
  assert.deepEqual(await fixture.commands.importPaints([outputPaint]), { imported: 1, skipped: 0 });
  await fixture.commands.updatePaint("user:paint", outputPaint);
  await fixture.commands.deletePaint("user:paint");
  assert.deepEqual(fixture.requests[0].variables.paints, [paint]);
  assert.deepEqual(fixture.requests[1].variables.input, paint);
  assert.equal(fixture.requests[2].variables.id, "user:paint");
  assert.equal(new Set(fixture.requests.map((request) => request.variables.clientMutationId)).size, 3);
  assert.equal(invalidations.length, 3);
  assert.deepEqual(fixture.controller.getCursor(), { epoch: "vault", seq: "1" });
  fixture.dispose();
});

void test("substitution create/default/delete preserve variables and strip output ingredient fields", async () => {
  const fields: Record<string, string> = {
    CreateSubstitution: "createSubstitution",
    SetSubstitutionDefault: "setSubstitutionDefault",
    DeleteSubstitution: "deleteSubstitution",
  };
  const fixture = setup(async ({ operationName }) =>
    payload(fields[operationName], { substitutionId: "mix" }),
  );
  const ingredient = { paintId: "ingredient", parts: 3, __typename: "Ingredient", sortOrder: 9 };
  assert.equal(
    await fixture.commands.createSubstitution({
      targetPaintId: "target",
      name: "Mix",
      ingredients: [ingredient],
    }),
    "mix",
  );
  await fixture.commands.setSubstitutionDefault("mix", true);
  await fixture.commands.setSubstitutionDefault("mix", false);
  await fixture.commands.deleteSubstitution("mix");
  assert.deepEqual(fixture.requests[0].variables.input, {
    targetPaintId: "target",
    name: "Mix",
    ingredients: [{ paintId: "ingredient", parts: 3 }],
  });
  assert.equal(fixture.requests[1].variables.enabled, true);
  assert.equal(fixture.requests[2].variables.enabled, false);
  assert.equal(fixture.requests[3].variables.id, "mix");
  fixture.dispose();
});

void test("default switches are serialized across mix ids and failures do not poison the queue", async () => {
  let release!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const fixture = setup(async () =>
    ++calls === 1 ? pending : payload("setSubstitutionDefault", { substitutionId: "next" }),
  );
  const first = fixture.commands.setSubstitutionDefault("first", true);
  const next = fixture.commands.setSubstitutionDefault("next", true);
  await turn();
  assert.equal(fixture.requests.length, 1);
  release(Response.json({ errors: [{ message: "Mix is unavailable" }] }));
  await assert.rejects(first, /Mix is unavailable/);
  await next;
  assert.equal(fixture.requests.length, 2);
  assert.deepEqual(fixture.errors, ["Mix is unavailable"]);
  fixture.dispose();
});

void test("disposed identity discards old command results and never sends queued writes", async () => {
  let release!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const fixture = setup(async () => pending);
  const first = fixture.commands.importPaints([paint]);
  const next = fixture.commands.deletePaint("user:paint");
  await turn();
  fixture.controller.dispose();
  release(payload("importCustomPaints", { imported: 1, skipped: 0 }));
  await assert.rejects(first, /connection changed/);
  await assert.rejects(next, /connection changed/);
  assert.equal(fixture.requests.length, 1);
  assert.deepEqual(fixture.errors, []);
  fixture.dispose();
});

void test("failed creates report errors without automatically retrying", async () => {
  const fixture = setup(async () => Response.json({ errors: [{ message: "Create rejected" }] }));
  await assert.rejects(
    fixture.commands.createSubstitution({
      targetPaintId: "target",
      name: "Mix",
      ingredients: [{ paintId: "ingredient", parts: 1 }],
    }),
    /Create rejected/,
  );
  assert.equal(fixture.requests.length, 1);
  assert.deepEqual(fixture.errors, ["Create rejected"]);
  fixture.dispose();
});
