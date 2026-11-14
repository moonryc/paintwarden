import { formatNumber } from "../i18n";
import { useTranslation } from "react-i18next";
import { Button, Card, IconButton } from "@mui/material";
import Box from "@mui/material/Box";
import type { RecipeStep } from "@paint-vault/core/recipe-steps";
import type { ReactNode } from "react";

import { Plus, X } from "../icons";
import type { Paint, PaintStateSetter, Requirement } from "../types";
import { listResetSx } from "../utils/element-resets";
import type { RecipePaint } from "../utils/recipe-merge";

import { DashedAddButton } from "./DashedAddButton";
import { ProjectedPaintRow, type RecipePaintStatus } from "./PaintRow";

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
  const { t } = useTranslation("components");
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
          {formatNumber(number)}
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
            aria-label={adding ? t("closeAddingToStep", { label }) : t("addPaintToStep", { label })}
            onClick={onToggleAdd}
            sx={{ color: "var(--ink-soft)", minWidth: 0 }}
          >
            {adding ? t("close") : t("add")}
          </Button>
        )}
        {editMode && rows.length === 0 && (
          <IconButton
            size="small"
            aria-label={t("removeEmptyStep", { label })}
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
            label={t("addTheFirstPaint")}
            ariaLabel={t("addFirstPaintToStep", { label })}
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
          {t("noPaintsInThisStepYet")}
        </Box>
      ) : null}
      {adding && addPanel}
    </Card>
  );
}
