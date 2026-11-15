import { useTranslation } from "react-i18next";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import Colorize from "@mui/icons-material/Colorize";
import { Button, ButtonBase, Chip, Card, FormControlLabel, MenuItem, Switch, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { useState, type ReactNode } from "react";

import { Check, CircleDashed, Layers, Pencil, Plus } from "../icons";
import { useVaultStore } from "../store/hooks";
import type { Miniature, Paint, PaintStateSetter, RecipeStep, Requirement, SchemeOrderEntry } from "../types";
import { imageUrl } from "../utils/image-cache";
import { createClientId } from "../utils/client-id";
import { noop, getSteps } from "../utils/constants";
import { mergeRecipePaints } from "../utils/recipe-merge";

import { DashedAddButton } from "./DashedAddButton";
import { PaintAutocomplete } from "./PaintAutocomplete";
import { type RecipePaintStatus } from "./PaintRow";
import { RecipeSchemeTileView } from "./RecipeSchemeTile";
import { RecipeStepCardView } from "./RecipeStepCard";
import { SchemeChipView } from "./SchemeChip";
import { SchemeSwatchView } from "./SchemeSwatch";
import { canSampleImage } from "./swatch-sampling";

type Entry = Omit<Requirement, "miniatureId">;
type Adding = { kind: "paint"; step: RecipeStep } | { kind: "step"; step: RecipeStep } | null;

const STEP_RANK = new Map(getSteps().map(([step], index) => [step, index]));

// Recipes read top to bottom in painting order, so keep entries grouped by step.
function orderEntries(entries: Entry[]): Entry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        (STEP_RANK.get(a.entry.step) ?? 99) - (STEP_RANK.get(b.entry.step) ?? 99) ||
        a.entry.sortOrder - b.entry.sortOrder ||
        a.index - b.index,
    )
    .map(({ entry }, sortOrder) => ({ ...entry, sortOrder }));
}

export type ProjectRecipeProps = {
  miniature: Miniature;
  required: Paint[];
  requirementRows: Requirement[];
  onOpenPaint: (id: string) => void;
  onOpenScheme: (id: string) => void;
};

export type ProjectRecipeScheme = {
  id: string;
  name: string;
  paintCount: number;
  paints: Paint[];
  entries: SchemeOrderEntry[];
};

export type RecipeSchemePickerProps = {
  attachedIds: string[];
  onSave: (schemeIds: string[]) => Promise<unknown>;
  onClose: () => void;
};

export type ProjectRecipeViewProps = ProjectRecipeProps & {
  onScan?: () => void;
  // Only paints needed by this detail projection; the picker fetches its own search window.
  catalog: Paint[];
  explicitSteps: RecipeStep[];
  schemes: ProjectRecipeScheme[];
  paintStatus: (id: string) => RecipePaintStatus;
  onSetPaintState: PaintStateSetter;
  setRecipe: (miniatureId: string, entries: Entry[]) => void;
  setRecipeSteps: (miniatureId: string, steps: RecipeStep[]) => void;
  setAttached: (schemeIds: string[]) => Promise<unknown>;
  renderSchemePicker: (props: RecipeSchemePickerProps) => ReactNode;
};

export function ProjectRecipeView({
  miniature,
  required,
  requirementRows,
  onOpenPaint,
  onOpenScheme,
  catalog,
  explicitSteps,
  schemes,
  paintStatus,
  onSetPaintState,
  setRecipe,
  setRecipeSteps,
  setAttached,
  renderSchemePicker,
  onScan,
}: ProjectRecipeViewProps) {
  const { t } = useTranslation("components");
  const notify = useVaultStore((s) => s.notify);
  // Editing controls stay hidden until asked for, so a stray tap can't change the recipe.
  const [editMode, setEditMode] = useState(false);
  const [adding, setAdding] = useState<Adding>(null);
  const [search, setSearch] = useState("");
  const [pickingSchemes, setPickingSchemes] = useState(false);
  const [lastStep, setLastStep] = useState<RecipeStep>("BASECOAT");
  const [showSchemePaints, setShowSchemePaints] = useState(() => {
    try {
      return localStorage.getItem("paintwarden:show-scheme-paints-in-steps") === "true";
    } catch {
      return false;
    }
  });
  const changeShowSchemePaints = (value: boolean) => {
    setShowSchemePaints(value);
    try {
      localStorage.setItem("paintwarden:show-scheme-paints-in-steps", String(value));
    } catch {
      /* Viewing still works when storage is unavailable. */
    }
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const entries = orderEntries(
    requirementRows.map(({ id, paintId, notes, sortOrder, step }) => ({
      id,
      paintId,
      notes,
      sortOrder,
      step,
    })),
  );
  // A paint can be in several steps, but only once in each.
  const idsInStep = (step: RecipeStep) =>
    entries.filter((entry) => entry.step === step).map((entry) => entry.paintId);
  const dragIds = entries.map((entry) => `${entry.step}:${entry.paintId}`);
  const save = (next: Entry[]) => setRecipe(miniature.id, orderEntries(next));
  const addPaint = (paint: Paint, step: RecipeStep) => {
    const sortOrder = Math.max(-1, ...entries.filter((e) => e.step === step).map((e) => e.sortOrder)) + 0.5;
    save([...entries, { id: createClientId(), paintId: paint.id, notes: "", sortOrder, step }]);
    setLastStep(step);
  };
  const removePaint = (paint: Paint, step: RecipeStep) => {
    const previous = entries;
    save(entries.filter((entry) => entry.paintId !== paint.id || entry.step !== step));
    notify(t("paintRemovedFromRecipe", { name: paint.name }), "ok", {
      label: t("undo"),
      onClick: () => setRecipe(miniature.id, previous),
    });
  };
  const reorder = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = dragIds.indexOf(String(active.id)),
      to = dragIds.indexOf(String(over.id));
    if (from < 0) return;
    const moving = entries[from];
    // A step can't hold the same paint twice, so a move that would repeat it is ignored.
    const repeats = (step: RecipeStep) => step !== moving.step && idsInStep(step).includes(moving.paintId);
    if (to < 0) {
      const target = rows.find((row) => `${row.step}:${row.paintId}` === String(over.id));
      if (!target || repeats(target.step)) return;
      const next = entries.filter((_, index) => index !== from);
      next.push({ ...entries[from], step: target.step, sortOrder: next.length });
      save(next);
      return;
    }
    // Dropping onto a paint in another step adopts that step.
    const step = entries[to].step;
    if (repeats(step)) return;
    const next = arrayMove(entries, from, to).map((entry, sortOrder) => ({
      ...entry,
      sortOrder,
      step: entry.id === entries[from].id ? step : entry.step,
    }));
    setRecipe(miniature.id, next);
  };

  const attachedIds = schemes.map((scheme) => scheme.id);
  const undoSchemes = (previous: string[]) => ({
    label: t("undo"),
    onClick: () => void setAttached(previous).catch(noop),
  });
  const removeScheme = (schemeId: string, name: string) => {
    const previous = attachedIds;
    setAttached(attachedIds.filter((id) => id !== schemeId)).then(
      () => notify(t("removedItem", { name }), "ok", undoSchemes(previous)),
      noop,
    );
  };
  const saveSchemes = async (next: string[]) => {
    const previous = attachedIds;
    const added = next.filter((id) => !previous.includes(id)).length;
    const removed = previous.filter((id) => !next.includes(id)).length;
    await setAttached(next);
    const addedSummary = t("schemesAdded", { count: added });
    const removedSummary = t("schemesRemoved", { count: removed });
    const message =
      added && removed
        ? t("schemesChanged", { addedSummary, removedSummary })
        : added
          ? addedSummary
          : removedSummary;
    notify(message, "ok", undoSchemes(previous));
  };

  const merged = mergeRecipePaints(
    entries,
    showSchemePaints && !editMode
      ? schemes.map((scheme) => ({
          id: scheme.id,
          name: scheme.name,
          entries: scheme.entries,
        }))
      : [],
  );
  const rows = merged
    .map((row) => ({ ...row, paint: catalog.find((paint) => paint.id === row.paintId) }))
    .filter((item): item is typeof item & { paint: Paint } => !!item.paint);
  const groups = getSteps()
    .map(([step, label]) => ({
      step,
      label,
      rows: rows.filter((row) => row.step === step),
    }))
    .filter((group) => group.rows.length || explicitSteps.includes(group.step));

  const closeAdding = () => {
    setAdding(null);
    setSearch("");
  };
  const finishEditing = () => {
    closeAdding();
    setEditMode(false);
  };
  const openPaintAdd = (step: RecipeStep) => {
    setEditMode(true);
    setSearch("");
    setAdding((current) =>
      current?.kind === "paint" && current.step === step ? null : { kind: "paint", step },
    );
  };
  const openStepAdd = () => {
    const step = groups.some((group) => group.step === lastStep)
      ? (getSteps().find(([candidate]) => !groups.some((group) => group.step === candidate))?.[0] ?? lastStep)
      : lastStep;
    setAdding((current) => (current?.kind === "step" ? null : { kind: "step", step }));
  };
  const confirmStep = (step: RecipeStep) => {
    if (!explicitSteps.includes(step)) setRecipeSteps(miniature.id, [...explicitSteps, step]);
    setLastStep(step);
    closeAdding();
  };

  const canScan = Boolean(miniature.imageUrl && canSampleImage(miniature.imageUrl, location.href));

  const paintPanel = (step: RecipeStep) => (
    <Box
      className="anim-rise"
      sx={{
        display: "grid",
        gap: 1,
        gridTemplateColumns: "1fr",
        alignItems: "start",
        p: 1.5,
        borderTop: "1px solid var(--line)",
      }}
    >
      <PaintAutocomplete
        excludedIds={idsInStep(step)}
        query={search}
        onQueryChange={setSearch}
        onChoose={(paint) => {
          addPaint(paint, step);
          setSearch("");
        }}
      />
    </Box>
  );

  return (
    <section aria-labelledby="paint-recipe-heading">
      <Box
        component="div"
        sx={{
          mb: 1.5,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <div>
          <Box
            component="p"
            sx={{
              m: 0,
              mb: 0.7,
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            {t("schemesAndPaints")}
          </Box>
          <Box
            component="h3"
            id="paint-recipe-heading"
            sx={{
              m: 0,
              fontFamily: "var(--font-serif)",
              letterSpacing: "-0.02em",
              fontOpticalSizing: "auto",
              fontSize: "1.25rem",
              lineHeight: 1.4,
              fontWeight: 600,
            }}
          >
            {t("paintRecipe")}
          </Box>
        </div>
        <Box component="div" sx={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 1 }}>
          {editMode ? (
            <Button size="small" variant="contained" startIcon={<Check size={14} />} onClick={finishEditing}>
              {t("done")}
            </Button>
          ) : (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Pencil size={14} />}
              onClick={() => setEditMode(true)}
            >
              {t("editRecipe")}
            </Button>
          )}
        </Box>
      </Box>

      <Box
        component="div"
        sx={{
          "& > :where(:not(:last-child))": { mb: 1.5 },
        }}
      >
        {editMode && onScan && miniature.imageUrl && (
          <ButtonBase
            onClick={onScan}
            disabled={!canScan}
            sx={{
              display: "flex",
              width: "100%",
              textAlign: "left",
              gap: 1.5,
              p: 1.25,
              border: "1px solid var(--line)",
              borderRadius: 2,
              bgcolor: "var(--surface-raised)",
              color: "var(--ink)",
              "&:hover": { borderColor: "var(--brand)" },
              "&.Mui-focusVisible": { outline: "2px solid var(--brand)", outlineOffset: 2 },
            }}
          >
            <Box
              component="img"
              src={imageUrl(miniature.imageUrl)}
              alt=""
              sx={{ width: 52, height: 52, flexShrink: 0, objectFit: "cover", borderRadius: 1 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 0.75,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {t("scanTitle")}
                <Chip
                  component="span"
                  label={t("scanBeta")}
                  size="small"
                  sx={{
                    height: 19,
                    fontSize: 10,
                    bgcolor: "var(--sunken)",
                    color: "var(--ink-soft)",
                    "& .MuiChip-label": { px: 0.75 },
                  }}
                />
              </Box>
              <Box sx={{ fontSize: 12, color: "var(--ink-soft)", mt: 0.5 }}>
                {canScan ? t("scanFindPaints") : t("scanExternal")}
              </Box>
            </Box>
            <Colorize sx={{ fontSize: 20, flexShrink: 0, color: "var(--ink-soft)", mr: 0.5 }} />
          </ButtonBase>
        )}

        {(schemes.length > 0 || editMode) && (
          <RecipeSubheader id="recipe-schemes-heading" label={t("colorSchemes")} />
        )}
        {(schemes.length > 0 || editMode) && (
          <Box
            component="div"
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(3, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" },
              gap: 1.5,
            }}
          >
            {schemes.map((scheme) => (
              <RecipeSchemeTileView
                key={scheme.id}
                scheme={scheme}
                entries={scheme.entries}
                paints={scheme.paints}
                paintCount={scheme.paintCount}
                editMode={editMode}
                onOpen={() => onOpenScheme(scheme.id)}
                onRemove={() => removeScheme(scheme.id, scheme.name)}
              />
            ))}
            {editMode && (
              <DashedAddButton
                label={t("addScheme")}
                onClick={() => setPickingSchemes(true)}
                ariaHaspopup="dialog"
                minHeight={116}
              />
            )}
          </Box>
        )}

        {(groups.length > 0 || editMode || schemes.length > 0) && (
          <RecipeSubheader
            id="recipe-paints-heading"
            label={t("paintSteps")}
            spaced={schemes.length > 0 || editMode}
            action={
              schemes.length > 0 && !editMode ? (
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={showSchemePaints}
                      onChange={(event) => changeShowSchemePaints(event.target.checked)}
                      slotProps={{ input: { "aria-label": t("showSchemePaintsInSteps") } }}
                    />
                  }
                  label={t("showSchemePaints")}
                  sx={{ m: 0, flexShrink: 0, "& .MuiFormControlLabel-label": { fontSize: 12 } }}
                />
              ) : null
            }
          />
        )}
        {groups.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder}>
            <SortableContext
              items={groups.flatMap((group) => group.rows.map((row) => `${row.step}:${row.paintId}`))}
              strategy={verticalListSortingStrategy}
            >
              {groups.map((group, index) => {
                const addingHere = adding?.kind === "paint" && adding.step === group.step;
                return (
                  <RecipeStepCardView
                    key={group.step}
                    step={group.step}
                    label={group.label}
                    number={index + 1}
                    rows={group.rows}
                    miniatureId={miniature.id}
                    paintStatus={paintStatus}
                    onSetPaintState={onSetPaintState}
                    renderSchemeChip={(source) => {
                      const scheme = schemes.find((candidate) => candidate.id === source.id);
                      return (
                        <SchemeChipView
                          scheme={source}
                          swatch={
                            <SchemeSwatchView
                              entries={scheme?.entries ?? []}
                              paints={scheme?.paints ?? []}
                              size="xs"
                            />
                          }
                        />
                      );
                    }}
                    editMode={editMode}
                    adding={addingHere}
                    addPanel={addingHere && paintPanel(group.step)}
                    onToggleAdd={() => openPaintAdd(group.step)}
                    onRemoveStep={() =>
                      setRecipeSteps(
                        miniature.id,
                        explicitSteps.filter((step) => step !== group.step),
                      )
                    }
                    onRemovePaint={(paint) => removePaint(paint, group.step)}
                    onOpenPaint={onOpenPaint}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        )}

        {editMode && groups.length < getSteps().length && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
            <DashedAddButton
              label={adding?.kind === "step" ? t("close") : t("addAStep")}
              onClick={openStepAdd}
              expanded={adding?.kind === "step"}
            />
            {adding?.kind === "step" && (
              <Card sx={{ width: "100%", p: 1.5, display: "flex", flexWrap: "wrap", gap: 1 }}>
                <TextField
                  select
                  size="small"
                  label={t("step")}
                  value={adding.step}
                  onChange={(event) => setAdding({ kind: "step", step: event.target.value as RecipeStep })}
                  sx={{ flex: "1 1 150px" }}
                >
                  {getSteps()
                    .filter(([step]) => !groups.some((group) => group.step === step))
                    .map(([step, label]) => (
                      <MenuItem key={step} value={step}>
                        {label}
                      </MenuItem>
                    ))}
                </TextField>
                <Button variant="contained" size="small" onClick={() => confirmStep(adding.step)}>
                  {t("confirm")}
                </Button>
              </Card>
            )}
          </Box>
        )}

        {editMode && groups.length > 0 && (
          <Box component="p" sx={{ m: 0, fontSize: 12, color: "var(--ink-faint)", textAlign: "center" }}>
            {t("dragAPaintToReorderItOrMoveIt")}
          </Box>
        )}

        {!required.length && !groups.length && !adding && !editMode && (
          <Box
            sx={{
              boxSizing: "border-box",
              display: "block",
              width: "100%",
              borderRadius: "18px",
              borderStyle: "dashed",
              borderWidth: "2px",
              borderColor: "var(--line-strong)",
              padding: "2rem",
              textAlign: "center",
              color: "var(--ink-faint)",
            }}
          >
            <CircleDashed style={{ display: "block", margin: "0 auto 0.5rem" }} />
            <Box
              component="b"
              sx={{
                display: "block",
                color: "var(--ink)",
              }}
            >
              {t("noPaintsAssignedYet")}
            </Box>
            <Box
              component="span"
              sx={{
                fontSize: "0.75rem",
                lineHeight: 4 / 3,
              }}
            >
              {t("startFromAColorSchemeOrCreateAPaint")}
            </Box>
            <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 1, mt: 2 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Layers size={14} />}
                onClick={() => {
                  setEditMode(true);
                  setPickingSchemes(true);
                }}
              >
                {t("addAScheme")}
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<Plus size={14} />}
                onClick={() => {
                  setEditMode(true);
                  openStepAdd();
                }}
              >
                {t("addAStep")}
              </Button>
            </Box>
          </Box>
        )}
      </Box>
      {pickingSchemes &&
        renderSchemePicker({
          attachedIds,
          onSave: saveSchemes,
          onClose: () => setPickingSchemes(false),
        })}
    </section>
  );
}

function RecipeSubheader({
  id,
  label,
  spaced = false,
  action,
}: {
  id: string;
  label: string;
  spaced?: boolean;
  action?: ReactNode;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 32, pt: spaced ? 1.5 : 0 }}>
      <Box
        component="h4"
        id={id}
        sx={{ m: 0, fontSize: 13, fontWeight: 700, color: "var(--ink)", flexShrink: 0 }}
      >
        {label}
      </Box>
      <Box
        component="span"
        aria-hidden="true"
        sx={{ flex: 1, minWidth: 0, height: "1px", bgcolor: "var(--line)" }}
      />
      {action}
    </Box>
  );
}
