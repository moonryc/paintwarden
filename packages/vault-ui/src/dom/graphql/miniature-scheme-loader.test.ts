import assert from "node:assert/strict";
import test from "node:test";

import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { Observable } from "rxjs";

import { readMiniatureScheme, readSchemeOptions } from "./miniature-scheme-loader";

const paint = {
  __typename: "Paint",
  id: "paint",
  brand: "Test",
  range: "Test",
  name: "Unmasked paint",
  colorHex: "#123456",
  sourceUrl: null,
  isCustom: true,
  sourceName: null,
  sourceLogoUrl: null,
  inventory: null,
  available: false,
  hasActiveSubstitution: false,
  brokenReason: null,
  missingStock: true,
  brokenSubstitution: false,
  activeSubstitution: null,
};
const summary = (id: string) => ({
  __typename: "MiniatureScheme",
  id,
  name: `Scheme ${id}`,
  category: "Armor",
  isSystem: false,
  sourceName: null,
  sourceLogoUrl: null,
  paintCount: 1,
  availableCount: 0,
  previewSwatches: [{ paintId: "paint", colorHex: "#123456" }],
  previewSwatchesTruncated: false,
  imageUrl: null,
});
const info = (cursor: string | null = null) => ({ hasNextPage: !!cursor, endCursor: cursor });
function detail(seq: string, cursor: string | null, id: string, epoch = "epoch") {
  return {
    miniatureScheme: {
      revision: { epoch, seq },
      scheme: summary("scheme"),
      entries: {
        nodes: [
          {
            id,
            kind: "PAINT",
            sortOrder: 0,
            paint,
            label: null,
            tone: "base",
            role: null,
            imageUrl: null,
            thumbnailUrl: null,
            imageType: null,
            method: null,
          },
        ],
        totalCount: 3,
        pageInfo: info(cursor),
      },
    },
  };
}
function options(seq: string, cursor: string | null, id: string, epoch = "epoch") {
  return {
    schemeOptions: {
      revision: { epoch, seq },
      nodes: [summary(id)],
      categoryCounts: [{ key: "Armor", label: "Armor", count: 3 }],
      totalCount: 3,
      pageInfo: info(cursor),
    },
  };
}
function mockClient(reply: (variables: Record<string, unknown>, name: string) => unknown) {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(
      (operation) =>
        new Observable((observer) => {
          observer.next(reply(operation.variables, operation.operationName ?? "") as { data: never });
          observer.complete();
        }),
    ),
  });
}
const filters = { search: "armor", category: "Armor", excludeIds: ["excluded"] };

void test("scheme details load every entry page atomically, unmask paints, and leave cache untouched", async () => {
  const calls: unknown[] = [];
  const client = mockClient((variables, name) => {
    assert.equal(name, "MiniatureSchemeDetails");
    calls.push(variables.after);
    if (variables.after === "one") return { data: detail("1", "two", "middle") };
    if (variables.after === "two") return { data: detail("1", null, "last") };
    return { data: detail("1", "one", "first") };
  });
  const result = await readMiniatureScheme(client, "scheme");
  assert.deepEqual(calls, [null, "one", "two"]);
  assert.deepEqual(
    result.entries.nodes.map((entry) => entry.id),
    ["first", "middle", "last"],
  );
  assert.equal(result.entries.nodes[2].paint?.name, "Unmasked paint");
  assert.equal(result.scheme?.paintCount, 1);
  assert.equal(result.entries.totalCount, 3);
  assert.equal(result.entries.pageInfo.hasNextPage, false);
  assert.deepEqual(client.cache.extract(), {});
  client.stop();
});

void test("scheme options rebuild exactly the requested window and pass search/category/exclusions on every page", async () => {
  const calls: unknown[] = [];
  const client = mockClient((variables, name) => {
    assert.equal(name, "SchemePickerOptions");
    const { after, ...receivedFilters } = variables;
    assert.deepEqual(receivedFilters, filters);
    calls.push(after);
    return { data: options("1", after ? "two" : "one", after ? "second" : "first") };
  });
  const result = await readSchemeOptions(client, filters, 2);
  assert.deepEqual(calls, [null, "one"]);
  assert.deepEqual(
    result.nodes.map((scheme) => scheme.name),
    ["Scheme first", "Scheme second"],
  );
  assert.equal(result.totalCount, 3);
  assert.equal(result.pageInfo.hasNextPage, true);
  assert.deepEqual(result.categoryCounts, [{ key: "Armor", label: "Armor", count: 3 }]);
  assert.deepEqual(client.cache.extract(), {});
  client.stop();
});

for (const kind of ["detail", "options"] as const) {
  const page = kind === "detail" ? detail : options;
  const read = (client: ApolloClient) =>
    kind === "detail" ? readMiniatureScheme(client, "scheme") : readSchemeOptions(client, filters, 2);
  const ids = (result: Awaited<ReturnType<typeof read>>) =>
    "entries" in result
      ? result.entries.nodes.map((entry) => entry.id)
      : result.nodes.map((scheme) => scheme.id);

  for (const failure of ["revision", "epoch", "stale cursor"] as const) {
    void test(`${kind} restarts from page one on ${failure} without exposing mixed revisions`, async () => {
      const cursors: unknown[] = [];
      let calls = 0;
      const client = mockClient((variables) => {
        calls += 1;
        cursors.push(variables.after);
        if (calls === 2 && failure === "stale cursor")
          return { errors: [{ message: "Old cursor", extensions: { code: "STALE_CURSOR" } }] };
        const epoch = failure === "epoch" && calls > 1 ? "new-epoch" : "epoch";
        return {
          data: page(
            calls === 1 ? "1" : "2",
            variables.after ? null : "next",
            calls === 1 ? "discarded" : variables.after ? "last" : "fresh",
            epoch,
          ),
        };
      });
      const result = await read(client);
      assert.equal(result.revision.seq, "2");
      assert.deepEqual(cursors, [null, "next", null, "next"]);
      assert.deepEqual(ids(result), ["fresh", "last"]);
      assert.deepEqual(client.cache.extract(), {});
      client.stop();
    });
  }

  void test(`${kind} stops after three changing attempts and does not cache partial pages`, async () => {
    let calls = 0;
    const client = mockClient((variables) => ({
      data: page(String(++calls), variables.after ? null : "next", "entry"),
    }));
    await assert.rejects(read(client), /changed while refreshing/);
    assert.equal(calls, 6);
    assert.deepEqual(client.cache.extract(), {});
    client.stop();
  });

  void test(`${kind} surfaces real errors and malformed cursors without retry loops`, async () => {
    const denied = mockClient(() => ({
      errors: [{ message: "Access denied", extensions: { code: "FORBIDDEN" } }],
    }));
    await assert.rejects(read(denied), /Access denied/);
    denied.stop();
    const invalid = mockClient(() => {
      const data = page("1", "next", "entry");
      const connection = "miniatureScheme" in data ? data.miniatureScheme.entries : data.schemeOptions;
      connection.pageInfo.endCursor = null;
      return { data };
    });
    await assert.rejects(read(invalid), /invalid page cursor/);
    invalid.stop();
  });
}

void test("deleted scheme returns an empty complete view with nullable summary", async () => {
  const client = mockClient(() => ({
    data: {
      miniatureScheme: {
        revision: { epoch: "epoch", seq: "1" },
        scheme: null,
        entries: { nodes: [], totalCount: 0, pageInfo: info() },
      },
    },
  }));
  const result = await readMiniatureScheme(client, "deleted");
  assert.equal(result.scheme, null);
  assert.deepEqual(result.entries.nodes, []);
  client.stop();
});
