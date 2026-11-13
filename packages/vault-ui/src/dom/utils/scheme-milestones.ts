import type { DividerRole } from "../types";

// The fixed labels of the milestones every owner scheme starts and ends with. The divider's role,
// not its ID, says which milestone it is; IDs are always random UUIDs.
export const REQUIRED_MILESTONE_LABELS: Record<DividerRole, string> = {
  START: "GET READY!",
  COMPLETE: "YOU'RE READY!",
};
