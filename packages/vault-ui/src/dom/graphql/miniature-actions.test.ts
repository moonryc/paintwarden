import assert from "node:assert/strict";
import test from "node:test";

import type { MiniatureFormValues, Requirement } from "../types.ts";

import { createVaultGraphQLClient } from "./client.ts";
import { VaultInvalidationController } from "./invalidation.ts";
import { createMiniatureActions } from "./miniature-actions.ts";

const values: MiniatureFormValues = {
  title: "Project",
  status: "WISHLIST",
  paintingStatus: "COMPLETE",
  notes: "Keep notes",
  manufacturer: "Maker",
  faction: "Army",
  scale: "28mm",
  image: null,
  removeImage: false,
  templateId: null,
  includeTemplateImage: false,
};
const payload = (field: string, id = "miniature", seq = "2") =>
  Response.json({
    data: {
      [field]: {
        revision: { epoch: "vault", seq },
        miniatureId: id,
        clientMutationId: null,
        invalidatedFamilies: ["HOME", "MINIATURES"],
      },
    },
  });
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

function setup(fetch: typeof globalThis.fetch) {
  const transport = createVaultGraphQLClient({ authHeaders: () => ({}), fetch });
  const controller = new VaultInvalidationController();
  controller.observe({ epoch: "vault", seq: "1" });
  const errors: string[] = [];
  const files: string[] = [];
  const actions = createMiniatureActions(
    { ...transport, controller },
    async (path) => {
      files.push(path);
      return {};
    },
    (message, tone) => {
      if (tone === "error") errors.push(message);
    },
  );
  return {
    transport,
    controller,
    actions,
    errors,
    files,
    dispose() {
      controller.dispose();
      transport.dispose();
    },
  };
}

void test("recipe saves strip GraphQL output fields and serialize per miniature", async () => {
  const requests: Array<{ variables: unknown }> = [];
  let release!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const fixture = setup(async (_url, init) => {
    requests.push(JSON.parse(typeof init?.body === "string" ? init.body : "{}") as { variables: unknown });
    return requests.length === 1 ? pending : payload("setMiniatureRecipe", "miniature", "3");
  });
  const raw = {
    id: "entry",
    paintId: "paint",
    step: "BASECOAT",
    notes: "Note",
    sortOrder: 0,
    __typename: "MiniatureRecipeEntry",
    paint: { id: "paint" },
  };
  const first = fixture.actions.setRecipe(
    "miniature",
    [raw as Omit<Requirement, "miniatureId">],
    ["BASECOAT", "HIGHLIGHT"],
  );
  const second = fixture.actions.setRecipe("miniature", [], []);
  await turn();
  assert.equal(requests.length, 1);
  release(payload("setMiniatureRecipe"));
  await Promise.all([first, second]);
  assert.equal(requests.length, 2);
  const variables = requests[0].variables as { entries: unknown[]; steps: string[] };
  assert.deepEqual(variables.entries, [
    { id: "entry", paintId: "paint", step: "BASECOAT", notes: "Note", sortOrder: 0 },
  ]);
  assert.deepEqual(variables.steps, ["BASECOAT", "HIGHLIGHT"]);
  assert.deepEqual(
    fixture.controller.getCursor(),
    { epoch: "vault", seq: "1" },
    "commits never skip pending stream events",
  );
  fixture.dispose();
});

void test("stage/full-detail updates preserve editable fields and omit output/image fields", async () => {
  let sent: { input: unknown } | undefined;
  const fixture = setup(async (_url, init) => {
    sent = (
      JSON.parse(typeof init?.body === "string" ? init.body : "{}") as { variables: { input: unknown } }
    ).variables;
    return payload("updateMiniature");
  });
  const { image: _image, removeImage: _removeImage, ...editable } = values;
  await fixture.actions.update("miniature", {
    ...values,
    id: "miniature",
    createdAt: 1,
    imageUrl: "/api/images/photo",
  } as MiniatureFormValues);
  assert.deepEqual(sent?.input, editable);
  assert.equal(fixture.files.length, 0, "stage does not delete or upload existing photo");
  fixture.dispose();
});

void test("create returns committed id and does not duplicate a record when image upload fails", async () => {
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () => payload("createMiniature", "created"),
  });
  const controller = new VaultInvalidationController();
  const errors: string[] = [];
  const actions = createMiniatureActions(
    { ...transport, controller },
    async () => {
      throw new Error("upload failed");
    },
    (message, tone) => {
      if (tone === "error") errors.push(message);
    },
  );
  const id = await actions.create({ ...values, removeImage: true });
  assert.equal(id, "created");
  assert.ok(errors.some((message) => message.includes("Miniature created")));
  controller.dispose();
  transport.dispose();
});

void test("disposed identity ignores old mutation result and cannot send image writes or legacy sync", async () => {
  let release!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const fixture = setup(async () => pending);
  const update = fixture.actions.update("miniature", { ...values, removeImage: true });
  await turn();
  fixture.controller.dispose();
  release(payload("updateMiniature"));
  await assert.rejects(update, /connection changed/);
  assert.deepEqual(fixture.files, []);
  assert.deepEqual(fixture.errors, []);
  fixture.transport.dispose();
});

void test("failed save reports error and does not poison following queued save", async () => {
  let calls = 0;
  const fixture = setup(async () =>
    ++calls === 1
      ? Response.json({ errors: [{ message: "recipe rejected" }] })
      : payload("setMiniatureSchemes"),
  );
  const first = fixture.actions.setSchemes("miniature", ["gone"]);
  const next = fixture.actions.setSchemes("miniature", []);
  await assert.rejects(first, /recipe rejected/);
  await next;
  assert.equal(calls, 2);
  assert.deepEqual(fixture.errors, ["recipe rejected"]);
  fixture.dispose();
});
