import { Alert, Autocomplete, Button, CircularProgress, MenuItem, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { useEffect, useState } from "react";

import { Modal } from "../../Components/Modal";
import { useVault, useVaultStore } from "../../store/hooks";
import { useTemplateRecipe } from "../../store/template-hooks";
import type { MiniatureTemplate, MiniatureTemplateRecipe } from "../../types";

// Creates a reusable miniature template, starting from one of your miniatures or from scratch,
// or edits one of your templates: name, manufacturer, faction, picture, schemes, and paints with
// their step and notes.
type EditorProps = {
  // The template to edit, or null for a new one.
  template: MiniatureTemplate | null;
  // Called after a successful save.
  onSaved: () => Promise<void>;
  onClose: () => void;
};

export function TemplateEditorDialog(props: EditorProps) {
  const recipe = useTemplateRecipe(props.template?.id ?? null);
  const [readyId, setReadyId] = useState<string | null>(null);
  useEffect(() => {
    if (props.template && recipe.data && !recipe.isStale) setReadyId(props.template.id);
  }, [props.template, recipe.data, recipe.isStale]);
  // Do not initialize an editor from stale recipes after a restore/source update. Once open,
  // background invalidation must not discard the owner's unsaved edits.
  if (props.template && (readyId !== props.template.id || !recipe.data)) {
    return (
      <Modal title="Edit template" subtitle="Load this reusable miniature setup." onClose={props.onClose}>
        {recipe.error ? (
          <Alert severity="error" action={<Button onClick={() => void recipe.refetch()}>Retry</Button>}>
            {recipe.error.message}
          </Alert>
        ) : (
          <CircularProgress size={24} aria-label="Loading template recipe" />
        )}
      </Modal>
    );
  }
  return <TemplateEditorFields key={props.template?.id ?? "new"} {...props} recipe={recipe.data} />;
}

function TemplateEditorFields({
  template,
  onSaved,
  onClose,
  recipe,
}: EditorProps & { recipe?: MiniatureTemplateRecipe }) {
  const data = useVault();
  const api = useVaultStore((s) => s.api);
  const [name, setName] = useState(() => template?.name ?? "");
  const [manufacturer, setManufacturer] = useState(() => template?.manufacturer ?? "");
  const [faction, setFaction] = useState(() => template?.faction ?? "");
  const [imageUrl, setImageUrl] = useState(() =>
    template?.imageUrl?.startsWith("http") ? template.imageUrl : "",
  );
  const [sourceMiniatureId, setSourceMiniatureId] = useState("");
  const [schemeIds, setSchemeIds] = useState<string[]>(() => recipe?.schemeIds ?? []);
  const [paintIds, setPaintIds] = useState<string[]>(
    () => recipe?.paints?.map((paint) => paint.paintId) ?? [],
  );
  const [paintSteps, setPaintSteps] = useState<Record<string, string>>(() =>
    Object.fromEntries(recipe?.paints?.map((paint) => [paint.paintId, paint.step]) ?? []),
  );
  const [paintNotes, setPaintNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(recipe?.paints?.map((paint) => [paint.paintId, paint.notes]) ?? []),
  );
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api("/api/miniature-templates", {
        method: template ? "PUT" : "POST",
        body: JSON.stringify({
          id: template?.id,
          name,
          manufacturer,
          faction,
          imageUrl: imageUrl || null,
          sourceMiniatureId: sourceMiniatureId || undefined,
          schemeIds,
          paints: paintIds.map((paintId, sortOrder) => ({
            paintId,
            step: paintSteps[paintId] ?? "OTHER",
            notes: paintNotes[paintId] ?? "",
            sortOrder,
          })),
        }),
      });
      await onSaved();
    } catch {
      /* api reports the error */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={template ? "Edit template" : "New template"}
      subtitle={
        template
          ? "Update this reusable miniature setup."
          : "Start from a miniature or build a reusable setup."
      }
      onClose={onClose}
    >
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
        }}
      >
        {!template && (
          <TextField
            select
            label="Start from miniature"
            value={sourceMiniatureId}
            onChange={(event) => {
              const id = event.target.value;
              setSourceMiniatureId(id);
              const miniature = data.miniatures.find((item) => item.id === id);
              if (miniature) {
                setName(miniature.title);
                setManufacturer(miniature.manufacturer);
                setFaction(miniature.faction);
                setImageUrl(miniature.imageUrl?.startsWith("http") ? miniature.imageUrl : "");
              }
            }}
          >
            <MenuItem value="">From scratch</MenuItem>
            {data.miniatures.map((miniature) => (
              <MenuItem key={miniature.id} value={miniature.id}>
                {miniature.title}
              </MenuItem>
            ))}
          </TextField>
        )}
        <TextField required label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <TextField
          label="Manufacturer"
          value={manufacturer}
          onChange={(event) => setManufacturer(event.target.value)}
        />
        <TextField label="Faction" value={faction} onChange={(event) => setFaction(event.target.value)} />
        <TextField
          label="Image URL"
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          helperText="Optional direct image URL"
        />
        {!sourceMiniatureId && (
          <>
            <Autocomplete
              multiple
              options={data.colorSchemes}
              value={data.colorSchemes.filter((item) => schemeIds.includes(item.id))}
              getOptionLabel={(item) => item.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, items) => setSchemeIds(items.map((item) => item.id))}
              renderInput={(params) => <TextField {...params} label="Schemes" />}
            />
            <Autocomplete
              multiple
              options={data.catalog}
              value={data.catalog.filter((item) => paintIds.includes(item.id))}
              getOptionLabel={(item) => `${item.brand} · ${item.name}`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, items) => setPaintIds(items.map((item) => item.id))}
              renderInput={(params) => <TextField {...params} label="Required paints" />}
            />
            {paintIds.map((paintId) => {
              const paint = data.catalog.find((item) => item.id === paintId);
              return (
                <Box
                  key={paintId}
                  sx={{
                    display: "grid",
                    gap: 1,
                    gridTemplateColumns: { sm: "1fr 130px" },
                  }}
                >
                  <TextField
                    size="small"
                    label={paint?.name ?? paintId}
                    value={paintNotes[paintId] ?? ""}
                    onChange={(event) =>
                      setPaintNotes((notes) => ({ ...notes, [paintId]: event.target.value }))
                    }
                    placeholder="Notes (optional)"
                  />
                  <TextField
                    select
                    size="small"
                    label="Step"
                    value={paintSteps[paintId] ?? "OTHER"}
                    onChange={(event) =>
                      setPaintSteps((steps) => ({ ...steps, [paintId]: event.target.value }))
                    }
                  >
                    {["PRIMER", "BASECOAT", "SHADE", "LAYER", "HIGHLIGHT", "DETAIL", "BASING", "OTHER"].map(
                      (step) => (
                        <MenuItem key={step} value={step}>
                          {step[0] + step.slice(1).toLowerCase()}
                        </MenuItem>
                      ),
                    )}
                  </TextField>
                </Box>
              );
            })}
          </>
        )}
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, pt: 1 }}>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={!name.trim() || busy}>
            Save template
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}
