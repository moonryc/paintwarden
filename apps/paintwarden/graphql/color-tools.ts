import { isPaintOwned } from "@paintwarden/core/paint-state";
import { GraphQLError } from "graphql";

import { getSqlite } from "../db/index.ts";

import { readPaintProjection, validatePage } from "./library.ts";

// Compact, revision-bound pages: no recipes, full inventory or catalog metadata.
export function readColorIndex(args: { first: number; after?: string | null }) {
  validatePage(args);
  const sqlite = getSqlite();
  const allowCache = !sqlite.inTransaction;
  return sqlite.transaction(() => {
    const snapshot = readPaintProjection(allowCache);
    let start = 0;
    if (args.after != null) {
      let cursor: unknown;
      try {
        cursor = JSON.parse(Buffer.from(args.after, "base64url").toString("utf8"));
      } catch {
        cursor = null;
      }
      if (
        !Array.isArray(cursor) ||
        cursor.length !== 4 ||
        cursor[0] !== "colors-v1" ||
        typeof cursor[1] !== "string" ||
        !Number.isSafeInteger(cursor[2]) ||
        !Number.isSafeInteger(cursor[3]) ||
        cursor[3] < 0
      )
        throw new GraphQLError("Invalid color index cursor", { extensions: { code: "BAD_USER_INPUT" } });
      if (cursor[1] !== snapshot.revision.epoch || cursor[2] !== snapshot.revision.seq)
        throw new GraphQLError("Color index changed; restart pagination", {
          extensions: { code: "STALE_CURSOR" },
        });
      if (cursor[3] > snapshot.paints.length)
        throw new GraphQLError("Invalid color index cursor", { extensions: { code: "BAD_USER_INPUT" } });
      start = cursor[3] as number;
    }
    const nodes = snapshot.paints.slice(start, start + args.first).map((paint) => ({
      id: paint.id,
      name: paint.name,
      brand: paint.brand,
      hex: paint.colorHex,
      owned: isPaintOwned(
        paint.inventory?.state ?? null,
        paint.inventory?.stockLevel ?? null,
        paint.inventory?.quantity ?? 0,
      ),
      available: paint.available,
    }));
    const end = start + nodes.length;
    return {
      revision: snapshot.revision,
      nodes,
      pageInfo: {
        hasNextPage: end < snapshot.paints.length,
        endCursor: nodes.length
          ? Buffer.from(
              JSON.stringify(["colors-v1", snapshot.revision.epoch, snapshot.revision.seq, end]),
            ).toString("base64url")
          : null,
      },
    };
  })();
}
