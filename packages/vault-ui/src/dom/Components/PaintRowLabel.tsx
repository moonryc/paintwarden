import Box from "@mui/material/Box";
import type { ReactNode } from "react";

import { up } from "../theme-tokens";
import type { Paint } from "../types";
import { truncateSx } from "../utils/truncate";

import { PaintBottle } from "./PaintBottle";
import { PaintDetailsButton } from "./PaintDetailsButton";

// Shared by the library, wishlist and recipe paint rows.

export const paintRowHoverSx = {
  transition: "background-color .15s",
  "&:hover, &:focus-within": {
    bgcolor: "color-mix(in oklab, var(--sunken) 40%, transparent)",
  },
};

// Horizontal padding of a recipe label (16px, or 4px in edit mode); PaintRow uses these to
// line up its scheme-source line.
export const RECIPE_LABEL_PADDING = { default: 16, edit: 4 } as const;
// Bottle width plus the gap before the paint name.
export const RECIPE_LABEL_NAME_OFFSET = 44 + 12;

// The bottle, name and range at the start of a paint row; it opens the paint's details.
// Recipe rows also strike through owned paints, show the step's notes under the name and end
// with a status chip.
export function PaintRowLabel({
  paint,
  onClick,
  accessory,
  variant = "list",
  owned = false,
  notes,
  status,
  editMode = false,
}: {
  paint: Paint;
  onClick(): void;
  // Shown after the name, such as a substitution or restock chip.
  accessory?: ReactNode;
  variant?: "list" | "recipe";
  // The options below apply to recipe labels.
  owned?: boolean;
  notes?: string;
  // Shown at the end of the label, such as the Packed/Missing chip.
  status?: ReactNode;
  editMode?: boolean;
}) {
  const recipe = variant === "recipe";
  return (
    <PaintDetailsButton
      onClick={onClick}
      sx={[
        {
          boxSizing: "border-box",
          display: "flex",
          minWidth: 0,
          flex: "1",
          alignItems: "center",
          gap: 1.5,
          textAlign: "left",
        },
        recipe
          ? {
              alignSelf: "stretch",
              borderRadius: 0,
              py: 1.5,
              px: `${editMode ? RECIPE_LABEL_PADDING.edit : RECIPE_LABEL_PADDING.default}px`,
            }
          : {
              justifyContent: "flex-start",
              py: 1.25,
              pl: 2,
              [up.md]: { pl: 2.5 },
            },
      ]}
    >
      <PaintBottle paint={paint} />
      <Box component="span" sx={{ display: "flex", minWidth: 0, flex: "1", alignItems: "center", gap: 0.75 }}>
        <Box component="span" sx={{ minWidth: 0 }}>
          <Box
            component={recipe ? "span" : "b"}
            sx={[
              { ...truncateSx, display: "block", fontSize: "0.875rem", lineHeight: 10 / 7 },
              recipe && {
                fontWeight: 600,
                transition:
                  "color 150ms cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 150ms cubic-bezier(0.4, 0, 0.2, 1)",
              },
              recipe &&
                owned && {
                  color: "var(--ink-faint)",
                  textDecorationLine: "line-through",
                  textDecorationColor: "color-mix(in oklab, var(--ink-faint) 50%, transparent)",
                },
            ]}
          >
            {paint.name}
          </Box>
          <Box
            component={recipe ? "span" : "small"}
            sx={[
              { ...truncateSx, display: "block", color: "var(--ink-faint)" },
              recipe && { fontSize: "11px" },
            ]}
          >
            {paint.brand} · {paint.range}
            {paint.isCustom ? " · Custom" : ""}
          </Box>
          {recipe && notes && (
            <Box
              component="span"
              sx={{
                ...truncateSx,
                display: "block",
                mt: 0.25,
                fontSize: 12,
                fontStyle: "italic",
                color: "var(--ink-soft)",
              }}
            >
              {notes}
            </Box>
          )}
        </Box>
        {accessory}
      </Box>
      {recipe && status}
    </PaintDetailsButton>
  );
}
