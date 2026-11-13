import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ApolloClient, ApolloLink, Observable } from "@apollo/client";

import { createVaultCache } from "./cache.ts";
import { InstalledSourcesDocument } from "./generated/graphql.ts";
import { VaultInvalidationController } from "./invalidation.ts";
import { readInstalledSources, readPluginRemoval, readPluginShareable } from "./sources-loader.ts";

const revision = (seq = "1") => ({ epoch: "fixture", seq });
function fixture(respond: (operation: string, request: number) => Promise<Record<string, unknown>>) {
  let requests = 0;
  const operations: string[] = [];
  const controller = new VaultInvalidationController();
  const client = new ApolloClient({
    cache: createVaultCache(),
    link: new ApolloLink(
      (operation) =>
        new Observable((observer) => {
          operations.push(operation.operationName ?? "");
          void respond(operation.operationName ?? "", ++requests).then(
            (data) => {
              observer.next({ data });
              observer.complete();
            },
            (error: unknown) => observer.error(error),
          );
        }),
    ),
  });
  return { client, controller, operations };
}
const installed = (seq = "1") => ({ sources: { revision: revision(seq), sources: [] } });

void test("installed metadata does not request versions, shareable rows or removal details", async () => {
  const scope = fixture(async () => installed());
  try {
    assert.deepEqual((await readInstalledSources(scope)).sources, []);
    assert.deepEqual(scope.operations, ["InstalledSources"]);
    assert.ok(scope.client.readQuery({ query: InstalledSourcesDocument }));
    assert.equal(scope.controller.getCursor()?.seq, "1");
  } finally {
    scope.client.stop();
    scope.controller.dispose();
  }
});

void test("metadata response predating SOURCES invalidation retries before cache commit", async () => {
  const scope = fixture(async (_operation, request) => {
    if (request === 1) scope.controller.event({ ...revision("2"), reset: false, families: ["SOURCES"] });
    return installed(request === 1 ? "1" : "2");
  });
  try {
    const result = await readInstalledSources(scope);
    assert.equal(result.revision.seq, "2");
    assert.equal(scope.operations.length, 2);
    assert.equal(scope.client.readQuery({ query: InstalledSourcesDocument })?.sources.revision.seq, "2");
  } finally {
    scope.client.stop();
    scope.controller.dispose();
  }
});

void test("disposed account scope cannot publish late plugin licenses", async () => {
  const scope = fixture(async () => {
    scope.controller.dispose();
    return installed();
  });
  try {
    await assert.rejects(readInstalledSources(scope), /connection changed/);
    assert.equal(scope.client.readQuery({ query: InstalledSourcesDocument }), null);
  } finally {
    scope.client.stop();
  }
});

void test("share choices and removal are separate explicit reads", async () => {
  const scope = fixture(async (operation) =>
    operation === "PluginShareable"
      ? {
          sourceShareable: {
            revision: revision(),
            paints: [{ id: "user:paint", name: "Custom · Paint" }],
            schemes: [],
            templates: [],
          },
        }
      : {
          sourceRemoval: {
            revision: revision(),
            source: { id: "plugin", name: "Plugin", version: "1.0.0" },
            removes: { paints: 1, schemes: 0, templates: 0 },
            blockers: [{ label: "Paint inventory", count: 1 }],
            canRemove: false,
          },
        },
  );
  try {
    assert.equal((await readPluginShareable(scope)).paints[0].name, "Custom · Paint");
    assert.equal((await readPluginRemoval(scope, "plugin")).canRemove, false);
    assert.deepEqual(scope.operations, ["PluginShareable", "PluginRemoval"]);
  } finally {
    scope.client.stop();
    scope.controller.dispose();
  }
});

void test("Settings has no collection hooks and Plugins reads are Apollo, not REST GET", () => {
  const settings = readFileSync(new URL("../Pages/Settings/SettingsScreen.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(settings, /useVault\(|useQuery|\/api\/(?:state|catalog-sources|catalog-share)/);
  const plugins = readFileSync(new URL("../Pages/Sources/PluginsModal.tsx", import.meta.url), "utf8");
  assert.match(plugins, /usePluginSources/);
  assert.doesNotMatch(plugins, /useVault\(|@tanstack|\?preview=|loadShareable/);
  const hook = readFileSync(new URL("./sources-hooks.ts", import.meta.url), "utf8");
  assert.doesNotMatch(hook, /\/api\//);
});
