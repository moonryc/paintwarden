import { TEXT_LIMITS, type TextLimit } from "@paintwarden/core/text-limits";
import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

// Column helpers and CHECK constraints shared by the tables in schema.ts.

// Every vault row records when it last changed, in milliseconds. Rows written through Drizzle
// get the time from $onUpdateFn; the SQL default covers inserts that omit the column.
export const updatedAt = () =>
  integer("updated_at")
    .notNull()
    .default(sql`(cast(unixepoch('subsec') * 1000 as integer))`)
    .$onUpdateFn(() => Date.now());

// SQLite doesn't enforce TEXT enums, so each one is also a CHECK constraint.
export const oneOf = (name: string, column: AnySQLiteColumn, values: readonly string[], nullable = false) =>
  check(
    name,
    sql`${column} IN (${sql.raw(values.map((value) => `'${value}'`).join(", "))})${
      nullable ? sql` OR ${column} IS NULL` : sql``
    }`,
  );

// SQLite stores booleans as integers, so each boolean column is limited to 0 and 1.
export const isBoolean = (name: string, column: AnySQLiteColumn) => check(name, sql`${column} IN (0, 1)`);

// Paint colors are stored as #rrggbb, in either case.
export const isColorHex = (name: string, column: AnySQLiteColumn) =>
  check(name, sql`${column} IS NULL OR ${column} GLOB ${sql.raw(`'#${"[0-9A-Fa-f]".repeat(6)}'`)}`);

// SQLite checks column types only on STRICT tables, which drizzle-kit can't create, so an INTEGER
// column would accept text such as 'lots' (and text sorts above every number, passing checks like
// `quantity >= 0`). Every table built with `vaultTable` gets one CHECK that its integer columns
// hold integers. Boolean columns have their own 0/1 checks.
function integersCheck(name: string, columns: Record<string, unknown>) {
  const integers = Object.values(columns).filter(
    (column): column is AnySQLiteColumn => (column as AnySQLiteColumn).columnType === "SQLiteInteger",
  );
  return integers.length
    ? [
        check(
          `${name}_integers_check`,
          sql.join(
            integers.map((column) => sql`typeof(${column}) = 'integer'`),
            sql` AND `,
          ),
        ),
      ]
    : [];
}

// Called exactly like sqliteTable; the cast keeps sqliteTable's inferred column types.
export const vaultTable = ((name: string, columns: never, extra?: (table: never) => unknown[]) =>
  sqliteTable(name, columns, (table) => [
    ...((extra?.(table) ?? []) as []),
    ...integersCheck(name, table as Record<string, unknown>),
  ])) as unknown as typeof sqliteTable;

// Every record ID is a lowercase UUID (see @paintwarden/core/vault-ids). Owner items may carry the
// `user:` prefix. Columns that refer to these IDs are covered by their foreign keys.
const UUID_GLOB = ["8", "4", "4", "4", "12"].map((length) => "[0-9a-f]".repeat(Number(length))).join("-");
export const isUuid = (name: string, column: AnySQLiteColumn) =>
  check(name, sql`${column} GLOB ${sql.raw(`'${UUID_GLOB}'`)}`);
export const isItemId = (name: string, column: AnySQLiteColumn) =>
  check(
    name,
    sql`${column} GLOB ${sql.raw(`'${UUID_GLOB}'`)} OR ${column} GLOB ${sql.raw(`'user:${UUID_GLOB}'`)}`,
  );

// Image files are named by a UUID and an image extension (see lib/image-store.ts).
export const IMAGE_EXTENSIONS = ["avif", "gif", "jpg", "jpeg", "png", "webp", "img"] as const;
export const isImageKey = (name: string, column: AnySQLiteColumn) =>
  check(
    name,
    sql`${column} IS NULL OR (substr(${column}, 1, 36) GLOB ${sql.raw(`'${UUID_GLOB}'`)} AND substr(${column}, 37) IN (${sql.raw(
      IMAGE_EXTENSIONS.map((extension) => `'.${extension}'`).join(", "),
    )}))`,
  );

// One CHECK per table holding each text column to its limit in @paintwarden/core/text-limits.
export const maxLengths = (name: string, columns: [AnySQLiteColumn, TextLimit][]) =>
  check(
    name,
    sql.join(
      columns.map(([column, limit]) => sql`length(${column}) <= ${sql.raw(String(TEXT_LIMITS[limit]))}`),
      sql` AND `,
    ),
  );

// JSON list columns must hold a JSON array.
export const isJsonArray = (name: string, column: AnySQLiteColumn) =>
  check(name, sql`json_valid(${column}) AND json_type(${column}) = 'array'`);
