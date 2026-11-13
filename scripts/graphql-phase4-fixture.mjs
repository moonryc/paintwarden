import assert from "node:assert/strict";
import { seedHomeMiniaturesFixture } from "./home-miniatures-fixture.mjs";

// Host creates a NEW isolated vault/owner. No existing filesystem path accepted.
// Preserve the Phase3 readiness/virtualization probes; add editable Phase4 records
// through production commands, never /api/state or direct database edits.
export async function seedPhase4Fixture(page, { profile = "realistic" } = {}) {
  assert.ok(["realistic", "stress"].includes(profile));
  const prior = await seedHomeMiniaturesFixture(page, {
    miniatures: profile === "stress" ? 1000 : 360,
  });
  const phase4 = await page.evaluate(
    async ({ paintId }) => {
      const api = async (route, body, method = "POST") => {
        const response = await fetch(`/api/${route}`, {
          method,
          headers: { "content-type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const payload = await response.json();
        if (!response.ok || payload.errors)
          throw new Error(`${route}: ${response.status} ${JSON.stringify(payload)}`);
        return payload;
      };
      const prefix = "Phase4Probe";
      const missingPaintName = `${prefix} wishlist blue`;
      await api("catalog", {
        paints: [{ brand: prefix, range: "Synthetic", name: missingPaintName, colorHex: "#2345ab" }],
      });
      const catalog = await api(`catalog?q=${prefix}&pageSize=100`, undefined, "GET");
      const missingPaintId = catalog.items.find((paint) => paint.name === missingPaintName)?.id;
      if (!missingPaintId) throw new Error("Phase4 wishlist paint missing");
      await api("paint-state", { paintId: missingPaintId, state: "WISHLIST", quantity: 0 }, "PUT");
      const miniatureTitle = `${prefix} wishlist project`;
      const miniature = await api("miniatures", {
        title: miniatureTitle,
        status: "OWNED",
        paintingStatus: "NOT_STARTED",
        notes: "Isolated Phase4 Wishlist association probe",
      });
      await api("requirements", {
        miniatureId: miniature.id,
        paintId: missingPaintId,
        step: "BASECOAT",
        notes: "Independent stock/SSE probe",
      });
      const editableSchemeName = `${prefix} editable scheme`;
      const scheme = await api("color-schemes", {
        name: editableSchemeName,
        category: "BLUE",
        entries: [
          { type: "DIVIDER", label: "BASECOAT", tone: "SECTION", role: null },
          { type: "PAINT", paintId },
        ],
      });
      const templateName = `${prefix} editable template`;
      const template = await api("miniature-templates", {
        name: templateName,
        manufacturer: `${prefix} maker`,
        faction: "Synthetic faction",
        schemeIds: [scheme.id],
        paints: [{ paintId, step: "BASECOAT", notes: "Phase4 template paint", sortOrder: 0 }],
      });
      return {
        prefix,
        missingPaintId,
        missingPaintName,
        wishlistMiniatureId: miniature.id,
        wishlistMiniatureTitle: miniatureTitle,
        editableSchemeId: scheme.id,
        editableSchemeName,
        templateId: template.id,
        templateName,
      };
    },
    { paintId: prior.paintId },
  );
  return { ...prior, ...phase4, prefix: prior.prefix, profile, phase4 };
}
