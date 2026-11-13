import assert from "node:assert/strict";
import test from "node:test";

import { createVaultGraphQLClient } from "./client";
import { VaultInvalidationController } from "./invalidation";
import { createSchemeActions, type SchemeInput } from "./scheme-actions";

const input: SchemeInput = {
  name: "Bronze armor",
  category: "BROWN",
  entries: [
    { type: "DIVIDER", id: "step", label: "BASECOAT", tone: "SECTION" },
    { type: "PAINT", paintId: "original-target" },
    {
      type: "IMAGE",
      id: "image",
      imageUrl: "https://example.test/image.png",
      thumbnailUrl: "https://example.test/thumb.png",
      imageType: "FINISHED",
      method: null,
    },
  ],
};
const payload = (field: string, id = "scheme", seq = "2") =>
  Response.json({
    data: {
      [field]: {
        revision: { epoch: "vault", seq },
        schemeId: id,
        clientMutationId: null,
        invalidatedFamilies: ["SCHEMES", "MINIATURES", "HOME", "PAINT", "WISHLIST", "TEMPLATES"],
      },
    },
  });
function setup(fetch: typeof globalThis.fetch) {
  const transport = createVaultGraphQLClient({ authHeaders: () => ({}), fetch });
  const controller = new VaultInvalidationController();
  controller.observe({ epoch: "vault", seq: "1" });
  const errors: string[] = [];
  let syncs = 0;
  const actions = createSchemeActions(
    { ...transport, controller },
    (message, tone) => {
      if (tone === "error") errors.push(message);
    },
    async () => {
      syncs++;
    },
  );
  return {
    transport,
    controller,
    errors,
    actions,
    syncs: () => syncs,
    dispose() {
      controller.dispose();
      transport.dispose();
    },
  };
}
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
void test("ordinary scheme create/update/delete use GraphQL and commit attachment/usage invalidations", async () => {
  const sent: Array<{ operationName: string; variables: Record<string, unknown> }> = [];
  const fixture = setup(async (_url, init) => {
    const request = JSON.parse(String(init?.body)) as (typeof sent)[number];
    sent.push(request);
    return payload(
      (
        {
          CreateColorScheme: "createScheme",
          UpdateColorScheme: "updateScheme",
          DeleteColorScheme: "deleteScheme",
        } as Record<string, string>
      )[request.operationName],
    );
  });
  assert.equal(await fixture.actions.create(input), "scheme");
  await fixture.actions.update("scheme", input);
  await fixture.actions.remove("scheme");
  assert.deepEqual(
    sent.map((request) => request.operationName),
    ["CreateColorScheme", "UpdateColorScheme", "DeleteColorScheme"],
  );
  assert.deepEqual(sent[0].variables.input, input);
  assert.equal(sent[1].variables.id, "scheme");
  assert.equal(fixture.syncs(), 3);
  assert.equal(fixture.controller.isFresh({ epoch: "vault", seq: "1" }, ["SCHEMES", "MINIATURES"]), false);
  assert.deepEqual(fixture.controller.getCursor(), { epoch: "vault", seq: "1" });
  fixture.dispose();
});
void test("queued scheme saves do not overtake and a failed command does not poison the queue", async () => {
  let release!: (response: Response) => void;
  const firstReply = new Promise<Response>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const fixture = setup(async () => (++calls === 1 ? firstReply : payload("updateScheme")));
  const first = fixture.actions.update("scheme", input);
  const second = fixture.actions.update("scheme", { ...input, name: "Last wins" });
  await turn();
  assert.equal(calls, 1);
  release(Response.json({ errors: [{ message: "Scheme rejected" }] }));
  await assert.rejects(first, /Scheme rejected/);
  await second;
  assert.equal(calls, 2);
  assert.deepEqual(fixture.errors, ["Scheme rejected"]);
  assert.equal(fixture.syncs(), 1);
  fixture.dispose();
});
void test("a late scheme response from an old connection cannot commit or sync", async () => {
  let release!: (response: Response) => void;
  const reply = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const fixture = setup(async () => reply);
  const update = fixture.actions.update("scheme", input);
  await turn();
  fixture.controller.dispose();
  release(payload("updateScheme"));
  await assert.rejects(update, /connection changed/);
  assert.equal(fixture.syncs(), 0);
  assert.deepEqual(fixture.errors, []);
  fixture.transport.dispose();
});
