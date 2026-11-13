import Box from "@mui/material/Box";
import { defaultSubstitution, isPaintAvailable } from "@paint-vault/core/paint-substitutions";
import { memo, type KeyboardEvent } from "react";
import { shallow } from "zustand/shallow";

import { useVault, useVaultStore } from "../store/hooks";
import type { Paint } from "../types";
import { owns } from "../utils/vault-data";

import { PaintRowActions } from "./PaintRowActions";
import { PaintRowLabel, paintRowHoverSx } from "./PaintRowLabel";
import { PaintSubstitutionChip } from "./PaintSubstitutionChip";

// A paint in the library or a scheme: owned paints show their quantity, and paints that aren't
// available can be marked owned or added to the wishlist.
export const LibraryPaintRow = memo(function LibraryPaintRow({
  paint,
  toggleOwned: toggleOwnedOverride,
  onOpenPaint,
  index,
  border = "top",
  onKeyDownCapture,
}: {
  paint: Paint;
  // Replaces the usual owned toggle, as in the project drawer's scheme previews.
  toggleOwned?(paint: Paint): void;
  onOpenPaint(id: string): void;
  // Position in a windowed list; the first row has no top border.
  index?: number;
  border?: "top" | "bottom" | "none";
  onKeyDownCapture?: (event: KeyboardEvent<HTMLLIElement>) => void;
}) {
  const { substitution, record, available } = useVault(
    (data) => ({
      substitution: defaultSubstitution(data, paint.id),
      record: data.paintRecords[paint.id],
      // Includes inventory and recursive substitution ingredients, not only this paint's record.
      available: isPaintAvailable(data, data.paintRecords, paint.id),
    }),
    shallow,
  );
  const notify = useVaultStore((s) => s.notify);
  const setPaintState = useVaultStore((s) => s.setPaintState);
  const storeToggleOwned = useVaultStore((s) => s.toggleOwned);
  const toggleOwned = toggleOwnedOverride ?? storeToggleOwned;
  const directlyOwned = owns(record);
  const wishlisted = record?.state === "WISHLIST";
  const stockLevel = record?.stockLevel === "EMPTY" ? "FULL" : record?.stockLevel;

  return (
    <Box
      component="li"
      data-paint-index={index}
      onKeyDownCapture={onKeyDownCapture}
      sx={[
        {
          boxSizing: "border-box",
          display: "flex",
          height: "66px",
          minWidth: 0,
          alignItems: "center",
        },
        border === "top" && index !== 0
          ? {
              borderTopStyle: "solid",
              borderTopWidth: "1px",
              borderColor: "var(--line)",
            }
          : border === "bottom" && {
              borderBottomStyle: "solid",
              borderBottomWidth: "1px",
              borderColor: "var(--line)",
              "&:last-child": {
                borderBottomStyle: "solid",
                borderBottomWidth: "0px",
              },
            },
        paintRowHoverSx,
      ]}
    >
      <PaintRowLabel
        paint={paint}
        onClick={() => onOpenPaint(paint.id)}
        accessory={substitution && <PaintSubstitutionChip name={substitution.name} />}
      />
      <PaintRowActions
        quantity={
          directlyOwned && record?.quantity !== undefined
            ? {
                paintName: paint.name,
                value: record.quantity,
                onChange: (quantity) =>
                  setPaintState(paint.id, quantity === 0 ? null : "OWNED", stockLevel, quantity),
              }
            : undefined
        }
        wishlist={
          !available || wishlisted
            ? {
                active: wishlisted,
                label: wishlisted ? `Remove ${paint.name} from wishlist` : `Add ${paint.name} to wishlist`,
                title: wishlisted ? "Remove from wishlist" : "Add to wishlist",
                onClick: () => {
                  setPaintState(paint.id, wishlisted ? null : "WISHLIST");
                  notify(`${paint.name} ${wishlisted ? "removed from" : "added to"} wishlist`);
                },
              }
            : undefined
        }
        add={
          !available
            ? {
                label: substitution
                  ? `${paint.name} is unavailable through ${substitution.name}`
                  : `Mark ${paint.name} as owned`,
                title: substitution ? `Unavailable through ${substitution.name}` : "Mark as owned",
                disabled: Boolean(substitution),
                onClick: () => toggleOwned(paint),
              }
            : undefined
        }
        remove={
          directlyOwned
            ? {
                label: `Set ${paint.name} quantity to 0`,
                title: "Remove from paint library",
                onClick: () => setPaintState(paint.id, null, stockLevel, 0),
              }
            : undefined
        }
      />
    </Box>
  );
});
