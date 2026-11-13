import assert from "node:assert/strict";
import test from "node:test";

import { createTemplateActions } from "../store/template-hooks";

import { createVaultGraphQLClient } from "./client";
import { VaultInvalidationController } from "./invalidation";

void test("ordinary template commands use GraphQL, invalidate without advancing SSE, and queue same-ID writes", async () => {
  const requests: { operationName: string; variables: Record<string, unknown> }[] = [];
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (url, init) => {
      assert.equal(url, "/api/graphql");
      const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as (typeof requests)[number];
      requests.push(body);
      const field = {
        CreateReusableTemplate: "createTemplate",
        UpdateReusableTemplate: "updateTemplate",
        DeleteReusableTemplate: "deleteTemplate",
      }[body.operationName];
      assert.ok(field);
      return Response.json({
        data: {
          [field]: {
            revision: { epoch: "test", seq: String(requests.length + 1) },
            templateId: body.variables.id ?? "user:new",
            clientMutationId: body.variables.clientMutationId,
            invalidatedFamilies: ["TEMPLATES"],
          },
        },
      });
    },
  });
  const controller = new VaultInvalidationController();
  controller.observe({ epoch: "test", seq: "1" });
  let invalidations = 0;
  const stop = controller.listen(["TEMPLATES"], () => {
    invalidations += 1;
  });
  try {
    const actions = createTemplateActions({ ...transport, controller });
    assert.equal(await actions.create({ name: "Knight", sourceMiniatureId: "source-miniature" }), "user:new");
    await Promise.all([
      actions.update("user:new", { name: "A" }),
      actions.update("user:new", { name: "B" }),
      actions.remove("user:new"),
    ]);
    assert.deepEqual(
      requests.map((row) => row.operationName),
      [
        "CreateReusableTemplate",
        "UpdateReusableTemplate",
        "UpdateReusableTemplate",
        "DeleteReusableTemplate",
      ],
    );
    assert.equal(invalidations, 4);
    assert.deepEqual(controller.getCursor(), { epoch: "test", seq: "1" });
  } finally {
    stop();
    transport.client.stop();
    controller.dispose();
  }
});

void test("late template mutation from retired scope cannot invalidate the next vault", async () => {
  let finish!: (response: Response) => void;
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  });
  const controller = new VaultInvalidationController();
  const actions = createTemplateActions({ ...transport, controller });
  const save = actions.update("user:t", { name: "Knight" });
  await new Promise<void>((resolve) => setImmediate(resolve));
  controller.event({ epoch: "next", seq: "1", reset: true, families: [] });
  finish(
    Response.json({
      data: {
        updateTemplate: {
          revision: { epoch: "old", seq: "2" },
          templateId: "user:t",
          clientMutationId: "template:1",
          invalidatedFamilies: ["TEMPLATES"],
        },
      },
    }),
  );
  try {
    await assert.rejects(save, /Vault connection changed/);
    assert.equal(controller.getCursor()?.epoch, "next");
  } finally {
    transport.client.stop();
    controller.dispose();
  }
});
