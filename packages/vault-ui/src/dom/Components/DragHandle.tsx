import type { useSortable } from "@dnd-kit/sortable";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import { GripVertical } from "../icons";

type Sortable = ReturnType<typeof useSortable>;

export const DRAG_HANDLE_SIZE = { width: 24, height: 32 } as const;

// The grip button that starts dragging a sortable row. Pass the row's useSortable attributes and
// listeners; `sx` can change its size or colors.
export function DragHandle({
  label,
  title,
  attributes,
  listeners,
  sx,
}: {
  // Accessible name, such as "Reorder Crimson Base".
  label: string;
  title?: string;
  attributes: Sortable["attributes"];
  listeners: Sortable["listeners"];
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      component="button"
      type="button"
      {...attributes}
      {...listeners}
      aria-label={label}
      title={title}
      sx={[
        {
          display: "grid",
          placeItems: "center",
          ...DRAG_HANDLE_SIZE,
          flexShrink: 0,
          p: 0,
          border: 0,
          borderRadius: "6px",
          bgcolor: "transparent",
          color: "inherit",
          cursor: "grab",
          touchAction: "none",
          "&:active": { cursor: "grabbing" },
          // The app's standard keyboard focus ring.
          "&:focus-visible": { outline: "2px solid var(--gold)", outlineOffset: "-2px" },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <GripVertical size={17} />
    </Box>
  );
}
