import { Button } from "@mui/material";

import { Heart } from "../icons";
import { useVault, useVaultStore } from "../store/hooks";
import type { Paint } from "../types";

import { PaintChecklistItem } from "./PaintChecklistItem";
import { PaintRowActions } from "./PaintRowActions";
import { ProgressSummaryCard } from "./ProgressSummaryCard";

// Keep the paint shortfall visible while the detailed list is collapsed.
export function ProjectPaintSummary({
  required,
  missing,
  onOpenPaint,
  onAddAllToWishlist,
}: {
  required: Paint[];
  missing: Paint[];
  onOpenPaint(id: string): void;
  onAddAllToWishlist(paints: Paint[]): void;
}) {
  const data = useVault();
  const setPaintState = useVaultStore((s) => s.setPaintState);
  const total = required.length;
  if (!total) return null;
  const have = total - missing.length;
  const ready = missing.length === 0;
  const notWishlisted = missing.filter((paint) => data.paintStates[paint.id] !== "WISHLIST");
  return (
    <ProgressSummaryCard
      title={
        ready
          ? "Palette ready — go paint!"
          : `${missing.length} paint${missing.length === 1 ? "" : "s"} to gather`
      }
      subtitle={`${have} of ${total} on hand`}
      progress={(have / total) * 100}
      progressLabel={`${have} of ${total} paints on hand`}
      hint="Select a paint to view details or update your wishlist."
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
        const wished = data.paintStates[paint.id] === "WISHLIST";
        return (
          <PaintChecklistItem
            key={paint.id}
            paint={paint}
            subtitle={wished ? "On your wishlist" : paint.range}
            wishlisted={wished}
            selectAction="open details"
            onSelect={() => onOpenPaint(paint.id)}
            actions={
              <PaintRowActions
                wishlist={{
                  active: wished,
                  label: wished ? `Remove ${paint.name} from wishlist` : `Add ${paint.name} to wishlist`,
                  title: wished ? "Remove from wishlist" : "Add to wishlist",
                  onClick: () => setPaintState(paint.id, wished ? null : "WISHLIST"),
                }}
              />
            }
          />
        );
      })}
    </ProgressSummaryCard>
  );
}
