import { useTranslation } from "react-i18next";
import { Box, Button } from "@mui/material";
import { useState } from "react";

import { Heart } from "../icons";
import { SubstitutionDialog } from "../Modals/SubstitutionDialog";
import type { Paint, PaintStatus } from "../types";

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
  const { t } = useTranslation("components");
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
            ? t("paletteReadyGoPaint")
            : broken
              ? t("paintsNeedAttention", { count: missing.length })
              : t("paintsToGather", { count: missing.length })
        }
        subtitle={broken ? t("paintReadyRatio", { have, total }) : t("paintOnHandRatio", { have, total })}
        progress={(have / total) * 100}
        progressLabel={
          broken ? t("paintsReadyRatio", { have, total }) : t("paintsOnHandRatio", { have, total })
        }
        hint={
          broken
            ? t("fixBrokenSubstitutionsBuyingTheOriginalPaintWonT")
            : t("selectAPaintToViewDetailsOrUpdateYour")
        }
        action={
          <Button
            size="small"
            variant="contained"
            startIcon={<Heart size={14} />}
            disabled={notWishlisted.length === 0}
            onClick={() => onAddAllToWishlist(notWishlisted)}
          >
            {t("wishlistAll")}
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
              subtitle={wished ? t("onYourWishlist") : paint.range}
              wishlisted={wished}
              selectAction={t("openDetails2")}
              onSelect={() => onOpenPaint(paint.id)}
              actions={
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  {isBroken && <StatusChip tone="rust">{t("brokenSubstitution")}</StatusChip>}
                  {isBroken && (
                    <Button
                      size="small"
                      aria-label={t("fixPaintSubstitution", { name: paint.name })}
                      onClick={() => setFixPaint(paint)}
                    >
                      {t("fixSubstitution")}
                    </Button>
                  )}
                  {needsStock(paint) && (
                    <PaintRowActions
                      wishlist={{
                        active: wished,
                        label: wished
                          ? t("removePaintFromWishlist", { name: paint.name })
                          : t("addPaintToWishlist", { name: paint.name }),
                        title: wished ? t("removeFromWishlist") : t("addToWishlist"),
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
