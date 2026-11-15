// GitHub's provider can return HTML, plain Markdown, or a full-changelog array.
// Transport only bounded plain text over IPC. The renderer also uses text nodes, never HTML.
function plainReleaseNotes(notes) {
  if (Array.isArray(notes))
    return notes
      .slice(0, 20)
      .map((entry) => plainReleaseNotes(entry?.note))
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 16000);
  if (typeof notes !== "string") return "";
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return notes
    .slice(0, 64000)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(?:p|div|li|h[1-6])\s*>|<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
      if (entity[0] !== "#") return entities[entity.toLowerCase()] ?? match;
      const point = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point)
        : "";
    })
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 16000);
}
module.exports = { plainReleaseNotes };
