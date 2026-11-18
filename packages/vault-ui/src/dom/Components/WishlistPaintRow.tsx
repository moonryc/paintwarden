import { useTranslation } from "react-i18next";
import { Button } from "@mui/material";
import Box from "@mui/material/Box";

import { formatNumber } from "../i18n";

import { up } from "../theme-tokens";
import type { Paint } from "../types";
import type { PaintRequirementReason } from "../utils/vault-data";

import { PaintRowActions } from "./PaintRowActions";
import { PaintRowLabel, paintRowHoverSx } from "./PaintRowLabel";
import { RoundActionButton } from "./RoundActionButton";
import { StatusChip } from "./StatusChip";

// A paint on the wishlist. Until it's bought it offers Bought and Remove; once bought it
// stays in place with a quantity counter so the count can be corrected.
export function WishlistPaintRow({
  paint,
  listPosition,
  restock,
  quantity,
  onBought,
  onQuantityChange,
  onRemove,
  onOpenPaint,
  reasons,
  onFix,
  projectCount,
  onProjects,
}: {
  paint: Paint;
  reasons?: PaintRequirementReason[];
  onFix?(): void;
  projectCount?: number;
  onProjects?(): void;
  // Position within the full brand list, even when only its viewport fragment is mounted.
  listPosition?: { index: number; size: number };
  // The paint is owned but running low, rather than never bought.
  restock: boolean;
  // Set once the paint has been bought.
  quantity?: number;
  onBought(): void;
  onQuantityChange(quantity: number): void;
  onRemove(): void;
  onOpenPaint(): void;
}) {
  const { t } = useTranslation("components");
  const bought = quantity !== undefined;
  return (
    <Box
      component="li"
      aria-posinset={listPosition ? listPosition.index + 1 : undefined}
      aria-setsize={listPosition?.size}
      sx={[
        {
          boxSizing: "border-box",
          display: "flex",
          height: "66px",
          minWidth: 0,
          alignItems: "center",
          pr: 0.5,
          [up.md]: {
            pr: 1,
          },
        },
        paintRowHoverSx,
      ]}
    >
      <PaintRowLabel
        paint={paint}
        onClick={onOpenPaint}
        accessory={restock && <StatusChip tone="gold">{t("restock")}</StatusChip>}
      />
      {Boolean(projectCount) && onProjects && (
        <Box sx={{ flexShrink: 0, mr: 0.75 }}>
          <RoundActionButton
            size="md"
            tone="info"
            label={`${projectCount! > 99 ? "99+ · " : ""}${t("usedInProjects", { count: projectCount })}`}
            title={t("usedInProjects", { count: projectCount })}
            onClick={onProjects}
          >
            <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 700, lineHeight: 1 }}>
              {projectCount! > 99 ? "99+" : formatNumber(projectCount!)}
            </Box>
          </RoundActionButton>
        </Box>
      )}
      {reasons?.includes("brokenSubstitution") && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minWidth: 0,
            maxWidth: "25%",
            "& .MuiChip-root": { maxWidth: "100%" },
            "& button": { minWidth: 0, overflowWrap: "anywhere", fontSize: "0.65rem", lineHeight: 1.2 },
          }}
        >
          <StatusChip tone="rust">{t("brokenSubstitution")}</StatusChip>
          <Button size="small" aria-label={t("fixPaintSubstitution", { name: paint.name })} onClick={onFix}>
            {t("fixSubstitution")}
          </Button>
        </Box>
      )}
      {bought ? (
        <PaintRowActions quantity={{ paintName: paint.name, value: quantity, onChange: onQuantityChange }} />
      ) : (
        <PaintRowActions
          add={{
            label: t("markPaintBought", { name: paint.name }),
            title: t("markAsBought"),
            onClick: onBought,
          }}
          remove={{
            label: t("removePaintFromWishlist", { name: paint.name }),
            title: t("removeFromWishlist"),
            onClick: onRemove,
          }}
        />
      )}
    </Box>
  );
}
