import { TEXT_LIMITS, type TextLimit } from "@paint-vault/core/text-limits";

// Returns a 400 response naming the first field that is too long, or null when every field fits.
// Each check is [the field's name as the user sees it, its value, its limit].
export function textTooLong(checks: [label: string, value: unknown, limit: TextLimit][]) {
  for (const [label, value, limit] of checks)
    if (typeof value === "string" && value.length > TEXT_LIMITS[limit])
      return Response.json(
        { error: `${label} must be ${TEXT_LIMITS[limit].toLocaleString("en-US")} characters or fewer` },
        { status: 400 },
      );
  return null;
}

// The miniature fields people type, checked against their length limits.
export function miniatureTextTooLong(body: {
  title?: string;
  notes?: string;
  manufacturer?: string;
  faction?: string;
  scale?: string;
}) {
  return textTooLong([
    ["Name", body.title?.trim(), "name"],
    ["Notes", body.notes?.trim(), "miniatureNotes"],
    ["Manufacturer", body.manufacturer?.trim(), "detail"],
    ["Faction", body.faction?.trim(), "detail"],
    ["Scale", body.scale?.trim(), "detail"],
  ]);
}
