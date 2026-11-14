import assert from "node:assert/strict";

// The host MUST create the isolated vault and owner before calling this helper.
// Uses production commands (including an ordinary FK cascade to make an empty
// substitution), so this works through HTTP, paintwarden:// proxy, and Docker.
// No caller-supplied filesystem paths or direct SQLite mutations are accepted.
export async function seedHomeMiniaturesFixture(page, { miniatures = 360 } = {}) {
  assert.ok(Number.isInteger(miniatures) && miniatures >= 360 && miniatures <= 2000);
  return page.evaluate(
    async ({ miniatures }) => {
      const api = async (pathname, body, method = "POST") => {
        const response = await fetch(`/api/${pathname}`, {
          method,
          headers: { "content-type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const data = await response.json();
        if (!response.ok || data.errors)
          throw new Error(`${pathname}: ${response.status} ${JSON.stringify(data)}`);
        return data;
      };
      const prefix = "Phase3Probe";
      const names = ["Stock readiness", "Broken original", "Temporary ingredient"].map(
        (name) => `${prefix} ${name}`,
      );
      await api("catalog", {
        paints: names.map((name) => ({ brand: prefix, range: "Synthetic", name, colorHex: "#2244aa" })),
      });
      const catalog = await api(`catalog?q=${prefix}&pageSize=100`, undefined, "GET");
      const ids = names.map((name) => catalog.items.find((paint) => paint.name === name)?.id);
      if (ids.some((id) => !id)) throw new Error("Synthetic paint IDs missing");
      const [paintId, brokenPaintId, ingredientId] = ids;
      await api("paint-state", { paintIds: ids, state: "OWNED", quantity: 2 }, "PUT");
      const { id: schemeId } = await api("color-schemes", {
        name: `${prefix} attach scheme`,
        category: "BLUE",
        entries: [
          { type: "DIVIDER", label: "BASECOAT", tone: "SECTION", role: null },
          { type: "PAINT", paintId },
        ],
      });
      const miniatureIds = [];
      const title = (i) => `${prefix} miniature ${String(i).padStart(5, "0")}`;
      for (let i = 0; i < miniatures; i++) {
        const mini = await api("miniatures", {
          title: title(i),
          status: i !== 0 && i !== miniatures - 1 && i % 5 === 0 ? "WISHLIST" : "OWNED",
          paintingStatus:
            i === miniatures - 1
              ? "NOT_STARTED"
              : ["NOT_STARTED", "ASSEMBLED", "PRIMED", "IN_PROGRESS", "COMPLETE"][i % 5],
          manufacturer: `${prefix} maker`,
          faction: "Synthetic faction",
          scale: "28mm",
          notes: `Synthetic smoke project ${i}; never personal vault data.`,
        });
        miniatureIds.push(mini.id);
      }
      const miniatureId = miniatureIds.at(-1);
      const brokenMiniatureId = miniatureIds.at(-2);
      for (const [id, paint] of [
        [miniatureId, paintId],
        [brokenMiniatureId, brokenPaintId],
      ]) {
        await api("requirements", {
          miniatureId: id,
          paintId: paint,
          step: "BASECOAT",
          notes: "Smoke basecoat",
        });
      }
      const { id: substitutionId } = await api("paint-substitutions", {
        targetPaintId: brokenPaintId,
        name: `${prefix} empty after ingredient deletion`,
        ingredients: [{ paintId: ingredientId, parts: 1 }],
      });
      await api("paint-substitutions", { id: substitutionId, action: "default", enabled: true }, "PUT");
      // Deleting the custom ingredient cascades its ingredient row, NOT the target
      // substitution. The physically owned target must stay broken/unavailable.
      await api(`catalog/${encodeURIComponent(ingredientId)}`, undefined, "DELETE");
      // Commands can share a millisecond: do not guess the final item from
      // insertion order. Follow the production cursor/title/ID tie-breaks.
      let after = null,
        finalMiniature;
      do {
        const payload = await api("graphql", {
          query:
            "query FixtureFinal($after:String,$search:String){miniatures(first:100,after:$after,search:$search){miniatures{nodes{id title} totalCount pageInfo{hasNextPage endCursor}}}}",
          variables: { after, search: prefix },
        });
        const connection = payload.data.miniatures.miniatures;
        if (connection.totalCount !== miniatures) throw new Error("Unexpected focused fixture count");
        finalMiniature = connection.nodes.at(-1);
        after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
      } while (after);
      return {
        prefix,
        miniatures,
        miniatureIds,
        miniatureId,
        miniatureTitle: title(miniatures - 1),
        brokenMiniatureId,
        brokenMiniatureTitle: title(miniatures - 2),
        paintId,
        paintName: names[0],
        brokenPaintId,
        brokenPaintName: names[1],
        substitutionId,
        schemeId,
        schemeName: `${prefix} attach scheme`,
        finalTitle: finalMiniature.title,
        finalMiniatureId: finalMiniature.id,
      };
    },
    { miniatures },
  );
}
