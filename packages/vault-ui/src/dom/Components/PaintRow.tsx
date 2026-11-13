import { useFragment } from "@apollo/client/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Box from "@mui/material/Box";
import { Fragment, type ReactNode } from "react";

import { PaintStockFragmentDoc } from "../graphql/generated/graphql";
import { useVaultGraphQL, type VaultGraphQLScope } from "../graphql/provider";
import type { Paint, PaintStateSetter, Requirement } from "../types";

import { DragHandle } from "./DragHandle";
import { PaintRowActions } from "./PaintRowActions";
import {
  PaintRowLabel,
  RECIPE_LABEL_NAME_OFFSET,
  RECIPE_LABEL_PADDING,
  paintRowHoverSx,
} from "./PaintRowLabel";
import { PaintSubstitutionChip } from "./PaintSubstitutionChip";
import { StatusChip } from "./StatusChip";

// In edit mode the row is padded and its grip sits before the label, separated by a gap.
const EDIT_ROW_PADDING = 4;
const HANDLE_WIDTH = 28;
const HANDLE_GAP = 8;

// A paint in a miniature's recipe, marked Packed, Wishlisted or Missing. In edit mode, paints added
// by hand can be dragged between steps and removed; paints from a scheme stay put.
export type RecipePaintStatus = {
  available: boolean;
  wished: boolean;
  activeSubstitution: { name: string; broken: boolean } | null;
};

export type PaintRowProps = {
  paint: Paint;
  requirement: Requirement;
  miniatureId: string;
  onOpenPaint: () => void;
  editMode: boolean;
  onRemove: () => void;
  // Added to the miniature by hand rather than through a scheme.
  manual?: boolean;
  schemeSources?: { id: string; name: string }[];
  // Must be unique in the surrounding SortableContext; defaults to the paint id.
  sortableId?: string;
};

export type PaintRowViewProps = PaintRowProps &
  RecipePaintStatus & {
    onSetPaintState: PaintStateSetter;
    renderSchemeChip(scheme: { id: string; name: string }): ReactNode;
  };

// Overlay only raw inventory while accepted server availability and substitution readiness stay stable.
export function ProjectedPaintRow(props: PaintRowViewProps) {
  const scope = useVaultGraphQL();
  return scope ? <CachedPaintRow {...props} scope={scope} /> : <PaintRowView {...props} />;
}

function CachedPaintRow({ scope, ...props }: PaintRowViewProps & { scope: VaultGraphQLScope }) {
  const { data, complete } = useFragment({
    fragment: PaintStockFragmentDoc,
    from: { __typename: "Paint", id: props.paint.id },
    client: scope.client,
    optimistic: true,
  });
  return <PaintRowView {...props} wished={complete ? data.inventory?.state === "WISHLIST" : props.wished} />;
}

export function PaintRowView({
  paint,
  requirement,
  onOpenPaint,
  editMode,
  onRemove,
  manual = true,
  schemeSources = [],
  sortableId,
  available: owned,
  wished,
  activeSubstitution: active,
  onSetPaintState,
  renderSchemeChip,
}: PaintRowViewProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId ?? paint.id,
    disabled: { draggable: !editMode || !manual, droppable: !editMode },
  });
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
          accessory={active && <PaintSubstitutionChip name={active.name} broken={active.broken} />}
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
                  onClick: () => onSetPaintState(paint.id, wished ? null : "WISHLIST"),
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
            <Fragment key={source.id}>{renderSchemeChip(source)}</Fragment>
          ))}
        </Box>
      )}
    </Box>
  );
}
