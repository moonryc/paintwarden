import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import type { Invalidation } from "./changes.ts";
import type { readLibrary } from "./library.ts";

const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-graphql-api-"));
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
process.env.HOST = "127.0.0.1";
process.env.NODE_ENV = "test";
const { routeApi } = await import("../server/api-router.ts");
const { getSqlite } = await import("../db/index.ts");
const { changeLogEpoch, currentChangeSeq, pruneChangeLog } = await import("../db/change-log.ts");
const { invalidationSince, subscribeChanges } = await import("./changes.ts");
const sqlite = getSqlite();
const base = "http://127.0.0.1:3000";
const token = "a".repeat(64);
const tokenHash = createHash("sha256").update(token).digest("hex");
const query = `query Library($first:Int! = 48,$after:String) { library(first:$first,after:$after) {
  nodes { id brand range name colorHex type discontinued inventory { state stockLevel quantity } }
  pageInfo { hasNextPage endCursor } revision { epoch seq }
} }`;
const subscription =
  "subscription Changes($epoch:String!,$since:Sequence!){vaultChanges(epoch:$epoch,since:$since){epoch seq reset}}";
function post(body: unknown, extra: HeadersInit = {}, endpoint = "/api/graphql", signal?: AbortSignal) {
  return routeApi(
    new Request(base + endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...extra },
      body: JSON.stringify(body),
      signal,
    }),
  );
}
function owner(signIn = 1) {
  sqlite
    .prepare(
      "INSERT OR REPLACE INTO vault_account(id,username,password_hash,require_sign_in) VALUES(1,'test-owner','not-a-real-hash',?)",
    )
    .run(signIn);
  sqlite
    .prepare("INSERT OR REPLACE INTO vault_sessions(token_hash,expires_at) VALUES(?,?)")
    .run(tokenHash, Date.now() + 60_000);
}
const paintId = (index: number) => `user:00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
function addPaint(id: string, name = "Same name") {
  sqlite
    .prepare("INSERT INTO paint_catalog(id,brand,range,name,color_hex) VALUES(?,'Test','Base',?,'#123456')")
    .run(id, name);
}
function streamBody(epoch = changeLogEpoch, since: string | number = currentChangeSeq(sqlite)) {
  return { query: subscription, variables: { epoch, since: String(since) } };
}
async function nextFrame(reader: ReadableStreamDefaultReader<Uint8Array>) {
  let text = "";
  const timeout = setTimeout(() => {
    void reader.cancel("test timeout");
  }, 5000);
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) return text;
      text += new TextDecoder().decode(part.value);
      if (text.includes("data: ") && text.includes("\n\n")) return text;
    }
  } finally {
    clearTimeout(timeout);
  }
}
type LibraryPage = Omit<ReturnType<typeof readLibrary>, "revision"> & {
  revision: { epoch: string; seq: string };
};
type StreamData = { data: { vaultChanges: Omit<Invalidation, "seq"> & { seq: string } } };
function nextData(frame: string): StreamData {
  const line = frame.split("\n").find((line) => line.startsWith("data: "));
  assert.ok(line, frame);
  return JSON.parse(line.slice(6)) as StreamData;
}

test("protected Yoga routes, bounded real SQLite Library and resumable SSE", async (t) => {
  try {
    assert.equal((await post({ query })).status, 428);
    owner();
    assert.equal((await post({ query }, { authorization: "" })).status, 401);
    assert.equal((await post({ query }, { origin: "https://attacker.invalid" })).status, 403);
    assert.equal(
      (
        await post(
          streamBody(),
          { origin: "paintvault://app", accept: "text/event-stream" },
          "/api/graphql/stream",
        )
      ).status,
      403,
    );
    assert.equal((await post({ query }, { "content-type": "text/plain" })).status, 415);
    assert.equal(
      (
        await routeApi(
          new Request(base + "/api/graphql?query=mutation%7Bx%7D", {
            headers: { authorization: `Bearer ${token}` },
          }),
        )
      ).status,
      405,
    );
    assert.equal((await post([{ query }])).status, 400);
    assert.equal((await post({ query, extensions: { persistedQuery: {} } })).status, 400);
    assert.equal((await post({ query: "query {__schema {queryType{name}}}" })).status, 400);
    assert.equal((await post({ query: "mutation {library{nodes{id}}}" })).status, 400);
    assert.equal((await post({ query: 'subscription {vaultChanges(epoch:"x",since:0){seq}}' })).status, 400);
    assert.equal((await post({ query }, { accept: "text/event-stream" }, "/api/graphql/stream")).status, 400);
    assert.equal((await post(streamBody(), {}, "/api/graphql/stream")).status, 406);
    assert.equal((await post({ query: " ".repeat(32 * 1024 + 1) })).status, 400);
    assert.equal((await post({ query, padding: "x".repeat(128 * 1024) })).status, 413);
    const chunked = new Request(base + "/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              JSON.stringify({ query, variables: { padding: "x".repeat(128 * 1024) } }),
            ),
          );
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit);
    assert.equal((await routeApi(chunked)).status, 413);

    await t.test("host policy remains enforced with sign-in off", async () => {
      sqlite.prepare("UPDATE vault_account SET require_sign_in=0").run();
      const refused = await routeApi(
        new Request("http://attacker.invalid/api/graphql", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query }),
        }),
      );
      assert.equal(refused.status, 403);
      owner();
    });

    await t.test(
      "stable pages include inventory and same-transaction revision, snapshot unchanged",
      async () => {
        for (let i = 0; i < 7; i++) addPaint(paintId(i));
        sqlite
          .prepare(
            "INSERT INTO paint_inventory(paint_id,state,stock_level,quantity) VALUES(?,'OWNED','FULL',2)",
          )
          .run(paintId(0));
        const ids: string[] = [];
        let after: string | null = null;
        do {
          const response = await post({ query, variables: { first: 2, after } });
          assert.equal(response.status, 200);
          assert.equal(response.headers.get("cache-control"), "no-store");
          assert.equal(response.headers.get("access-control-allow-origin"), null);
          const payload = (await response.json()) as { errors?: unknown; data: { library: LibraryPage } };
          assert.equal(payload.errors, undefined, JSON.stringify(payload));
          const page = payload.data.library;
          assert.deepEqual(page.revision, { epoch: changeLogEpoch, seq: String(currentChangeSeq(sqlite)) });
          assert.ok(page.nodes.length <= 2);
          ids.push(...page.nodes.map((paint: { id: string }) => paint.id));
          if (ids.length === 2)
            assert.deepEqual(page.nodes[0].inventory, { state: "OWNED", stockLevel: "FULL", quantity: 2 });
          after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
        } while (after);
        assert.deepEqual(
          ids,
          Array.from({ length: 7 }, (_, i) => paintId(i)),
        );
        const invalid = await post({ query, variables: { after: "not-a-cursor" } });
        const invalidBody = (await invalid.json()) as { errors: { message: string }[] };
        assert.match(invalidBody.errors[0].message, /Invalid Library cursor/);
        assert.doesNotMatch(JSON.stringify(invalidBody), /SELECT|sqlite|stack|password_hash/);
        for (const first of [0, 101, -1])
          assert.equal((await post({ query, variables: { first } })).status, 400);
        const old = await routeApi(
          new Request(base + "/api/state", { headers: { authorization: `Bearer ${token}` } }),
        );
        const state = await old.json();
        assert.equal(state.catalog.length, 7);
        assert.ok(Array.isArray(state.miniatures));
      },
    );

    await t.test("stale Library cursors cannot mix collection generations", async () => {
      const page = (await (await post({ query, variables: { first: 2 } })).json()) as {
        data: { library: LibraryPage };
      };
      sqlite.prepare("UPDATE paint_catalog SET name='Moved sort row' WHERE id=?").run(paintId(0));
      const stale = (await (
        await post({ query, variables: { first: 2, after: page.data.library.pageInfo.endCursor } })
      ).json()) as { errors: { extensions: { code: string } }[] };
      assert.equal(stale.errors[0].extensions.code, "STALE_CURSOR");
    });

    await t.test("budget rejection happens before Library SQL execution", async () => {
      const prepare = sqlite.prepare;
      let dataReads = 0;
      sqlite.prepare = function (sql: string) {
        if (sql.includes("FROM paint_catalog p") || sql.includes("FROM vault_changes")) dataReads++;
        return prepare.call(sqlite, sql);
      } as typeof sqlite.prepare;
      try {
        for (const body of [
          { query, variables: { first: 101 } },
          {
            query:
              "query { a:library {nodes{id}} b:library {nodes{id}} c:library {nodes{id}} d:library {nodes{id}} }",
          },
          {
            query:
              "query { library { nodes { " +
              Array.from({ length: 11 }, (_, i) => `alias${i}:id`).join(" ") +
              " } } }",
          },
        ])
          assert.equal((await post(body)).status, 400);
        for (const since of [
          0,
          -1,
          null,
          "-1",
          "01",
          "1e3",
          "9007199254740992",
          "999999999999999999999999",
        ]) {
          const response = await post(
            { query: subscription, variables: { epoch: changeLogEpoch, since } },
            { accept: "text/event-stream" },
            "/api/graphql/stream",
          );
          assert.equal(response.status, 400);
        }
        assert.equal(dataReads, 0);
      } finally {
        sqlite.prepare = prepare;
      }
    });

    await t.test("unexpected SQLite errors are masked with a correlation ID", async () => {
      const prepare = sqlite.prepare;
      sqlite.prepare = function (sql: string) {
        if (sql.includes("max(seq)")) throw new Error("SELECT private_note FROM /private/vault.sqlite");
        return prepare.call(sqlite, sql);
      } as typeof sqlite.prepare;
      try {
        const response = await post({ query });
        const payload = (await response.json()) as {
          errors: { message: string; extensions: { correlationId: string } }[];
        };
        assert.equal(payload.errors[0].message, "Unexpected server error");
        assert.match(payload.errors[0].extensions.correlationId, /^[a-f0-9-]{36}$/);
        assert.doesNotMatch(JSON.stringify(payload), /SELECT|private_note|vault.sqlite|stack/);
      } finally {
        sqlite.prepare = prepare;
      }
    });

    await t.test("GraphQL stock writes coexist with REST snapshots, row deltas and revisions", async () => {
      const id = paintId(900);
      addPaint(id, "Stock fixture");
      const since = currentChangeSeq(sqlite);
      const mutation = `mutation Stock($id:ID!,$state:Ownership,$quantity:Int){setPaintStock(paintId:$id,state:$state,quantity:$quantity,stockLevel:LOW,clientMutationId:"stock-1"){
        revision{epoch seq} paint{id available inventory{state stockLevel quantity}} clientMutationId invalidatedFamilies
      }}`;
      type Result = {
        data: {
          setPaintStock: {
            revision: { epoch: string; seq: string };
            paint: {
              id: string;
              available: boolean;
              inventory: { state: string; stockLevel: string; quantity: number } | null;
            };
            clientMutationId: string;
            invalidatedFamilies: string[];
          };
        };
      };
      const response = await post({ query: mutation, variables: { id, state: "OWNED", quantity: 4 } });
      assert.equal(response.status, 200);
      const payload = (await response.json()) as Result;
      const result = payload.data.setPaintStock;
      assert.equal(result.paint.id, id);
      assert.equal(result.paint.available, true);
      assert.deepEqual(result.paint.inventory, { state: "OWNED", stockLevel: "LOW", quantity: 4 });
      assert.equal(result.clientMutationId, "stock-1");
      assert.equal(result.revision.epoch, changeLogEpoch);
      assert.equal(result.revision.seq, String(currentChangeSeq(sqlite)));
      assert.ok(Number(result.revision.seq) > since);
      assert.ok(result.invalidatedFamilies.includes("LIBRARY"));
      assert.ok(result.invalidatedFamilies.includes("WISHLIST"));
      const delta = await routeApi(
        new Request(`${base}/api/changes?epoch=${changeLogEpoch}&since=${since}`, {
          headers: { authorization: `Bearer ${token}` },
        }),
      );
      const rows = (await delta.json()) as {
        reload: boolean;
        changes: { table: string; row: { paintId: string; quantity: number } | null }[];
      };
      assert.equal(rows.reload, false);
      assert.ok(
        rows.changes.some((r) => r.table === "paintRecords" && r.row?.paintId === id && r.row.quantity === 4),
      );
      const cleared = await post({ query: mutation, variables: { id, state: "OWNED", quantity: 0 } });
      const clearResult = ((await cleared.json()) as Result).data.setPaintStock;
      assert.equal(clearResult.paint.inventory, null);
      assert.equal(clearResult.paint.available, false);
      const unknown = await post({
        query: mutation,
        variables: { id: paintId(9999), state: "OWNED", quantity: 1 },
      });
      assert.equal(
        ((await unknown.json()) as { errors: { extensions: { code: string } }[] }).errors[0].extensions.code,
        "NOT_FOUND",
      );
      const rest = await routeApi(
        new Request(base + "/api/paint-state", {
          method: "PUT",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ paintId: id, state: "WISHLIST", stockLevel: "EMPTY" }),
        }),
      );
      assert.equal(rest.status, 200);
      const reread = await post({
        query: `{paint(id:"${id}"){revision{seq} paint{inventory{state stockLevel quantity}}}}`,
      });
      const view = (await reread.json()) as {
        data: {
          paint: {
            revision: { seq: string };
            paint: { inventory: { state: string; stockLevel: string; quantity: number } };
          };
        };
      };
      assert.deepEqual(view.data.paint.paint.inventory, {
        state: "WISHLIST",
        stockLevel: "EMPTY",
        quantity: 0,
      });
      assert.equal(view.data.paint.revision.seq, String(currentChangeSeq(sqlite)));
    });

    await t.test("POST SSE initial catchup, cross-client write and reconnect", async () => {
      const since = currentChangeSeq(sqlite);
      addPaint(paintId(100));
      const response = await post(
        streamBody(changeLogEpoch, since),
        { accept: "text/event-stream" },
        "/api/graphql/stream",
      );
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type")!, /^text\/event-stream/);
      assert.equal(response.headers.get("x-accel-buffering"), "no");
      const reader = response.body!.getReader();
      const initial = nextData(await nextFrame(reader));
      assert.equal(initial.data.vaultChanges.seq, String(currentChangeSeq(sqlite)));
      assert.equal(initial.data.vaultChanges.reset, false);
      const baseline = initial.data.vaultChanges;
      addPaint(paintId(101));
      const change = nextData(await nextFrame(reader));
      assert.ok(BigInt(change.data.vaultChanges.seq) > BigInt(baseline.seq));
      await reader.cancel();
      addPaint(paintId(102));
      const reconnected = await post(
        streamBody(changeLogEpoch, change.data.vaultChanges.seq),
        { accept: "text/event-stream" },
        "/api/graphql/stream",
      );
      const resumed = reconnected.body!.getReader();
      assert.equal(
        nextData(await nextFrame(resumed)).data.vaultChanges.seq,
        String(currentChangeSeq(sqlite)),
      );
      await resumed.cancel();
    });

    await t.test("epoch/future/overflow/pruned cursors reset without snapshot materialization", () => {
      assert.equal(invalidationSince({ epoch: "old-server", since: 0 }).reset, true);
      assert.equal(
        invalidationSince({ epoch: changeLogEpoch, since: currentChangeSeq(sqlite) + 1 }).reset,
        true,
      );
      const since = currentChangeSeq(sqlite);
      const insert = sqlite.prepare("INSERT INTO vault_changes(table_key,row_key) VALUES('catalog',?)");
      sqlite.transaction(() => {
        for (let i = 0; i < 2001; i++) insert.run(JSON.stringify([`user:overflow-${i}`]));
      })();
      assert.equal(invalidationSince({ epoch: changeLogEpoch, since }).reset, true);
      sqlite.prepare("INSERT INTO vault_changes(seq,table_key,row_key) VALUES(50000,'$reload','[]')").run();
      pruneChangeLog(sqlite);
      assert.equal(invalidationSince({ epoch: changeLogEpoch, since: 0 }).reset, true);
    });

    await t.test("Library and SSE preserve decimal sequence revisions beyond Int32", async () => {
      const largeSequence = 2147483648;
      sqlite
        .prepare("INSERT INTO vault_changes(seq,table_key,row_key) VALUES(?,'catalog',?)")
        .run(largeSequence, JSON.stringify([paintId(0)]));
      const response = await post({ query });
      assert.equal(response.status, 200);
      const payload = (await response.json()) as { data: { library: LibraryPage }; errors?: unknown };
      assert.equal(payload.errors, undefined);
      assert.equal(payload.data.library.revision.seq, String(largeSequence));
      addPaint(paintId(200));
      const catchup = await post(
        streamBody(changeLogEpoch, String(largeSequence)),
        { accept: "text/event-stream" },
        "/api/graphql/stream",
      );
      assert.equal(catchup.status, 200);
      const reader = catchup.body!.getReader();
      try {
        assert.deepEqual(nextData(await nextFrame(reader)).data.vaultChanges, {
          epoch: changeLogEpoch,
          seq: String(largeSequence + 1),
          reset: false,
        });
      } finally {
        await reader.cancel();
      }
    });

    await t.test("session expiry terminates an idle SSE connection", async () => {
      const response = await post(streamBody(), { accept: "text/event-stream" }, "/api/graphql/stream");
      const reader = response.body!.getReader();
      assert.ok(nextData(await nextFrame(reader)).data.vaultChanges);
      sqlite.prepare("UPDATE vault_sessions SET expires_at=0 WHERE token_hash=?").run(tokenHash);
      const frame = await nextFrame(reader);
      assert.match(frame, /UNAUTHENTICATED/);
      await reader.cancel();
      owner();
    });

    await t.test("iterator cancellation and request abort release idle timers", async () => {
      const controller = new AbortController();
      const iterator = subscribeChanges(
        new Request(base, { headers: { authorization: `Bearer ${token}` }, signal: controller.signal }),
        { epoch: changeLogEpoch, since: currentChangeSeq(sqlite) },
        5,
      );
      assert.equal((await iterator.next()).done, false);
      const pending = iterator.next();
      controller.abort();
      assert.equal((await pending).done, true);
      assert.equal((await iterator.next()).done, true);
    });

    await t.test("bounded per-client concurrent SSE slots recover after cancellation", async () => {
      const responses: Response[] = [];
      for (let i = 0; i < 4; i++)
        responses.push(await post(streamBody(), { accept: "text/event-stream" }, "/api/graphql/stream"));
      assert.ok(responses.every((response) => response.status === 200));
      assert.equal(
        (await post(streamBody(), { accept: "text/event-stream" }, "/api/graphql/stream")).status,
        429,
      );
      await Promise.all(responses.map((response) => response.body!.cancel()));
      const again = await post(streamBody(), { accept: "text/event-stream" }, "/api/graphql/stream");
      assert.equal(again.status, 200);
      await again.body!.cancel();
    });
    await t.test("picker preserves uncapped exclusions beyond 100 while keeping output bounded", async () => {
      const ids = Array.from({ length: 102 }, (_, index) => paintId(1000 + index));
      for (const [index, id] of ids.entries()) addPaint(id, `Large exclusions ${index}`);
      const response = await post({
        query:
          'query Picker($exclude:[ID!]){paintOptions(first:30,search:"Large exclusions",excludeIds:$exclude){items{id} revision{seq}}}',
        variables: { exclude: ids.slice(0, 101) },
      });
      assert.equal(response.status, 200);
      const payload = (await response.json()) as {
        data?: { paintOptions: { items: { id: string }[] } };
        errors?: unknown;
      };
      assert.equal(payload.errors, undefined);
      assert.deepEqual(payload.data?.paintOptions.items, [{ id: ids[101] }]);
    });
  } finally {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
