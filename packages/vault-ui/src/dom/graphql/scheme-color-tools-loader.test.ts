import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import { createVaultGraphQLClient } from "./client";
import { readSchemeColorIndex } from "./color-tools-loader";

function page(
  id: string,
  options: {
    seq?: string;
    epoch?: string;
    next?: string | null;
    more?: boolean;
    empty?: boolean;
    scheme?: string;
  } = {},
) {
  return {
    schemeColorIndex: {
      revision: { epoch: options.epoch ?? "schemes", seq: options.seq ?? "1" },
      nodes: options.empty
        ? []
        : [
            {
              schemeId: options.scheme ?? "shared",
              schemeName: options.scheme ?? "Shared scheme",
              paint: { id, name: id, brand: "Fixture", hex: "#aabbcc", owned: false, available: true },
            },
          ],
      pageInfo: { hasNextPage: options.more ?? !!options.next, endCursor: options.next ?? null },
    },
  };
}
const json = (data: unknown) =>
  new Response(JSON.stringify({ data }), { headers: { "content-type": "application/json" } });
const error = (code: string) =>
  new Response(JSON.stringify({ errors: [{ message: code, extensions: { code } }] }), {
    headers: { "content-type": "application/json" },
  });
function fixture(reply: (call: number) => Response | Promise<Response>) {
  const afters: unknown[] = [];
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      const body = JSON.parse(init?.body as string) as { query: string; variables: { after: unknown } };
      assert.match(body.query, /schemeColorIndex\(first: 100/);
      afters.push(body.variables.after);
      return reply(afters.length);
    },
  });
  scope.client.cache.restore({ marker: { __typename: "Marker", value: "unchanged" } });
  return { ...scope, afters, before: scope.client.cache.extract() };
}

void test("scheme loader merges a scheme across bounded pages, preserving paint flags and all schemes without cache writes", async () => {
  const scope = fixture((call) =>
    json(
      page(String(call), {
        next: call < 9 ? `cursor-${call}` : null,
        scheme: call < 9 ? "shared" : "other",
      }),
    ),
  );
  try {
    const result = await readSchemeColorIndex(scope.client);
    assert.deepEqual(
      result.schemes.map((scheme) => [scheme.id, scheme.paints.length]),
      [
        ["shared", 8],
        ["other", 1],
      ],
    );
    assert.deepEqual(
      result.schemes[0].paints.map((paint) => paint.id),
      ["1", "2", "3", "4", "5", "6", "7", "8"],
    );
    assert.ok(
      result.schemes.flatMap((scheme) => scheme.paints).every((paint) => !paint.owned && paint.available),
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
    assert.deepEqual(scope.client.cache.extract(), scope.before);
  } finally {
    scope.dispose();
  }
});

void test("scheme loader returns empty catalogs as empty schemes", async () => {
  const scope = fixture(() => json(page("unused", { empty: true })));
  try {
    assert.deepEqual((await readSchemeColorIndex(scope.client)).schemes, []);
    assert.deepEqual(scope.afters, [null]);
  } finally {
    scope.dispose();
  }
});

void test("scheme loader keeps partial memberships invisible until the complete generation arrives", async () => {
  let release!: (response: Response) => void;
  const waiting = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const scope = fixture((call) => (call === 1 ? json(page("first", { next: "second" })) : waiting));
  let settled = false;
  try {
    const read = readSchemeColorIndex(scope.client).then((result) => {
      settled = true;
      return result;
    });
    await setImmediate();
    assert.deepEqual(scope.afters, [null, "second"]);
    assert.equal(settled, false);
    assert.deepEqual(scope.client.cache.extract(), scope.before);
    release(json(page("last")));
    assert.deepEqual(
      (await read).schemes[0].paints.map((paint) => paint.id),
      ["first", "last"],
    );
  } finally {
    release(json(page("cleanup")));
    scope.dispose();
  }
});

for (const change of ["seq", "epoch", "stale"] as const) {
  void test(`scheme loader discards partial schemes and restarts after ${change}`, async () => {
    const scope = fixture((call) =>
      call === 2 && change === "stale"
        ? error("STALE_CURSOR")
        : json(
            page(String(call), {
              seq: change === "seq" && call > 1 ? "2" : "1",
              epoch: change === "epoch" && call > 1 ? "new-schemes" : "schemes",
              next: call % 2 ? `cursor-${call}` : null,
            }),
          ),
    );
    try {
      const result = await readSchemeColorIndex(scope.client);
      assert.deepEqual(
        result.schemes[0].paints.map((paint) => paint.id),
        ["3", "4"],
      );
      assert.deepEqual(scope.afters, [null, "cursor-1", null, "cursor-3"]);
      assert.deepEqual(scope.client.cache.extract(), scope.before);
    } finally {
      scope.dispose();
    }
  });
}

void test("scheme loader terminates retries and cursor cycles, and rejects failed pages without publishing partial schemes", async () => {
  for (const failure of [
    "stale",
    "drift",
    "missing-cursor",
    "cycle",
    "graphql",
    "transport",
    "missing-data",
  ] as const) {
    const scope = fixture((call) => {
      if (failure === "stale") return error("STALE_CURSOR");
      if (failure === "drift")
        return json(page(String(call), { seq: String(call), next: call % 2 ? `cursor-${call}` : null }));
      if (failure === "missing-cursor") return json(page("one", { more: true }));
      if (failure === "cycle") return json(page(String(call), { next: call % 2 ? "A" : "B" }));
      if (call === 1) return json(page("partial", { next: "second" }));
      if (failure === "transport") throw new Error("offline fixture");
      return failure === "graphql" ? error("BAD_USER_INPUT") : json(null);
    });
    try {
      await assert.rejects(readSchemeColorIndex(scope.client));
      const expected =
        failure === "drift"
          ? 6
          : failure === "stale" || failure === "cycle"
            ? 3
            : failure === "missing-cursor"
              ? 1
              : 2;
      assert.equal(scope.afters.length, expected);
      assert.deepEqual(scope.client.cache.extract(), scope.before);
    } finally {
      scope.dispose();
    }
  }
});
