import assert from "node:assert/strict";
import test from "node:test";

import { createTemplateActions } from "../store/template-hooks";

import { createVaultGraphQLClient } from "./client";
import { VaultInvalidationController } from "./invalidation";
import { createMiniatureActions } from "./miniature-actions";
import { createPaintCommands } from "./paint-actions";
import type { VaultGraphQLScope } from "./provider";
import { createSchemeActions } from "./scheme-actions";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const cases: {
  name: string;
  field: string;
  create(scope: VaultGraphQLScope): () => Promise<unknown>;
}[] = [
  {
    name: "template",
    field: "updateTemplate",
    create: (scope) => {
      const actions = createTemplateActions(scope);
      return () => actions.update("record", { name: "Edited template" });
    },
  },
  {
    name: "paint",
    field: "deleteCustomPaint",
    create: (scope) => {
      const actions = createPaintCommands(scope, () => {});
      return () => actions.deletePaint("record");
    },
  },
  {
    name: "scheme",
    field: "deleteScheme",
    create: (scope) => {
      const actions = createSchemeActions(scope, () => {});
      return () => actions.remove("record");
    },
  },
  {
    name: "miniature",
    field: "deleteMiniature",
    create: (scope) => {
      const actions = createMiniatureActions(
        scope,
        async () => undefined,
        () => {},
      );
      return () => actions.remove("record");
    },
  },
];

function setup(scenario: (typeof cases)[number]) {
  let finish!: (response: Response) => void;
  let requests = 0;
  const response = (epoch = "vault") =>
    Response.json({
      data: {
        [scenario.field]: {
          revision: { epoch, seq: String(requests + 2) },
          invalidatedFamilies: ["TEMPLATES"],
          templateId: "record",
          schemeId: "record",
          miniatureId: "record",
          paintId: "record",
          clientMutationId: null,
        },
      },
    });
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () =>
      ++requests === 1
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : response(),
  });
  const controller = new VaultInvalidationController();
  controller.observe({ epoch: "vault", seq: "1" });
  return {
    controller,
    run: scenario.create({ ...transport, controller }),
    requests: () => requests,
    finish: (epoch?: string) => finish(response(epoch)),
    dispose: () => {
      controller.dispose();
      transport.dispose();
    },
  };
}

for (const scenario of cases) {
  for (const reset of ["SSE same-epoch reset", "REST refresh"]) {
    void test(`${scenario.name}: ${reset} before response preserves successful and queued commands, not reads`, async () => {
      const fixture = setup(scenario);
      try {
        const read = fixture.controller.capture();
        const first = fixture.run();
        const queued = fixture.run();
        await turn();
        assert.equal(fixture.requests(), 1);
        if (reset === "REST refresh") fixture.controller.refresh();
        else fixture.controller.event({ epoch: "vault", seq: "2", reset: true, families: [] });
        assert.equal(fixture.controller.isCurrent(read), false);
        assert.equal(fixture.controller.accepts(read, { epoch: "vault", seq: "9" }, ["TEMPLATES"]), false);
        fixture.finish();
        await Promise.all([first, queued]);
        assert.equal(fixture.requests(), 2);
        assert.equal(fixture.controller.getCursor()?.epoch, "vault");
      } finally {
        fixture.dispose();
      }
    });
  }

  for (const retire of ["epoch event", "dispose", "response epoch"]) {
    void test(`${scenario.name}: ${retire} rejects response and queued commands`, async () => {
      const fixture = setup(scenario);
      try {
        const first = fixture.run();
        const queued = fixture.run();
        // Attach rejection handlers before releasing the asynchronous response.
        const rejected = [
          assert.rejects(first, /connection changed/),
          assert.rejects(queued, /connection changed/),
        ];
        await turn();
        if (retire === "dispose") fixture.controller.dispose();
        if (retire === "epoch event")
          fixture.controller.event({ epoch: "next", seq: "1", reset: true, families: [] });
        fixture.finish(retire === "response epoch" ? "next" : "vault");
        await Promise.all(rejected);
        assert.equal(fixture.requests(), 1, "retired queued writes must never be sent");
        if (retire !== "dispose") assert.equal(fixture.controller.getCursor()?.epoch, "next");
      } finally {
        fixture.dispose();
      }
    });
  }
}
