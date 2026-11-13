import type { DragEndEvent } from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Alert, Button, Card, Chip, MenuItem, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import type { ColorCategory } from "@paint-vault/core/color-categories";
import { COLOR_CATEGORIES, COLOR_CATEGORY_LABELS } from "@paint-vault/core/color-categories";
import { useState } from "react";

import { Modal } from "../Components/Modal";
import { Plus, Save, Trash2 } from "../icons";
import { useVaultStore } from "../store/hooks";
import { up } from "../theme-tokens";
import type { ColorScheme, ColorSchemeDivider, DividerTone, Paint, SchemeOrderEntry } from "../types";
import { createClientId } from "../utils/client-id";
import { listResetSx } from "../utils/element-resets";
import {
  insertBeforeCompletionMilestone,
  insertIntoSchemeStep,
  reorderSchemeEntries,
  isPinnedStartMilestone,
  isRequiredMilestone,
  keepStartMilestoneFirst,
  schemePaintsHaveSteps,
} from "../utils/scheme-order";

import { AddSchemeItemDialog, type SchemeItemKind } from "./AddSchemeItemDialog";
import { RequiredMilestone, SchemeEntryRow } from "./SchemeEntryRow";

// The parent supplies a complete projection and keys this editor by scheme id. Drafts are
// initialized only on mount, so background query refreshes cannot overwrite unsaved changes.
export function ProjectSchemeEditor({
  scheme,
  entries: initialEntries,
  paints,
  onClose,
}: {
  scheme: Pick<ColorScheme, "id" | "name" | "category" | "isSystem" | "sourceName" | "sourceLogoUrl">;
  entries: SchemeOrderEntry[];
  paints: Paint[];
  onClose: () => void;
}) {
  const api = useVaultStore((s) => s.api);
  const notify = useVaultStore((s) => s.notify);
  const [name, setName] = useState(scheme.name),
    [category, setCategory] = useState<ColorCategory | "">(scheme.category ?? ""),
    [entries, setEntries] = useState(() => keepStartMilestoneFirst(initialEntries)),
    [catalog, setCatalog] = useState(paints),
    [addItem, setAddItem] = useState<SchemeItemKind | null>(null),
    [targetStepId, setTargetStepId] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [error, setError] = useState<{ operation: "save" | "delete"; message: string } | null>(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const paintIds = entries
    .filter((entry): entry is Extract<SchemeOrderEntry, { type: "PAINT" }> => entry.type === "PAINT")
    .map((entry) => entry.paintId);
  const pinnedStartMilestone = entries.find(isPinnedStartMilestone);
  const sortableEntries = entries.filter((entry) => !isPinnedStartMilestone(entry));
  const reorder = ({ active: dragged, over }: DragEndEvent) => {
    if (busy || !over || dragged.id === over.id) return;
    setEntries((items) => {
      const from = items.find((item) => item.id === dragged.id);
      if (!from || isPinnedStartMilestone(from)) return items;
      return keepStartMilestoneFirst(reorderSchemeEntries(items, String(dragged.id), String(over.id)));
    });
  };
  const closeAddItem = () => {
    setAddItem(null);
    setTargetStepId(null);
  };
  const addDivider = (label: string, tone: DividerTone) => {
    setEntries((items) => {
      const divider: SchemeOrderEntry = {
        type: "DIVIDER",
        id: createClientId(),
        label,
        tone,
        sortOrder: items.length,
      };
      return insertBeforeCompletionMilestone(items, divider);
    });
    closeAddItem();
  };
  const addImage = (url: string) => {
    setEntries((items) =>
      insertBeforeCompletionMilestone(items, {
        type: "IMAGE",
        id: createClientId(),
        imageUrl: url,
        thumbnailUrl: null,
        imageType: null,
        method: null,
        sortOrder: items.length,
      }),
    );
    closeAddItem();
  };
  const addPaint = (paint: Paint) => {
    if (!targetStepId) return;
    // Apollo autocomplete can return paints outside the supplied projection. Retain the
    // entire selection locally even after the picker excludes it from later results.
    setCatalog((items) => [...items.filter((item) => item.id !== paint.id), paint]);
    setEntries((items) =>
      insertIntoSchemeStep(items, targetStepId, {
        type: "PAINT",
        id: createClientId(),
        paintId: paint.id,
        sortOrder: items.length,
      }),
    );
    closeAddItem();
  };
  const updateDivider = (id: string, patch: Partial<Pick<ColorSchemeDivider, "label" | "tone">>) =>
    setEntries((items) =>
      items.map((item) =>
        item.type === "DIVIDER" && item.id === id && !isRequiredMilestone(item)
          ? { ...item, ...patch }
          : item,
      ),
    );
  const openPaintForStep = (id: string) => {
    setTargetStepId(id);
    setAddItem("PAINT");
  };
  const payloadEntries = entries.map((entry) =>
    entry.type === "PAINT"
      ? { type: entry.type, paintId: entry.paintId }
      : entry.type === "DIVIDER"
        ? { type: entry.type, id: entry.id, label: entry.label, tone: entry.tone, role: entry.role ?? null }
        : {
            type: entry.type,
            id: entry.id,
            imageUrl: entry.imageUrl,
            thumbnailUrl: entry.thumbnailUrl,
            imageType: entry.imageType,
            method: entry.method,
          },
  );
  const validDividers = entries.every((entry) => entry.type !== "DIVIDER" || !!entry.label.trim());
  const validPaintSteps = schemePaintsHaveSteps(entries);
  const targetStepEntry = entries.find((entry) => entry.id === targetStepId);
  const paintsInStep = (stepId: string) => {
    const start = entries.findIndex((entry) => entry.id === stepId);
    const end = entries.findIndex((entry, index) => index > start && entry.type === "DIVIDER");
    return entries.slice(start + 1, end < 0 ? undefined : end).filter((entry) => entry.type === "PAINT")
      .length;
  };
  const canSave = !!name.trim() && !!category && !!paintIds.length && validDividers && validPaintSteps;
  const save = async () => {
    if (scheme.isSystem || busy || !canSave) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/color-schemes", {
        method: "PUT",
        body: JSON.stringify({ id: scheme.id, name, category, entries: payloadEntries }),
      });
      notify("Color scheme updated");
      onClose();
    } catch (cause) {
      setError({
        operation: "save",
        message: cause instanceof Error ? cause.message : "Could not save color scheme.",
      });
    } finally {
      setBusy(false);
    }
  };
  const deleteScheme = async () => {
    if (scheme.isSystem || busy || !confirmDelete) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/color-schemes?id=${encodeURIComponent(scheme.id)}`, { method: "DELETE" });
      notify("Color scheme deleted");
      onClose();
    } catch (cause) {
      setError({
        operation: "delete",
        message: cause instanceof Error ? cause.message : "Could not delete color scheme.",
      });
    } finally {
      setBusy(false);
    }
  };
  if (scheme.isSystem)
    return (
      <Modal title="Color schemes" subtitle="Catalog palettes are read-only." onClose={onClose}>
        <Chip color="secondary" size="small" label={`${scheme.sourceName || "Catalog source"} · read-only`} />
        <Alert severity="info" sx={{ mt: 2 }}>
          Catalog color schemes cannot be edited.
        </Alert>
      </Modal>
    );
  return (
    <Modal title="Color schemes" subtitle="Group paints into reusable, ordered palettes." onClose={onClose}>
      <Box
        component="fieldset"
        disabled={busy}
        inert={busy}
        aria-label="Color scheme editor"
        aria-busy={busy}
        sx={{
          border: 0,
          p: 0,
          m: 0,
          minWidth: 0,
          "& > :where(:not(:last-child))": { mb: 2 },
        }}
      >
        <Box
          component="div"
          sx={{
            display: "grid",
            gap: 1.5,
            [up.sm]: {
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            },
          }}
        >
          <TextField
            fullWidth
            label="Scheme name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ultramarines armour"
          />
          <TextField
            fullWidth
            required
            select
            label="Color category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ColorCategory)}
          >
            {COLOR_CATEGORIES.map((value) => (
              <MenuItem key={value} value={value}>
                {COLOR_CATEGORY_LABELS[value]}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Box
          component="div"
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 1,
          }}
        >
          <Button variant="outlined" startIcon={<Plus size={16} />} onClick={() => setAddItem("STEP")}>
            Step
          </Button>
          <Button variant="outlined" startIcon={<Plus size={16} />} onClick={() => setAddItem("MILESTONE")}>
            Milestone
          </Button>
          <Button variant="outlined" startIcon={<Plus size={16} />} onClick={() => setAddItem("IMAGE")}>
            Image
          </Button>
        </Box>
        <div>
          <Box
            component="div"
            sx={{
              mb: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
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
              Scheme order
            </Box>
            <Box
              component="span"
              sx={{
                fontSize: "0.75rem",
                lineHeight: 4 / 3,
                color: "var(--ink-faint)",
              }}
            >
              Add paints inside a step; drag items to reorder
            </Box>
          </Box>
          {entries.length ? (
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={reorder}>
              <Card
                component="ul"
                sx={{
                  ...listResetSx,
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                {pinnedStartMilestone && (
                  <Box
                    component="li"
                    sx={{
                      boxSizing: "border-box",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      borderBottomStyle: "solid",
                      borderBottomWidth: "1px",
                      borderColor: "var(--line)",
                      bgcolor: "var(--brand)",
                      p: 1.25,
                      color: "var(--brand-fg)",
                    }}
                  >
                    <RequiredMilestone label={pinnedStartMilestone.label} />
                  </Box>
                )}
                <SortableContext
                  items={sortableEntries.map((entry) => entry.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sortableEntries.map((entry) => (
                    <SchemeEntryRow
                      key={entry.id}
                      entry={entry}
                      paint={
                        entry.type === "PAINT" ? catalog.find((item) => item.id === entry.paintId) : null
                      }
                      stepHasPaints={entry.type === "DIVIDER" && paintsInStep(entry.id) > 0}
                      onChangeLabel={(patch) => updateDivider(entry.id, patch)}
                      onAddPaint={() => openPaintForStep(entry.id)}
                      onRemove={() =>
                        setEntries((items) =>
                          items
                            .filter((item) => item.id !== entry.id || isRequiredMilestone(item))
                            .map((item, sortOrder) => ({ ...item, sortOrder })),
                        )
                      }
                    />
                  ))}
                </SortableContext>
              </Card>
            </DndContext>
          ) : (
            <Box
              component="div"
              sx={{
                boxSizing: "border-box",
                borderRadius: "16px",
                borderStyle: "dashed",
                borderWidth: "2px",
                borderColor: "var(--line-strong)",
                p: 2.5,
                textAlign: "center",
                fontSize: "0.875rem",
                lineHeight: 10 / 7,
                color: "var(--ink-faint)",
              }}
            >
              Use the buttons above to add paints, dividers, and images.
            </Box>
          )}
        </div>
        <Box
          component="div"
          sx={{
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 1,
            pt: 0.5,
          }}
        >
          <Button
            color="error"
            variant={confirmDelete ? "contained" : "outlined"}
            disabled={busy}
            onClick={() => {
              if (!confirmDelete) setConfirmDelete(true);
              else void deleteScheme();
            }}
            startIcon={<Trash2 size={15} />}
          >
            {confirmDelete ? "Confirm delete" : "Delete"}
          </Button>
          <Button
            variant="contained"
            loading={busy}
            disabled={busy || !canSave}
            onClick={save}
            startIcon={<Save size={15} />}
            fullWidth
          >
            Save
          </Button>
          {!validPaintSteps && (
            <Box sx={{ color: "var(--rust)", fontSize: 12 }}>
              Place every paint beneath a step before saving.
            </Box>
          )}
        </Box>
      </Box>
      {error && (
        <Alert
          severity="error"
          sx={{ mt: 2 }}
          action={
            <Button
              disabled={busy || (error.operation === "save" && !canSave)}
              onClick={error.operation === "save" ? save : deleteScheme}
            >
              Retry
            </Button>
          }
        >
          {error.message}
        </Alert>
      )}
      {addItem && (
        <AddSchemeItemDialog
          kind={addItem}
          stepLabel={targetStepEntry?.type === "DIVIDER" ? targetStepEntry.label : undefined}
          paints={catalog}
          excludedIds={paintIds}
          onAddDivider={addDivider}
          onAddImage={addImage}
          onAddPaint={addPaint}
          onClose={closeAddItem}
        />
      )}
    </Modal>
  );
}
