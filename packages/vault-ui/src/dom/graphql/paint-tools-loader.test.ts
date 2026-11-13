import assert from "node:assert/strict";
import test from "node:test";

import { ApolloClient, ApolloLink } from "@apollo/client";
import { Observable } from "rxjs";

import { createVaultCache } from "./cache";
import { readPaintConversion, readPaintRankingWindow } from "./paint-tools-loader";
import { paintConversionModel, resolveConversionChoices } from "./paint-tools-model";

const paint = (id: string, owned = false) => ({
  __typename: "Paint",
  id,
  name: id,
  brand: "Fixture",
  range: "Base",
  colorHex: "#cc0000",
  sourceUrl: null,
  isCustom: false,
  sourceName: null,
  sourceLogoUrl: null,
  inventory: owned ? { __typename: "Inventory", state: "OWNED", stockLevel: "FULL", quantity: 1 } : null,
  available: owned,
  hasActiveSubstitution: false,
  activeSubstitution: null,
  brokenReason: null,
  brokenSubstitution: false,
  missingStock: !owned,
});
const revision = (seq = "1") => ({ epoch: "tools", seq });
const ranking = (seq = "1", id = "candidate", next = false) => ({
  paintRanking: {
    revision: revision(seq),
    paint: paint("target"),
    owned: false,
    suggestedId: id,
    nodes: [
      {
        paint: paint(id, true),
        sameType: true,
        match: { score: 100, distance: 0, lightnessDelta: 0, hueDelta: 0, intensityDelta: 0 },
      },
    ],
    totalCount: 2,
    pageInfo: { hasNextPage: next, endCursor: next ? "next" : null },
  },
});
function client(reply: (name: string | undefined, variables: Record<string, unknown>) => unknown) {
  return new ApolloClient({
    cache: createVaultCache(),
    link: new ApolloLink(
      (operation) =>
        new Observable((observer) => {
          observer.next({
            data: reply(operation.operationName, operation.variables) as Record<string, unknown>,
          });
          observer.complete();
        }),
    ),
  });
}
void test("rank windows rebuild every loaded page after a mixed revision without exposing partial cache", async () => {
  let calls = 0;
  const scope = client(() => {
    calls++;
    return ranking(calls === 1 ? "1" : "2", String(calls), calls % 2 === 1);
  });
  try {
    const result = await readPaintRankingWindow(scope, "target", false, 2);
    assert.equal(calls, 4);
    assert.deepEqual(
      result.nodes.map((row) => row.paint.id),
      ["3", "4"],
    );
    assert.equal(result.revision.seq, "2");
    assert.deepEqual(scope.cache.extract(), {});
  } finally {
    scope.stop();
  }
});
void test("repeated revision drift terminates instead of publishing a mixed ranking", async () => {
  let calls = 0;
  const scope = client(() => ranking(String(++calls), String(calls), calls % 2 === 1));
  try {
    await assert.rejects(readPaintRankingWindow(scope, "target", false, 2), /changed while refreshing/);
    assert.equal(calls, 6);
    assert.deepEqual(scope.cache.extract(), {});
  } finally {
    scope.stop();
  }
});
void test("manual choices are scoped ID reads and unowned/deleted choices cannot be saved", async () => {
  const calls: string[] = [];
  let physicallyOwned = true;
  const scope = client((name, variables) => {
    calls.push(name ?? "");
    return name === "PaintToolRanking"
      ? ranking()
      : {
          paint: {
            revision: revision(),
            paint: variables.id === "removed" ? null : paint(String(variables.id), physicallyOwned),
          },
        };
  });
  try {
    const first = await readPaintConversion(scope, ["target", "target"], ["manual", "manual", "removed"]);
    assert.deepEqual(calls, ["PaintToolRanking", "PaintToolChoice", "PaintToolChoice"]);
    assert.equal(
      resolveConversionChoices(paintConversionModel(first), { target: "manual" }).target,
      "manual",
    );
    assert.equal(
      resolveConversionChoices(paintConversionModel(first), { target: "removed" }).target,
      "candidate",
    );
    physicallyOwned = false;
    const next = await readPaintConversion(scope, ["target"], ["manual"]);
    assert.equal(
      resolveConversionChoices(paintConversionModel(next), { target: "manual" }).target,
      "candidate",
    );
    assert.deepEqual(scope.cache.extract(), {});
  } finally {
    scope.stop();
  }
});
void test("conversion restarts all originals when a selected choice has a newer revision", async () => {
  let calls = 0;
  const scope = client((name) => {
    calls++;
    const seq = calls === 1 ? "1" : "2";
    return name === "PaintToolRanking"
      ? ranking(seq)
      : { paint: { revision: revision(seq), paint: paint("manual", true) } };
  });
  try {
    const result = await readPaintConversion(scope, ["target"], ["manual"]);
    assert.equal(calls, 4);
    assert.equal(result.revision.seq, "2");
    assert.ok(result.rows.every((row) => row.revision.seq === "2"));
    assert.ok(result.choices.every((row) => row.revision.seq === "2"));
    assert.deepEqual(scope.cache.extract(), {});
  } finally {
    scope.stop();
  }
});
