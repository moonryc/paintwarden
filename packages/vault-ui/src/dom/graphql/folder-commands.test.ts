import assert from "node:assert/strict";
import test from "node:test";

import { createVaultGraphQLClient } from "./client";
import { createFolderCommands } from "./folder-hooks";
import { VaultInvalidationController } from "./invalidation";

function setup(respond: () => Promise<Response>) {
  const requests: { query: string; variables: Record<string, unknown> }[] = [];
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      requests.push(
        JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
          query: string;
          variables: Record<string, unknown>;
        },
      );
      return respond();
    },
  });
  const controller = new VaultInvalidationController();
  controller.event({ epoch: "vault", seq: "1", reset: true, families: [] });
  return {
    requests,
    controller,
    client: transport.client,
    commands: createFolderCommands({ client: transport.client, controller }),
    dispose: () => {
      controller.dispose();
      transport.dispose();
    },
  };
}
const success = () =>
  Response.json({
    data: {
      deleteFolderItems: {
        revision: { epoch: "vault", seq: "2" },
        invalidatedFamilies: ["MINIATURES", "HOME"],
      },
    },
  });

void test("folder delete sends one atomic mutation with all IDs and commits only the returned invalidations", async () => {
  const fixture = setup(async () => success());
  let refreshed = 0;
  fixture.controller.listen(["MINIATURES"], () => refreshed++);
  try {
    await fixture.commands.deleteItems("MINIATURE", ["one", "two", "one"]);
    assert.equal(fixture.requests.length, 1);
    assert.deepEqual(fixture.requests[0].variables, { kind: "MINIATURE", ids: ["one", "two", "one"] });
    assert.match(fixture.requests[0].query, /deleteFolderItems\(/);
    assert.equal(refreshed, 1);
    assert.deepEqual(fixture.client.cache.extract(), {});
  } finally {
    fixture.dispose();
  }
});

void test("failed atomic deletes propagate without publishing cache changes or invalidations", async () => {
  const fixture = setup(async () =>
    Response.json({
      errors: [{ message: "Item not found", extensions: { code: "NOT_FOUND" } }],
      data: null,
    }),
  );
  let refreshed = 0;
  fixture.controller.listen(["TEMPLATES"], () => refreshed++);
  try {
    await assert.rejects(fixture.commands.deleteItems("TEMPLATE", ["one", "missing"]), /could not be found/);
    assert.equal(fixture.requests.length, 1);
    assert.equal(refreshed, 0);
    assert.deepEqual(fixture.client.cache.extract(), {});
  } finally {
    fixture.dispose();
  }
});

void test("atomic delete survives projection refresh but rejects a response after vault retirement", async () => {
  for (const retire of [false, true]) {
    let finish!: (value: Response) => void;
    const fixture = setup(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    try {
      const command = fixture.commands.deleteItems("MINIATURE", ["one", "two"]);
      const outcome = retire ? assert.rejects(command) : command;
      await new Promise<void>((resolve) => setImmediate(resolve));
      if (retire) fixture.controller.dispose();
      else fixture.controller.refresh();
      finish(success());
      await outcome;
      assert.equal(fixture.requests.length, 1);
    } finally {
      fixture.dispose();
    }
  }
});

void test("folder commands reject without an active vault", async () => {
  await assert.rejects(createFolderCommands(null).deleteItems("MINIATURE", ["one"]));
});

void test("retired folder command scopes never send new destructive requests", async () => {
  const fixture = setup(async () => success());
  try {
    fixture.controller.dispose();
    await assert.rejects(fixture.commands.deleteItems("MINIATURE", ["one"]));
    assert.equal(fixture.requests.length, 0);
  } finally {
    fixture.dispose();
  }
});
