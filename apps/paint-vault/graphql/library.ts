import { GraphQLError } from "graphql";

import { changeLogEpoch, currentChangeSeq, pruneChangeLog } from "../db/change-log.ts";
import { getSqlite } from "../db/index.ts";

type Row = {
  id: string;
  brand: string;
  range: string;
  name: string;
  discontinued: number;
  colorHex: string | null;
  type: string | null;
  state: string | null;
  stockLevel: string | null;
  quantity: number | null;
};

export function readLibrary({ first, after }: { first: number; after?: string | null }) {
  if (!Number.isInteger(first) || first < 1 || first > 100)
    throw new GraphQLError("first must be between 1 and 100", { extensions: { code: "BAD_USER_INPUT" } });
  let values: string[] | undefined;
  let cursorEpoch: string | undefined;
  let cursorSeq: number | undefined;
  if (after != null) {
    try {
      if (!after || after.length > 8192 || !/^[\w-]+$/.test(after)) throw new Error();
      const parsed: unknown = JSON.parse(Buffer.from(after, "base64url").toString("utf8"));
      if (
        !Array.isArray(parsed) ||
        parsed.length !== 7 ||
        parsed[0] !== "library-v1" ||
        typeof parsed[1] !== "string" ||
        !Number.isSafeInteger(parsed[2]) ||
        parsed[2] < 0 ||
        parsed.slice(3).some((part) => typeof part !== "string" || part.length > 1024)
      )
        throw new Error();
      cursorEpoch = parsed[1];
      cursorSeq = parsed[2] as number;
      values = parsed.slice(3) as string[];
    } catch {
      throw new GraphQLError("Invalid Library cursor", { extensions: { code: "BAD_USER_INPUT" } });
    }
  }
  const sqlite = getSqlite();
  return sqlite.transaction(() => {
    pruneChangeLog(sqlite);
    const seq = currentChangeSeq(sqlite);
    // Do not splice pages from different collection generations after sort/membership edits.
    if (values && (cursorEpoch !== changeLogEpoch || cursorSeq !== seq))
      throw new GraphQLError("Library changed; restart pagination", { extensions: { code: "STALE_CURSOR" } });
    const rows = sqlite
      .prepare(
        `SELECT p.id, p.brand, p.range, p.name, p.color_hex AS colorHex,
      p.type, p.discontinued, i.state, i.stock_level AS stockLevel, i.quantity
      FROM paint_catalog p LEFT JOIN paint_inventory i ON i.paint_id = p.id
      ${values ? "WHERE (p.brand, p.range, p.name, p.id) > (?, ?, ?, ?)" : ""}
      ORDER BY p.brand, p.range, p.name, p.id LIMIT ?`,
      )
      .all(...(values ?? []), first + 1) as Row[];
    const page = rows.slice(0, first);
    const last = page.at(-1);
    return {
      nodes: page.map((row) => ({
        id: row.id,
        brand: row.brand,
        range: row.range,
        name: row.name,
        colorHex: row.colorHex,
        type: row.type,
        discontinued: Boolean(row.discontinued),
        inventory: row.state
          ? { state: row.state, stockLevel: row.stockLevel!, quantity: row.quantity! }
          : null,
      })),
      pageInfo: {
        hasNextPage: rows.length > first,
        endCursor: last
          ? Buffer.from(
              JSON.stringify(["library-v1", changeLogEpoch, seq, last.brand, last.range, last.name, last.id]),
            ).toString("base64url")
          : null,
      },
      revision: { epoch: changeLogEpoch, seq },
    };
  })();
}
