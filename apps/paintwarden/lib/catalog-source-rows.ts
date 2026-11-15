import type Sqlite from "better-sqlite3";

export type CatalogSqlValue = string | number | null;
export type CatalogSqlRow = CatalogSqlValue[];
export type CatalogWrite = { statement: Sqlite.Statement; values: CatalogSqlRow };

// Materialize bindings and compile bounded, multi-row writes before opening the transaction.
// At most two statement shapes are needed per table, regardless of catalog size.
export function prepareCatalogRows(
  sqlite: Sqlite.Database,
  table: string,
  columns: string[],
  rows: CatalogSqlRow[],
  conflict = "",
  conflictValues: CatalogSqlRow = [],
): CatalogWrite[] {
  const writes: CatalogWrite[] = [];
  const statements = new Map<number, Sqlite.Statement>();
  const rowSql = `(${columns.map(() => "?").join(",")})`;
  const batchSize = 250;
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    let statement = statements.get(batch.length);
    if (!statement) {
      statement = sqlite.prepare(
        `INSERT INTO ${table} (${columns.join(",")}) VALUES ${batch.map(() => rowSql).join(",")} ${conflict}`,
      );
      statements.set(batch.length, statement);
    }
    writes.push({ statement, values: [...batch.flat(), ...conflictValues] });
  }
  return writes;
}

export function executeCatalogRows(writes: readonly CatalogWrite[]) {
  for (const { statement, values } of writes) statement.run(...values);
}

export function prepareConflictChecks(
  sqlite: Sqlite.Database,
  sourceId: string,
  kind: "paint" | "scheme" | "template",
  columns: string[],
  rows: CatalogSqlRow[],
) {
  const table = { paint: "paint_catalog", scheme: "color_schemes", template: "miniature_templates" }[kind];
  const checks: { write: CatalogWrite; message: string }[] = [];
  const statements = new Map<number, Sqlite.Statement>();
  for (let index = 0; index < rows.length; index += 250) {
    const batch = rows.slice(index, index + 250);
    let statement = statements.get(batch.length);
    if (!statement) {
      const placeholders = "(" + columns.map(() => "?").join(",") + ")";
      const valuesSql = batch.map(() => placeholders).join(",");
      const difference = columns
        .slice(1)
        .map((column) => `actual.${column} IS NOT incoming.${column}`)
        .join(" OR ");
      const where = difference ? "WHERE " + difference : "";
      statement = sqlite.prepare(`WITH incoming (${columns.join(",")}) AS (VALUES ${valuesSql})
        SELECT actual.id FROM incoming JOIN ${table} actual ON actual.id = incoming.id
        JOIN catalog_source_items owner ON owner.item_id = actual.id AND owner.kind = '${kind}' AND owner.source_id != ?
        ${where} LIMIT 1`);
      statements.set(batch.length, statement);
    }
    checks.push({
      write: { statement, values: [...batch.flat(), sourceId] },
      message: `${kind[0].toUpperCase()}${kind.slice(1)} ID conflicts with another source`,
    });
  }
  return checks;
}
