import { ButtonBase } from "@mui/material";
import Box from "@mui/material/Box";
import type { ReactNode } from "react";

import type { Paint } from "../types";
import { truncateSx } from "../utils/truncate";
import { visuallyHiddenSx } from "../utils/visually-hidden";

import { PaintBottle } from "./PaintBottle";

// One paint in a ProgressSummaryCard checklist: selecting it runs onSelect, and actions sit beside it.
export function PaintChecklistItem({
  paint,
  subtitle,
  selectAction,
  onSelect,
  wishlisted = false,
  endAdornment,
  actions,
  listPosition,
}: {
  paint: Paint;
  subtitle: string;
  // What selecting the paint does, for screen readers, such as "add to wishlist".
  selectAction: string;
  onSelect(): void;
  wishlisted?: boolean;
  endAdornment?: ReactNode;
  actions?: ReactNode;
  // Position in the complete checklist when only a viewport of items is mounted.
  listPosition?: { index: number; count: number };
}) {
  return (
    <Box
      component="li"
      data-checklist-index={listPosition?.index}
      aria-posinset={listPosition ? listPosition.index + 1 : undefined}
      aria-setsize={listPosition?.count}
      sx={{
        display: "flex",
        alignItems: "center",
        minWidth: 0,
        borderRadius: 1.5,
        "&:hover": { bgcolor: "var(--sunken)" },
      }}
    >
      <ButtonBase
        onClick={onSelect}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          minWidth: 0,
          flex: 1,
          px: 1.25,
          py: 1,
          borderRadius: 1.5,
          textAlign: "left",
          color: "var(--ink)",
          "&.Mui-focusVisible": { outline: "2px solid var(--gold)", outlineOffset: -2 },
          "&:hover .add-heart, &.Mui-focusVisible .add-heart": {
            color: "var(--wishlist)",
            borderColor: "var(--wishlist)",
            bgcolor: "color-mix(in oklab, var(--wishlist) 10%, var(--surface))",
          },
        }}
      >
        <PaintBottle paint={paint} size="sm" />
        <Box component="span" sx={{ minWidth: 0, flex: 1 }}>
          <Box
            component="span"
            sx={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              ...truncateSx,
            }}
          >
            {paint.name}
          </Box>
          <Box
            component="span"
            sx={{
              display: "block",
              fontSize: 11,
              color: wishlisted ? "var(--wishlist)" : "var(--ink-faint)",
              fontWeight: wishlisted ? 600 : 400,
              ...truncateSx,
            }}
          >
            {subtitle}
          </Box>
        </Box>
        {endAdornment}
        <Box component="span" sx={visuallyHiddenSx}>
          , {selectAction}
        </Box>
      </ButtonBase>
      {actions}
    </Box>
  );
}
