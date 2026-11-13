import type { SchemeOrderEntry } from "../types";

export function convertedSchemeEntries(
  entries: SchemeOrderEntry[],
  choices: Record<string, string>,
  createId: () => string,
) {
  return entries.map((entry) => {
    if (entry.type === "PAINT")
      return { type: "PAINT" as const, paintId: choices[entry.paintId] ?? entry.paintId };
    if (entry.type === "DIVIDER")
      return {
        type: "DIVIDER" as const,
        id: createId(),
        label: entry.label,
        tone: entry.tone,
        role: entry.role ?? null,
      };
    return {
      type: "IMAGE" as const,
      id: createId(),
      imageUrl: entry.imageUrl,
      thumbnailUrl: entry.thumbnailUrl,
      imageType: entry.imageType,
      method: entry.method,
    };
  });
}
