import { createFuzzyIndex, searchFuzzyIndex } from "@paint-vault/core/fuzzy-search";
import { rankPaintsByColor } from "@paint-vault/core/paint-color-similarity";
import { isPaintOwned } from "@paint-vault/core/paint-state";
import { paintType, rankOwnedPaintMatches, suggestedOwnedPaint } from "@paint-vault/core/recipe-converter";
import { GraphQLError } from "graphql";

import { getSqlite } from "../db/index.ts";

import { readPaintProjection, validatePage, validateText, type PaintRead } from "./library.ts";

const owned = (paint: PaintRead) =>
  isPaintOwned(
    paint.inventory?.state ?? null,
    paint.inventory?.stockLevel ?? null,
    paint.inventory?.quantity ?? 0,
  );
function invalidCursor(): never {
  throw new GraphQLError("Invalid paint ranking cursor", { extensions: { code: "BAD_USER_INPUT" } });
}

// Ranking stays server-side. Even a large catalog/owned collection returns only
// one bounded page, with the same scoring and physical-stock rules as core.
export function readPaintRanking(args: {
  id: string;
  first: number;
  after?: string | null;
  ownedOnly?: boolean;
}) {
  validateText(args.id, "id");
  validatePage(args);
  const allowCache = !getSqlite().inTransaction;
  return getSqlite().transaction(() => {
    const snapshot = readPaintProjection(allowCache);
    const paint = snapshot.byId.get(args.id) ?? null;
    const ownedOnly = Boolean(args.ownedOnly);
    const nodes = !paint
      ? []
      : ownedOnly
        ? rankOwnedPaintMatches(paint, snapshot.paints.filter(owned))
        : (rankPaintsByColor(paint, snapshot.paints) ?? []).map((entry) => ({
            ...entry,
            sameType: paintType(entry.paint.range) === paintType(paint.range),
          }));
    let start = 0;
    if (args.after != null) {
      try {
        if (!args.after || !/^[\w-]+$/.test(args.after)) invalidCursor();
        const cursor: unknown = JSON.parse(Buffer.from(args.after, "base64url").toString("utf8"));
        if (
          !Array.isArray(cursor) ||
          cursor.length !== 6 ||
          cursor[0] !== "paint-ranking-v1" ||
          cursor[1] !== args.id ||
          cursor[2] !== ownedOnly ||
          typeof cursor[3] !== "string" ||
          !Number.isSafeInteger(cursor[4]) ||
          !Number.isSafeInteger(cursor[5]) ||
          cursor[5] < 0
        )
          invalidCursor();
        if (cursor[3] !== snapshot.revision.epoch || cursor[4] !== snapshot.revision.seq)
          throw new GraphQLError("Paint ranking changed; restart pagination", {
            extensions: { code: "STALE_CURSOR" },
          });
        start = cursor[5] as number;
        if (start > nodes.length) invalidCursor();
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        invalidCursor();
      }
    }
    const page = nodes.slice(start, start + args.first);
    const end = start + page.length;
    return {
      revision: snapshot.revision,
      paint,
      owned: paint ? owned(paint) : false,
      suggestedId: ownedOnly ? (suggestedOwnedPaint(nodes)?.paint.id ?? null) : null,
      nodes: page,
      totalCount: nodes.length,
      pageInfo: {
        hasNextPage: end < nodes.length,
        endCursor: page.length
          ? Buffer.from(
              JSON.stringify([
                "paint-ranking-v1",
                args.id,
                ownedOnly,
                snapshot.revision.epoch,
                snapshot.revision.seq,
                end,
              ]),
            ).toString("base64url")
          : null,
      },
    };
  })();
}

export function readOwnedPaintOptions(args: { search: string; first: number }) {
  validateText(args.search, "search");
  validatePage(args, 30);
  const allowCache = !getSqlite().inTransaction;
  return getSqlite().transaction(() => {
    const snapshot = readPaintProjection(allowCache);
    // Filter before fuzzy ranking: an unowned literal match must not suppress
    // an owned typo match. Effective availability via a mix is not ownership.
    const index = createFuzzyIndex(
      snapshot.paints.filter(owned),
      (paint) => `${paint.name} ${paint.brand} ${paint.range}`,
    );
    return {
      revision: snapshot.revision,
      items: searchFuzzyIndex(index, args.search.trim(), args.first),
    };
  })();
}
