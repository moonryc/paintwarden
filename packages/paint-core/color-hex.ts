// Paint colors are stored as `#rrggbb`. People may type `#abc`, `abc` or upper case, so input is
// normalized to the stored form. Returns null for an empty value and undefined for an invalid one.
export function normalizeColorHex(value: unknown): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return null;
  const match = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(text);
  if (!match) return undefined;
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];
  return `#${digits.toLowerCase()}`;
}
