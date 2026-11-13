import type { Tab } from "../types";

// Only these screens still consume the legacy snapshot during the migration.
// Drawers, miniature forms, paint forms and paint detail use scoped reads.
export function needsLegacySnapshot(tab: Tab, overlays: { plugins: boolean; schemeForm: boolean }) {
  return (
    ["wishlist", "schemes", "templates", "settings", "paint-tools"].includes(tab) ||
    overlays.plugins ||
    overlays.schemeForm
  );
}
