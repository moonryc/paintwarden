import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Box from "@mui/material/Box";
import { resolvePaintChoice, selectedSubstitution } from "@paint-vault/core/paint-substitutions";

import { useVault, useVaultStore } from "../store/hooks";
import type { Paint, Requirement } from "../types";
import { owns } from "../utils/vault-data";

import { DragHandle } from "./DragHandle";
import { PaintRowActions } from "./PaintRowActions";
import {
  PaintRowLabel,
  RECIPE_LABEL_NAME_OFFSET,
  RECIPE_LABEL_PADDING,
  paintRowHoverSx,
} from "./PaintRowLabel";
import { PaintSubstitutionChip } from "./PaintSubstitutionChip";
import { SchemeChip } from "./SchemeChip";
import { StatusChip } from "./StatusChip";

// In edit mode the row is padded and its grip sits before the label, separated by a gap.
const EDIT_ROW_PADDING = 4;
const HANDLE_WIDTH = 28;
const HANDLE_GAP = 8;

// A paint in a miniature's recipe, marked Packed, Wishlisted or Missing. In edit mode, paints added
// by hand can be dragged between steps and removed; paints from a scheme stay put.
export function PaintRow({
  paint,
  requirement,
  miniatureId,
  onOpenPaint,
  editMode,
  onRemove,
  manual = true,
  schemeSources = [],
  sortableId,
}: {
  paint: Paint;
  requirement: Requirement;
  miniatureId: string;
  onOpenPaint(): void;
  editMode: boolean;
  onRemove(): void;
  // Added to the miniature by hand rather than through a scheme.
  manual?: boolean;
  // The schemes that bring this paint into the recipe.
  schemeSources?: { id: string; name: string }[];
  // Must be unique in the surrounding SortableContext; defaults to the paint id.
  sortableId?: string;
}) {
  const data = useVault();
  const setPaintState = useVaultStore((s) => s.setPaintState);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId ?? paint.id,
    disabled: { draggable: !editMode || !manual, droppable: !editMode },
  });
  const active = selectedSubstitution(data, miniatureId, paint.id);
  const resolved = resolvePaintChoice(data, miniatureId, paint.id);
  const resolvedPaints = resolved.paintIds
    .map((id) => data.catalog.find((item) => item.id === id))
    .filter(Boolean) as Paint[];
  const owned = resolvedPaints.every((item) => owns(data.paintRecords[item.id])) && !resolved.cycle;
  const wished = data.paintStates[paint.id] === "WISHLIST";
  const draggable = editMode && manual;
  // Line the scheme-source line up with the paint name.
  const nameIndent =
    (editMode ? EDIT_ROW_PADDING + RECIPE_LABEL_PADDING.edit : RECIPE_LABEL_PADDING.default) +
    (draggable ? HANDLE_WIDTH + HANDLE_GAP : 0) +
    RECIPE_LABEL_NAME_OFFSET;

  return (
    <Box
      component="li"
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 2 : undefined }}
      sx={{
        position: "relative",
        "&:last-of-type": {
          borderBottomLeftRadius: 20,
          borderBottomRightRadius: 20,
          overflow: isDragging ? "visible" : "hidden",
        },
        bgcolor: isDragging ? "color-mix(in oklab, var(--sunken) 55%, var(--surface-raised))" : "transparent",
        ...paintRowHoverSx,
        opacity: isDragging ? 0.55 : 1,
        boxShadow: isDragging ? "0 10px 24px rgb(var(--shadow-color) / .18)" : "none",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: editMode ? `${HANDLE_GAP}px` : 0,
          pl: editMode ? `${EDIT_ROW_PADDING}px` : 0,
          pr: editMode ? 1 : 0,
        }}
      >
        {draggable && (
          <DragHandle
            label={`Reorder ${paint.name}`}
            title="Drag to reorder or move to another step"
            attributes={attributes}
            listeners={listeners}
            sx={{
              width: HANDLE_WIDTH,
              height: 40,
              borderRadius: "8px",
              color: "var(--ink-faint)",
              "&:hover": { color: "var(--ink)" },
            }}
          />
        )}
        <PaintRowLabel
          variant="recipe"
          paint={paint}
          onClick={onOpenPaint}
          editMode={editMode}
          owned={owned}
          notes={requirement.notes}
          accessory={active && <PaintSubstitutionChip name={active.name} />}
          status={
            <StatusChip
              tone={owned ? "ok" : wished ? "wishlist" : "muted"}
              sx={{ display: { xs: "none", sm: "inline-flex" }, textTransform: "uppercase" }}
            >
              {owned ? "Packed" : wished ? "Wishlisted" : "Missing"}
            </StatusChip>
          }
        />
        <PaintRowActions
          wishlist={
            !owned && !active
              ? {
                  active: wished,
                  label: wished ? `Remove ${paint.name} from wishlist` : `Add ${paint.name} to wishlist`,
                  title: wished ? "Remove from wishlist" : "Add to wishlist",
                  onClick: () => setPaintState(paint.id, wished ? null : "WISHLIST"),
                }
              : undefined
          }
          remove={
            draggable
              ? { label: `Remove ${paint.name} from recipe`, title: "Remove from recipe", onClick: onRemove }
              : undefined
          }
        />
      </Box>
      {(schemeSources.length > 0 || !manual) && (
        <Box
          component="div"
          sx={{
            pl: `${nameIndent}px`,
            pr: 2,
            mt: -0.75,
            pb: 1.5,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 0.5,
            fontSize: 11,
            lineHeight: "18px",
            color: "var(--ink-faint)",
          }}
        >
          <Box component="span" sx={{ mr: 0.25 }}>
            {manual ? "Added to miniature" : "From scheme"}
          </Box>
          {schemeSources.map((source) => (
            <SchemeChip key={source.id} scheme={source} />
          ))}
        </Box>
      )}
    </Box>
  );
}
