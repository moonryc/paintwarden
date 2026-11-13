import { Alert, Autocomplete, Button, CircularProgress, MenuItem, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { useEffect, useRef, useState } from "react";

import { Modal } from "../../Components/Modal";
import { usePaintOptions } from "../../graphql/detail-hooks";
import { useMiniatureList } from "../../graphql/miniature-list-hooks";
import { useSchemeOptions } from "../../graphql/miniature-scheme-hooks";
import {
  useTemplateActions,
  useTemplateRecipe,
  useTemplateSourceMiniature,
} from "../../store/template-hooks";
import type { MiniatureTemplate } from "../../types";

type EditorProps = {
  template: MiniatureTemplate | null;
  onSaved: () => Promise<void>;
  onClose: () => void;
};
type EditorRecipe = NonNullable<ReturnType<typeof useTemplateRecipe>["data"]>;
type SchemeChoice = { id: string; name: string };
type PaintChoice = SchemeChoice & { brand: string };

export function TemplateEditorDialog(props: EditorProps) {
  // Switching records must reset the initialization guard, including A -> B -> A.
  return <SelectedTemplateEditor key={props.template?.id ?? "new"} {...props} />;
}

function SelectedTemplateEditor(props: EditorProps) {
  const recipe = useTemplateRecipe(props.template?.id ?? null);
  const [initialRecipe, setInitialRecipe] = useState<EditorRecipe>();
  useEffect(() => {
    if (recipe.data && !recipe.isStale) setInitialRecipe((initial) => initial ?? recipe.data);
  }, [recipe.data, recipe.isStale]);
  // Initialize only from an accepted complete recipe. Background invalidation must
  // never discard an already-open editor's unsaved fields, even on refresh failure.
  if (props.template && !initialRecipe) {
    return (
      <Modal title="Edit template" subtitle="Load this reusable miniature setup." onClose={props.onClose}>
        {recipe.error ? (
          <ReadError error={recipe.error} retry={recipe.refetch} />
        ) : (
          <CircularProgress size={24} aria-label="Loading template recipe" />
        )}
      </Modal>
    );
  }
  return (
    <TemplateEditorFields
      {...props}
      recipe={initialRecipe}
      recipeError={recipe.error}
      retryRecipe={recipe.refetch}
    />
  );
}

function ReadError({ error, retry }: { error: Error; retry: () => unknown }) {
  return (
    <Alert severity="error" action={<Button onClick={() => void retry()}>Retry</Button>}>
      {error.message}
    </Alert>
  );
}

function TemplateEditorFields({
  template,
  onSaved,
  onClose,
  recipe,
  recipeError,
  retryRecipe,
}: EditorProps & { recipe?: EditorRecipe; recipeError: Error | null; retryRecipe: () => unknown }) {
  const actions = useTemplateActions();
  const [name, setName] = useState(() => template?.name ?? "");
  const [manufacturer, setManufacturer] = useState(() => template?.manufacturer ?? "");
  const [faction, setFaction] = useState(() => template?.faction ?? "");
  const [imageUrl, setImageUrl] = useState(() =>
    template?.imageUrl?.startsWith("http") ? template.imageUrl : "",
  );
  const [sourceMiniatureId, setSourceMiniatureId] = useState("");
  const source = useTemplateSourceMiniature(sourceMiniatureId || null);
  const populatedSource = useRef("");
  useEffect(() => {
    if (!sourceMiniatureId || !source.data || source.isStale || populatedSource.current === sourceMiniatureId)
      return;
    const miniature = source.data.miniature;
    if (!miniature) return;
    populatedSource.current = sourceMiniatureId;
    setName(miniature.title);
    setManufacturer(miniature.manufacturer);
    setFaction(miniature.faction);
    setImageUrl(miniature.imageUrl?.startsWith("http") ? miniature.imageUrl : "");
  }, [sourceMiniatureId, source.data, source.isStale]);
  const [selectedSchemes, setSelectedSchemes] = useState<SchemeChoice[]>(() =>
    (recipe?.schemeIds ?? []).map(
      (id) => recipe?.schemeOptions.find((scheme) => scheme.id === id) ?? { id, name: id },
    ),
  );
  const [selectedPaints, setSelectedPaints] = useState<PaintChoice[]>(() =>
    [...(recipe?.paints ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(
        ({ paintId: id }) =>
          recipe?.paintOptions.find((paint) => paint.id === id) ?? { id, name: id, brand: "" },
      ),
  );
  const [paintSteps, setPaintSteps] = useState<Record<string, string>>(() =>
    Object.fromEntries(recipe?.paints?.map((paint) => [paint.paintId, paint.step]) ?? []),
  );
  const [paintNotes, setPaintNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(recipe?.paints?.map((paint) => [paint.paintId, paint.notes]) ?? []),
  );
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const sourceReady =
    !sourceMiniatureId || Boolean(source.data?.miniature && !source.isStale && !source.error);
  const save = async () => {
    if (busy || !name.trim() || !sourceReady) return;
    setBusy(true);
    setSaveError(null);
    try {
      const input = {
        name,
        manufacturer,
        faction,
        imageUrl: imageUrl || null,
        // The server copies the source's authoritative recipe, not this preview.
        sourceMiniatureId: sourceMiniatureId || undefined,
        schemeIds: selectedSchemes.map((scheme) => scheme.id),
        paints: selectedPaints.map(({ id: paintId }, sortOrder) => ({
          paintId,
          step: paintSteps[paintId] ?? "OTHER",
          notes: paintNotes[paintId] ?? "",
          sortOrder,
        })),
      };
      if (template) await actions.update(template.id, input);
      else await actions.create(input);
      await onSaved();
    } catch (error) {
      setSaveError(error instanceof Error ? error : new Error(String(error)));
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
        sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
      >
        {recipeError && <ReadError error={recipeError} retry={retryRecipe} />}
        {!template && (
          <>
            <SourceMiniaturePicker
              onSelect={(id) => {
                populatedSource.current = "";
                setSourceMiniatureId(id);
              }}
            />
            {sourceMiniatureId && (
              <>
                {source.error ? (
                  <ReadError error={source.error} retry={source.refetch} />
                ) : !source.data || source.isStale ? (
                  <CircularProgress size={24} aria-label="Loading source miniature recipe" />
                ) : !source.data.miniature ? (
                  <Alert severity="error">
                    This miniature is no longer available. Choose another miniature.
                  </Alert>
                ) : (
                  <Alert severity="info">
                    Copies {source.data.schemeIds.length} schemes and {source.data.paints.length} paint steps
                    from this miniature when saved.
                  </Alert>
                )}
              </>
            )}
          </>
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
            <TemplateSchemePicker selected={selectedSchemes} onChange={setSelectedSchemes} />
            <TemplatePaintPicker selected={selectedPaints} onChange={setSelectedPaints} />
            {selectedPaints.map((paint) => (
              <Box key={paint.id} sx={{ display: "grid", gap: 1, gridTemplateColumns: { sm: "1fr 130px" } }}>
                <TextField
                  size="small"
                  label={paint.name}
                  value={paintNotes[paint.id] ?? ""}
                  onChange={(event) =>
                    setPaintNotes((notes) => ({ ...notes, [paint.id]: event.target.value }))
                  }
                  placeholder="Notes (optional)"
                />
                <TextField
                  select
                  size="small"
                  label="Step"
                  value={paintSteps[paint.id] ?? "OTHER"}
                  onChange={(event) =>
                    setPaintSteps((steps) => ({ ...steps, [paint.id]: event.target.value }))
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
            ))}
          </>
        )}
        {saveError && (
          <Alert
            severity="error"
            action={
              <Button disabled={busy} onClick={() => void save()}>
                Retry
              </Button>
            }
          >
            {saveError.message}
          </Alert>
        )}
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, pt: 1 }}>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={!name.trim() || busy || !sourceReady}>
            Save template
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

function SourceMiniaturePicker({ onSelect }: { onSelect: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SchemeChoice | null>(null);
  const miniatures = useMiniatureList({
    workbench: false,
    ownership: "ALL",
    stage: "ALL",
    search,
  });
  return (
    <>
      <Autocomplete
        options={miniatures.rows.map(({ mini }) => ({ id: mini.id, name: mini.title }))}
        value={selected}
        loading={miniatures.loading || miniatures.refreshing}
        filterOptions={(options) => options}
        getOptionLabel={(item) => item.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        onInputChange={(_, value, reason) => {
          if (reason === "input" || reason === "clear") setSearch(value);
        }}
        onChange={(_, item) => {
          setSelected(item);
          onSelect(item?.id ?? "");
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Start from miniature"
            helperText="Search miniatures, or leave empty to start from scratch."
          />
        )}
      />
      {selected && (
        <Button
          onClick={() => {
            setSelected(null);
            setSearch("");
            onSelect("");
          }}
        >
          Start from scratch
        </Button>
      )}
      {miniatures.error && <ReadError error={new Error(miniatures.error)} retry={miniatures.retry} />}
      {miniatures.hasNextPage && (
        <Button disabled={miniatures.loading || miniatures.refreshing} onClick={miniatures.loadMore}>
          Load more miniatures
        </Button>
      )}
    </>
  );
}

function TemplateSchemePicker({
  selected,
  onChange,
}: {
  selected: SchemeChoice[];
  onChange: (items: SchemeChoice[]) => void;
}) {
  const [search, setSearch] = useState("");
  const schemes = useSchemeOptions(search);
  return (
    <>
      <Autocomplete
        multiple
        filterSelectedOptions
        options={schemes.items}
        value={selected}
        loading={schemes.loading}
        filterOptions={(options) => options}
        getOptionLabel={(item) => item.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        onInputChange={(_, value, reason) => {
          if (reason === "input" || reason === "clear") setSearch(value);
        }}
        onChange={(_, items) => onChange(items)}
        renderInput={(params) => <TextField {...params} label="Schemes" />}
      />
      {schemes.error && <ReadError error={schemes.error} retry={schemes.refetch} />}
      {schemes.hasNextPage && (
        <Button disabled={schemes.loading} onClick={schemes.loadMore}>
          Load more schemes
        </Button>
      )}
    </>
  );
}

function TemplatePaintPicker(props: { selected: PaintChoice[]; onChange: (items: PaintChoice[]) => void }) {
  const [attempt, setAttempt] = useState(0);
  // Paint options have no refetch command. Remount only this bounded query on
  // retry; retained selections, recipe steps and notes belong to the editor.
  return <TemplatePaintOptions key={attempt} {...props} retry={() => setAttempt((old) => old + 1)} />;
}

function TemplatePaintOptions({
  selected,
  onChange,
  retry,
}: {
  selected: PaintChoice[];
  onChange: (items: PaintChoice[]) => void;
  retry: () => void;
}) {
  const [search, setSearch] = useState("");
  const paints = usePaintOptions(
    search,
    selected.map((paint) => paint.id),
  );
  return (
    <>
      <Autocomplete
        multiple
        filterSelectedOptions
        options={paints.items}
        value={selected}
        loading={paints.loading}
        filterOptions={(options) => options}
        getOptionLabel={(item) => (item.brand ? `${item.brand} · ${item.name}` : item.name)}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        onInputChange={(_, value, reason) => {
          if (reason === "input" || reason === "clear") setSearch(value);
        }}
        onChange={(_, items) => onChange(items)}
        renderInput={(params) => (
          <TextField {...params} label="Required paints" helperText="Search paint, brand, or range." />
        )}
      />
      {paints.error && <ReadError error={paints.error} retry={retry} />}
    </>
  );
}
