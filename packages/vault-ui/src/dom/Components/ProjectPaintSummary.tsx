import { Box, Button } from "@mui/material";
import { useState } from "react";

import { Heart } from "../icons";
import { SubstitutionDialog } from "../Modals/SubstitutionDialog";
import { useVault, useVaultStore } from "../store/hooks";
import type { Paint, PaintStatus } from "../types";
import { projectPaintIssues } from "../utils/vault-data";

import { PaintChecklistItem } from "./PaintChecklistItem";
import { PaintRowActions } from "./PaintRowActions";
import { ProgressSummaryCard } from "./ProgressSummaryCard";
import { StatusChip } from "./StatusChip";

export type ProjectPaintSummaryProps = {
  miniatureId?: string;
  required: Paint[];
  missing: Paint[];
  onOpenPaint: (id: string) => void;
  onAddAllToWishlist: (paints: Paint[]) => void;
};

export type ProjectPaintSummaryViewProps = ProjectPaintSummaryProps & {
  issues?: ReadonlyMap<string, ReadonlySet<"missingStock" | "brokenSubstitution">> | null;
  paintStates: Record<string, PaintStatus>;
  onSetPaintState: (id: string, state: PaintStatus | null) => void;
};

// Legacy snapshot adapter; migrated callers provide their projection to the view.
export function ProjectPaintSummary(props: ProjectPaintSummaryProps) {
  const data = useVault();
  const setPaintState = useVaultStore((s) => s.setPaintState);
  return (
    <ProjectPaintSummaryView
      {...props}
      issues={props.miniatureId ? projectPaintIssues(data, props.miniatureId) : null}
      paintStates={data.paintStates}
      onSetPaintState={setPaintState}
    />
  );
}

// Keep the paint shortfall visible while the detailed list is collapsed.
export function ProjectPaintSummaryView({
  required,
  missing,
  onOpenPaint,
  onAddAllToWishlist,
  issues,
  paintStates,
  onSetPaintState,
}: ProjectPaintSummaryViewProps) {
  const [fixPaint, setFixPaint] = useState<Paint | null>(null);
  const broken = missing.some((paint) => issues?.get(paint.id)?.has("brokenSubstitution"));
  const needsStock = (paint: Paint) => (issues ? Boolean(issues.get(paint.id)?.has("missingStock")) : true);
  const total = required.length;
  if (!total) return null;
  const have = total - missing.length;
  const ready = missing.length === 0;
  const notWishlisted = missing.filter((paint) => needsStock(paint) && paintStates[paint.id] !== "WISHLIST");
  return (
    <>
      <ProgressSummaryCard
        title={
          ready
            ? "Palette ready — go paint!"
            : `${missing.length} paint${missing.length === 1 ? "" : "s"} ${broken ? (missing.length === 1 ? "needs attention" : "need attention") : "to gather"}`
        }
        subtitle={`${have} of ${total} ${broken ? "ready to use" : "on hand"}`}
        progress={(have / total) * 100}
        progressLabel={`${have} of ${total} paints ${broken ? "ready to use" : "on hand"}`}
        hint={
          broken
            ? "Fix broken substitutions; buying the original paint won’t repair them."
            : "Select a paint to view details or update your wishlist."
        }
        action={
          <Button
            size="small"
            variant="contained"
            startIcon={<Heart size={14} />}
            disabled={notWishlisted.length === 0}
            onClick={() => onAddAllToWishlist(notWishlisted)}
          >
            Wishlist all
          </Button>
        }
        complete={ready}
      >
        {missing.map((paint) => {
          const isBroken = issues?.get(paint.id)?.has("brokenSubstitution");
          const wished = paintStates[paint.id] === "WISHLIST";
          return (
            <PaintChecklistItem
              key={paint.id}
              paint={paint}
              subtitle={wished ? "On your wishlist" : paint.range}
              wishlisted={wished}
              selectAction="open details"
              onSelect={() => onOpenPaint(paint.id)}
              actions={
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  {isBroken && <StatusChip tone="rust">Broken substitution</StatusChip>}
                  {isBroken && (
                    <Button
                      size="small"
                      aria-label={`Fix substitution for ${paint.name}`}
                      onClick={() => setFixPaint(paint)}
                    >
                      Fix substitution
                    </Button>
                  )}
                  {needsStock(paint) && (
                    <PaintRowActions
                      wishlist={{
                        active: wished,
                        label: wished
                          ? `Remove ${paint.name} from wishlist`
                          : `Add ${paint.name} to wishlist`,
                        title: wished ? "Remove from wishlist" : "Add to wishlist",
                        onClick: () => onSetPaintState(paint.id, wished ? null : "WISHLIST"),
                      }}
                    />
                  )}
                </Box>
              }
            />
          );
        })}
      </ProgressSummaryCard>
      {fixPaint && <SubstitutionDialog paint={fixPaint} onClose={() => setFixPaint(null)} />}
    </>
  );
}
