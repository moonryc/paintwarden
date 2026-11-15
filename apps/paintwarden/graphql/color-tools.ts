import { normalizeColorHex } from "@paintwarden/core/color-hex";
import { isPaintOwned } from "@paintwarden/core/paint-state";
import { GraphQLError } from "graphql";

import { getSqlite } from "../db/index.ts";

import { readPaintProjection, validatePage } from "./library.ts";
import { paginateSchemeItems } from "./miniature-schemes.ts";

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
    const nodes = snapshot.paints.slice(start, start + args.first).map(colorPaint);
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

// One flat membership projection per committed database generation. In particular,
// do not resolve scheme detail/entries per scheme or include images/dividers/recipes.
let cachedSchemes:
  | {
      revision: ReturnType<typeof readPaintProjection>["revision"];
      nodes: { id: string; schemeId: string; schemeName: string; paint: ReturnType<typeof colorPaint> }[];
    }
  | undefined;
function colorPaint(paint: ReturnType<typeof readPaintProjection>["paints"][number]) {
  return {
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
  };
}
export function readSchemeColorIndex(args: { first: number; after?: string | null }) {
  validatePage(args);
  const sqlite = getSqlite();
  const allowCache = !sqlite.inTransaction;
  return sqlite.transaction(() => {
    const paints = readPaintProjection(allowCache);
    let snapshot = allowCache ? cachedSchemes : undefined;
    if (
      !snapshot ||
      snapshot.revision.epoch !== paints.revision.epoch ||
      snapshot.revision.seq !== paints.revision.seq
    ) {
      const byId = new Map(
        paints.paints
          .filter((paint) => normalizeColorHex(paint.colorHex))
          .map((paint) => [paint.id, colorPaint(paint)]),
      );
      const rows = sqlite
        .prepare(
          `SELECT s.id AS schemeId,s.name AS schemeName,p.paint_id AS paintId,p.sort_order AS sortOrder
        FROM color_schemes s JOIN color_scheme_paints p ON p.scheme_id=s.id
        ORDER BY s.name,s.id,p.sort_order`,
        )
        .all() as { schemeId: string; schemeName: string; paintId: string; sortOrder: number }[];
      snapshot = {
        revision: paints.revision,
        nodes: rows.flatMap(({ schemeId, schemeName, paintId, sortOrder }) => {
          const paint = byId.get(paintId);
          return paint ? [{ id: `${schemeId}/${sortOrder}`, schemeId, schemeName, paint }] : [];
        }),
      };
      if (allowCache) cachedSchemes = snapshot;
    }
    return {
      revision: snapshot.revision,
      ...paginateSchemeItems(snapshot.nodes, args, snapshot.revision, "scheme-colors-v1"),
    };
  })();
}
