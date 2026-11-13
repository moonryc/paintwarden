export function parseCatalogImport(text: string): Record<string, string>[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    const rows: unknown = JSON.parse(trimmed);
    if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row)))
      throw new Error("Expected a JSON array of paints");
    return rows as Record<string, string>[];
  }
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  for (let index = 0; index < trimmed.length; index++) {
    const char = trimmed[index];
    if (char === '"') {
      if (quoted && trimmed[index + 1] === '"') {
        value += '"';
        index++;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && trimmed[index + 1] === "\n") index++;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  if (quoted) throw new Error("Unclosed quoted CSV field");
  row.push(value);
  if (row.some(Boolean)) rows.push(row);
  const [headers, ...records] = rows;
  if (!headers?.length) return [];
  return records
    .filter((record) => record.some(Boolean))
    .map((record) =>
      Object.fromEntries(headers.map((header, index) => [header.trim(), record[index]?.trim() ?? ""])),
    );
}
