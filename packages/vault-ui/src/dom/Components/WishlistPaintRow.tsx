import { Button } from "@mui/material";
import Box from "@mui/material/Box";

import { up } from "../theme-tokens";
import type { Paint } from "../types";
import type { PaintRequirementReason } from "../utils/vault-data";

import { PaintRowActions } from "./PaintRowActions";
import { PaintRowLabel, paintRowHoverSx } from "./PaintRowLabel";
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
}: {
  paint: Paint;
  reasons?: PaintRequirementReason[];
  onFix?(): void;
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
        accessory={restock && <StatusChip tone="gold">Restock</StatusChip>}
      />
      {reasons?.includes("brokenSubstitution") && (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
          <StatusChip tone="rust">Broken substitution</StatusChip>
          <Button size="small" aria-label={`Fix substitution for ${paint.name}`} onClick={onFix}>
            Fix substitution
          </Button>
        </Box>
      )}
      {bought ? (
        <PaintRowActions quantity={{ paintName: paint.name, value: quantity, onChange: onQuantityChange }} />
      ) : (
        <PaintRowActions
          add={{ label: `Mark ${paint.name} as bought`, title: "Mark as bought", onClick: onBought }}
          remove={{
            label: `Remove ${paint.name} from wishlist`,
            title: "Remove from wishlist",
            onClick: onRemove,
          }}
        />
      )}
    </Box>
  );
}
