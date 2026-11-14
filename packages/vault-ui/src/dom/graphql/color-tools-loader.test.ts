import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import { createVaultGraphQLClient } from "./client";
import { readColorIndex } from "./color-tools-loader";

function page(
  id: string,
  options: { seq?: string; epoch?: string; next?: string | null; more?: boolean; empty?: boolean } = {},
) {
  return {
    colorIndex: {
      revision: { epoch: options.epoch ?? "colors", seq: options.seq ?? "1" },
      nodes: options.empty
        ? []
        : [{ id, name: id, brand: "Fixture", hex: "#aabbcc", owned: false, available: true }],
      pageInfo: { hasNextPage: options.more ?? !!options.next, endCursor: options.next ?? null },
    },
  };
}
function json(data: unknown) {
  return new Response(JSON.stringify({ data }), { headers: { "content-type": "application/json" } });
}
function error(code: string) {
  return new Response(JSON.stringify({ errors: [{ message: code, extensions: { code } }] }), {
    headers: { "content-type": "application/json" },
  });
}
function fixture(reply: (call: number, after: unknown) => Response | Promise<Response>) {
  const afters: unknown[] = [];
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      assert.equal(typeof init?.body, "string");
      const body = JSON.parse(init?.body as string) as { variables: { after: unknown }; query: string };
      assert.match(body.query, /colorIndex\(first: 100/);
      afters.push(body.variables.after);
      return reply(afters.length, body.variables.after);
    },
  });
  // A failed or incomplete read must preserve unrelated previously accepted cache data.
  scope.client.cache.restore({ marker: { __typename: "Marker", value: "unchanged" } });
  const before = scope.client.cache.extract();
  return { ...scope, afters, before };
}

void test("color loader reads every compact page without a debug cap, propagates cursors and never normalizes partial data", async () => {
  const scope = fixture((call) => json(page(String(call), { next: call < 9 ? `cursor-${call}` : null })));
  try {
    const result = await readColorIndex(scope.client);
    assert.equal(result.nodes.length, 9);
    assert.deepEqual(
      result.nodes.map((row) => row.id),
      ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
    );
    assert.deepEqual(scope.afters, [
      null,
      "cursor-1",
      "cursor-2",
      "cursor-3",
      "cursor-4",
      "cursor-5",
      "cursor-6",
      "cursor-7",
      "cursor-8",
    ]);
    assert.deepEqual(
      result.nodes.map((row) => [row.owned, row.available]),
      Array.from({ length: 9 }, () => [false, true]),
    );
    assert.deepEqual(result.pageInfo, { hasNextPage: false, endCursor: null });
    assert.deepEqual(scope.client.cache.extract(), scope.before);
  } finally {
    scope.dispose();
  }
});

void test("empty color catalog returns a complete empty envelope in one request", async () => {
  const scope = fixture(() => json(page("unused", { empty: true })));
  try {
    const result = await readColorIndex(scope.client);
    assert.deepEqual(result.nodes, []);
    assert.deepEqual(scope.afters, [null]);
    assert.deepEqual(scope.client.cache.extract(), scope.before);
  } finally {
    scope.dispose();
  }
});

void test("in-flight first page remains invisible until the final page completes", async () => {
  let release: (response: Response) => void = (_response: Response) => {
    throw new Error("second request not started");
  };
  const waiting = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const scope = fixture((call) => (call === 1 ? json(page("first", { next: "second" })) : waiting));
  let settled = false;
  try {
    const read = readColorIndex(scope.client).then((result) => {
      settled = true;
      return result;
    });
    await setImmediate();
    assert.deepEqual(scope.afters, [null, "second"]);
    assert.equal(settled, false, "a consumer must never receive only the first page");
    assert.deepEqual(scope.client.cache.extract(), scope.before);
    release(json(page("last")));
    const result = await read;
    assert.deepEqual(
      result.nodes.map((row) => row.id),
      ["first", "last"],
    );
    assert.equal(settled, true);
    assert.deepEqual(scope.client.cache.extract(), scope.before);
  } finally {
    release(json(page("cleanup")));
    scope.dispose();
  }
});

for (const change of ["seq", "epoch"] as const) {
  void test(`color loader discards all partial nodes and restarts after mixed ${change}`, async () => {
    const scope = fixture((call) =>
      json(
        page(String(call), {
          seq: change === "seq" && call > 1 ? "2" : "1",
          epoch: change === "epoch" && call > 1 ? "new-colors" : "colors",
          next: call % 2 === 1 ? `cursor-${call}` : null,
        }),
      ),
    );
    try {
      const result = await readColorIndex(scope.client);
      assert.deepEqual(
        result.nodes.map((row) => row.id),
        ["3", "4"],
      );
      assert.deepEqual(scope.afters, [null, "cursor-1", null, "cursor-3"]);
      assert.equal(result.revision[change], change === "seq" ? "2" : "new-colors");
      assert.deepEqual(scope.client.cache.extract(), scope.before);
    } finally {
      scope.dispose();
    }
  });
}

void test("STALE_CURSOR on a later page retries from null without retaining earlier paints", async () => {
  const scope = fixture((call) =>
    call === 2
      ? error("STALE_CURSOR")
      : json(page(String(call), { next: call === 1 ? "old" : null, seq: call > 2 ? "2" : "1" })),
  );
  try {
    const result = await readColorIndex(scope.client);
    assert.deepEqual(
      result.nodes.map((row) => row.id),
      ["3"],
    );
    assert.deepEqual(scope.afters, [null, "old", null]);
    assert.equal(result.revision.seq, "2");
    assert.deepEqual(scope.client.cache.extract(), scope.before);
  } finally {
    scope.dispose();
  }
});

void test("repeated stale cursors and revision drift terminate after three attempts without any cache commit", async () => {
  for (const failure of ["stale", "drift"] as const) {
    const scope = fixture((call) =>
      failure === "stale"
        ? error("STALE_CURSOR")
        : json(page(String(call), { seq: String(call), next: call % 2 ? `cursor-${call}` : null })),
    );
    try {
      await assert.rejects(readColorIndex(scope.client));
      assert.equal(scope.afters.length, failure === "stale" ? 3 : 6);
      assert.deepEqual(scope.client.cache.extract(), scope.before);
    } finally {
      scope.dispose();
    }
  }
});

void test("missing and non-advancing next cursors reject without exposing a partial result", async () => {
  for (const next of [null, "same"]) {
    const scope = fixture((call) =>
      json(page(String(call), { more: true, next: next === null ? null : "same" })),
    );
    try {
      await assert.rejects(readColorIndex(scope.client));
      assert.equal(scope.afters.length, next === null ? 1 : 2);
      assert.deepEqual(scope.client.cache.extract(), scope.before);
    } finally {
      scope.dispose();
    }
  }
});

void test("non-stale GraphQL and transport errors reject once and preserve the accepted cache", async () => {
  for (const failure of ["graphql", "transport", "missing-data"] as const) {
    const scope = fixture((call) => {
      if (call === 1) return json(page("partial", { next: "second" }));
      if (failure === "transport") throw new Error("offline fixture");
      return failure === "graphql" ? error("BAD_USER_INPUT") : json(null);
    });
    try {
      await assert.rejects(readColorIndex(scope.client));
      assert.deepEqual(scope.afters, [null, "second"]);
      assert.deepEqual(scope.client.cache.extract(), scope.before);
    } finally {
      scope.dispose();
    }
  }
});

void test("multi-cursor cycles fail closed rather than looping within one revision", async () => {
  const scope = fixture((call) => json(page(String(call), { next: call % 2 ? "A" : "B" })));
  try {
    await assert.rejects(readColorIndex(scope.client));
    assert.deepEqual(scope.afters, [null, "A", "B"]);
    assert.deepEqual(scope.client.cache.extract(), scope.before);
  } finally {
    scope.dispose();
  }
});
