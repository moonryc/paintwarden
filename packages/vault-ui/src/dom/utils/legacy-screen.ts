import type { Tab } from "../types";

// Retained as a Phase 4 regression guard. No screen or overlay may activate State.
export function needsLegacySnapshot(_tab: Tab, _overlays: { plugins: boolean; schemeForm: boolean }) {
  return false;
}
