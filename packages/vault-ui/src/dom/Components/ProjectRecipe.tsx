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
import { Button, Card, FormControlLabel, MenuItem, Switch, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { useState, type ReactNode } from "react";

import { Check, CircleDashed, Layers, Pencil, Plus } from "../icons";
import { SchemePickerDialog } from "../Modals/SchemePickerDialog";
import { useVault, useVaultStore } from "../store/hooks";
import type { Miniature, Paint, RecipeStep, Requirement } from "../types";
import { createClientId } from "../utils/client-id";
import { STEPS, noop } from "../utils/constants";
import { mergeRecipePaints } from "../utils/recipe-merge";
import { schemeOrderEntries } from "../utils/scheme-order";
import { attachedSchemes } from "../utils/vault-data";

import { DashedAddButton } from "./DashedAddButton";
import { PaintAutocomplete } from "./PaintAutocomplete";
import { RecipeSchemeTile } from "./RecipeSchemeTile";
import { RecipeStepCard } from "./RecipeStepCard";

type Entry = Omit<Requirement, "miniatureId">;
type Adding = { kind: "paint"; step: RecipeStep } | { kind: "step"; step: RecipeStep } | null;

const STEP_RANK = new Map(STEPS.map(([step], index) => [step, index]));

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

export function ProjectRecipe({
  miniature,
  required,
  requirementRows,
  onOpenPaint,
  onOpenScheme,
}: {
  miniature: Miniature;
  required: Paint[];
  requirementRows: Requirement[];
  onOpenPaint(id: string): void;
  onOpenScheme(id: string): void;
}) {
  const data = useVault();
  const api = useVaultStore((s) => s.api);
  const notify = useVaultStore((s) => s.notify);
  const setRecipe = useVaultStore((s) => s.setRecipe);
  const setRecipeSteps = useVaultStore((s) => s.setRecipeSteps);
  // Editing controls stay hidden until asked for, so a stray tap can't change the recipe.
  const [editMode, setEditMode] = useState(false);
  const [adding, setAdding] = useState<Adding>(null);
  const [search, setSearch] = useState("");
  const [pickingSchemes, setPickingSchemes] = useState(false);
  const [lastStep, setLastStep] = useState<RecipeStep>("BASECOAT");
  const [showSchemePaints, setShowSchemePaints] = useState(() => {
    try {
      return localStorage.getItem("paint-vault:show-scheme-paints-in-steps") === "true";
    } catch {
      return false;
    }
  });
  const changeShowSchemePaints = (value: boolean) => {
    setShowSchemePaints(value);
    try {
      localStorage.setItem("paint-vault:show-scheme-paints-in-steps", String(value));
    } catch {
      /* Viewing still works when storage is unavailable. */
    }
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const { catalog } = data;

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
    notify(`Removed ${paint.name} from recipe`, "ok", {
      label: "Undo",
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

  const schemes = attachedSchemes(data, miniature.id),
    attachedIds = schemes.map((scheme) => scheme.id);
  const setAttached = (schemeIds: string[]) =>
    api("/api/miniature-schemes", {
      method: "PUT",
      body: JSON.stringify({ miniatureId: miniature.id, schemeIds }),
    });
  const undoSchemes = (previous: string[]) => ({
    label: "Undo",
    onClick: () => void setAttached(previous).catch(noop),
  });
  const removeScheme = (schemeId: string, name: string) => {
    const previous = attachedIds;
    setAttached(attachedIds.filter((id) => id !== schemeId)).then(
      () => notify(`Removed ${name}`, "ok", undoSchemes(previous)),
      noop,
    );
  };
  const saveSchemes = async (next: string[]) => {
    const previous = attachedIds;
    const added = next.filter((id) => !previous.includes(id)).length;
    const removed = previous.filter((id) => !next.includes(id)).length;
    await setAttached(next);
    const parts = [
      added && `added ${added} scheme${added === 1 ? "" : "s"}`,
      removed && `removed ${removed} scheme${removed === 1 ? "" : "s"}`,
    ].filter(Boolean);
    const message = parts.join(", ");
    notify(message.charAt(0).toUpperCase() + message.slice(1), "ok", undoSchemes(previous));
  };

  const merged = mergeRecipePaints(
    entries,
    showSchemePaints && !editMode
      ? schemes.map((scheme) => ({
          id: scheme.id,
          name: scheme.name,
          entries: schemeOrderEntries(data, scheme.id),
        }))
      : [],
  );
  const rows = merged
    .map((row) => ({ ...row, paint: catalog.find((paint) => paint.id === row.paintId) }))
    .filter((item): item is typeof item & { paint: Paint } => !!item.paint);
  const explicitSteps = data.recipeSteps
    .filter((row) => row.miniatureId === miniature.id)
    .map((row) => row.step);
  const groups = STEPS.map(([step, label]) => ({
    step,
    label,
    rows: rows.filter((row) => row.step === step),
  })).filter((group) => group.rows.length || explicitSteps.includes(group.step));

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
      ? (STEPS.find(([candidate]) => !groups.some((group) => group.step === candidate))?.[0] ?? lastStep)
      : lastStep;
    setAdding((current) => (current?.kind === "step" ? null : { kind: "step", step }));
  };
  const confirmStep = (step: RecipeStep) => {
    if (!explicitSteps.includes(step)) setRecipeSteps(miniature.id, [...explicitSteps, step]);
    setLastStep(step);
    closeAdding();
  };

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
        paints={catalog}
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
            Schemes and paints
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
            Paint recipe
          </Box>
        </div>
        <Box component="div" sx={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 1 }}>
          {editMode ? (
            <Button size="small" variant="contained" startIcon={<Check size={14} />} onClick={finishEditing}>
              Done
            </Button>
          ) : (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Pencil size={14} />}
              onClick={() => setEditMode(true)}
            >
              Edit recipe
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
        {(schemes.length > 0 || editMode) && (
          <RecipeSubheader id="recipe-schemes-heading" label="Color schemes" />
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
              <RecipeSchemeTile
                key={scheme.id}
                scheme={scheme}
                editMode={editMode}
                onOpen={() => onOpenScheme(scheme.id)}
                onRemove={() => removeScheme(scheme.id, scheme.name)}
              />
            ))}
            {editMode && (
              <DashedAddButton
                label="Add Scheme"
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
            label="Paint steps"
            spaced={schemes.length > 0 || editMode}
            action={
              schemes.length > 0 && !editMode ? (
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={showSchemePaints}
                      onChange={(event) => changeShowSchemePaints(event.target.checked)}
                      slotProps={{ input: { "aria-label": "Show scheme paints in steps" } }}
                    />
                  }
                  label="Show scheme paints"
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
                  <RecipeStepCard
                    key={group.step}
                    step={group.step}
                    label={group.label}
                    number={index + 1}
                    rows={group.rows}
                    miniatureId={miniature.id}
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

        {editMode && groups.length < STEPS.length && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
            <DashedAddButton
              label={adding?.kind === "step" ? "Close" : "Add a step"}
              onClick={openStepAdd}
              expanded={adding?.kind === "step"}
            />
            {adding?.kind === "step" && (
              <Card sx={{ width: "100%", p: 1.5, display: "flex", flexWrap: "wrap", gap: 1 }}>
                <TextField
                  select
                  size="small"
                  label="Step"
                  value={adding.step}
                  onChange={(event) => setAdding({ kind: "step", step: event.target.value as RecipeStep })}
                  sx={{ flex: "1 1 150px" }}
                >
                  {STEPS.filter(([step]) => !groups.some((group) => group.step === step)).map(
                    ([step, label]) => (
                      <MenuItem key={step} value={step}>
                        {label}
                      </MenuItem>
                    ),
                  )}
                </TextField>
                <Button variant="contained" size="small" onClick={() => confirmStep(adding.step)}>
                  Confirm
                </Button>
              </Card>
            )}
          </Box>
        )}

        {editMode && groups.length > 0 && (
          <Box component="p" sx={{ m: 0, fontSize: 12, color: "var(--ink-faint)", textAlign: "center" }}>
            Drag a paint to reorder it or move it to another step.
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
              No paints assigned yet
            </Box>
            <Box
              component="span"
              sx={{
                fontSize: "0.75rem",
                lineHeight: 4 / 3,
              }}
            >
              Start from a color scheme or create a paint step.
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
                Add a scheme
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
                Add a step
              </Button>
            </Box>
          </Box>
        )}
      </Box>
      {pickingSchemes && (
        <SchemePickerDialog
          attachedIds={attachedIds}
          onSave={saveSchemes}
          onClose={() => setPickingSchemes(false)}
        />
      )}
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
