import { Button, Card, IconButton } from "@mui/material";
import Box from "@mui/material/Box";
import type { RecipeStep } from "@paint-vault/core/recipe-steps";
import type { ReactNode } from "react";

import { Plus, X } from "../icons";
import { useVault, useVaultStore } from "../store/hooks";
import type { Paint, PaintStateSetter, Requirement } from "../types";
import { listResetSx } from "../utils/element-resets";
import type { RecipePaint } from "../utils/recipe-merge";

import { DashedAddButton } from "./DashedAddButton";
import { legacyRecipePaintStatus, ProjectedPaintRow, type RecipePaintStatus } from "./PaintRow";
import { SchemeChip } from "./SchemeChip";

export type RecipeStepRow = RecipePaint<Omit<Requirement, "miniatureId">> & { paint: Paint };

// One step of a project's recipe: a numbered header, then its paints as sortable rows. In edit
// mode the header can add a paint, or remove the step while it is empty.
export type RecipeStepCardProps = {
  step: RecipeStep;
  label: string;
  // Position in the recipe, starting at 1.
  number: number;
  rows: RecipeStepRow[];
  miniatureId: string;
  editMode: boolean;
  // The paint search is open below this step's rows.
  adding: boolean;
  // The paint search shown while adding.
  addPanel?: ReactNode;
  onToggleAdd: () => void;
  onRemoveStep: () => void;
  onRemovePaint: (paint: Paint) => void;
  onOpenPaint: (id: string) => void;
};

export function RecipeStepCard(props: RecipeStepCardProps) {
  const data = useVault();
  const setPaintState = useVaultStore((s) => s.setPaintState);
  return (
    <RecipeStepCardView
      {...props}
      paintStatus={(id) => legacyRecipePaintStatus(data, props.miniatureId, id)}
      onSetPaintState={setPaintState}
      renderSchemeChip={(scheme) => <SchemeChip scheme={scheme} />}
    />
  );
}

export type RecipeStepCardViewProps = RecipeStepCardProps & {
  paintStatus: (id: string) => RecipePaintStatus;
  onSetPaintState: PaintStateSetter;
  renderSchemeChip: (scheme: { id: string; name: string }) => ReactNode;
};

export function RecipeStepCardView({
  step,
  label,
  number,
  rows,
  miniatureId,
  editMode,
  adding,
  addPanel,
  onToggleAdd,
  onRemoveStep,
  onRemovePaint,
  onOpenPaint,
  paintStatus,
  onSetPaintState,
  renderSchemeChip,
}: RecipeStepCardViewProps) {
  return (
    <Card sx={{ overflow: "visible" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          // Reserve room for the edit-mode Add button so the header height holds.
          minHeight: 41,
          pl: 1.5,
          pr: 0.75,
          py: 0.5,
          borderBottom: "1px solid var(--line)",
          bgcolor: "color-mix(in oklab, var(--sunken) 50%, transparent)",
          borderTopLeftRadius: "inherit",
          borderTopRightRadius: "inherit",
        }}
      >
        <Box
          component="span"
          sx={{
            display: "grid",
            placeItems: "center",
            width: 22,
            height: 22,
            borderRadius: "50%",
            bgcolor: "var(--surface-raised)",
            border: "1px solid var(--line)",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--ink-soft)",
          }}
        >
          {number}
        </Box>
        <Box component="b" sx={{ fontSize: 14 }}>
          {label}
        </Box>
        <Box sx={{ flex: 1 }} />
        {editMode && (rows.length > 0 || adding) && (
          <Button
            size="small"
            variant="text"
            startIcon={adding ? <X size={14} /> : <Plus size={14} />}
            aria-expanded={adding}
            aria-label={adding ? `Close adding to ${label}` : `Add paint to ${label}`}
            onClick={onToggleAdd}
            sx={{ color: "var(--ink-soft)", minWidth: 0 }}
          >
            {adding ? "Close" : "Add"}
          </Button>
        )}
        {editMode && rows.length === 0 && (
          <IconButton
            size="small"
            aria-label={`Remove empty ${label} step`}
            onClick={onRemoveStep}
            sx={{ color: "var(--ink-soft)" }}
          >
            <X size={14} />
          </IconButton>
        )}
      </Box>
      {rows.length ? (
        <Box
          component="ul"
          sx={{
            ...listResetSx,
            boxSizing: "border-box",
            "& > :where(:not(:last-child))": { borderBottom: "1px solid var(--line)" },
          }}
        >
          {rows.map(({ manual, paint, schemeSources }) => (
            <ProjectedPaintRow
              key={`${step}:${paint.id}`}
              paint={paint}
              {...paintStatus(paint.id)}
              onSetPaintState={onSetPaintState}
              renderSchemeChip={renderSchemeChip}
              requirement={{
                id: manual?.id ?? `${step}:${paint.id}`,
                miniatureId,
                paintId: paint.id,
                notes: manual?.notes ?? "",
                sortOrder: manual?.sortOrder ?? 0,
                step,
              }}
              manual={!!manual}
              schemeSources={schemeSources}
              sortableId={`${step}:${paint.id}`}
              miniatureId={miniatureId}
              onOpenPaint={() => onOpenPaint(paint.id)}
              editMode={editMode}
              onRemove={() => manual && onRemovePaint(paint)}
            />
          ))}
        </Box>
      ) : editMode && !adding ? (
        <Box sx={{ p: 1 }}>
          <DashedAddButton
            label="Add the first paint"
            ariaLabel={`Add the first paint to ${label}`}
            onClick={onToggleAdd}
          />
        </Box>
      ) : !adding ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            minHeight: 64,
            px: 1.5,
            color: "var(--ink-faint)",
            fontSize: 12,
          }}
        >
          No paints in this step yet.
        </Box>
      ) : null}
      {adding && addPanel}
    </Card>
  );
}
