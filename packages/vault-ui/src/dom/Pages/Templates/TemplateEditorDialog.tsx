import { StableAutocomplete } from "../../Components/StableAutocomplete";
import { Alert, Button, CircularProgress, MenuItem, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Modal } from "../../Components/Modal";
import { usePaintOptions } from "../../graphql/detail-hooks";
import { useMiniatureList } from "../../graphql/miniature-list-hooks";
import { useSchemeOptions } from "../../graphql/miniature-scheme-hooks";
import {
  useTemplateActions,
  useTemplateCatalog,
  useTemplateRecipe,
  useTemplateSourceMiniature,
} from "../../store/template-hooks";
import type { MiniatureTemplate } from "../../types";

type EditorProps = {
  template: MiniatureTemplate | null;
  folderId?: string | null;
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
  const { t } = useTranslation("pages");
  const recipe = useTemplateRecipe(props.template?.id ?? null);
  // A clicked card may still be from the previous accepted list window. Never
  // initialize editable metadata from those stale props after a successful save.
  const summary = useTemplateCatalog(Boolean(props.template), { id: props.template?.id });
  const [initial, setInitial] = useState<{ recipe: EditorRecipe; template: MiniatureTemplate }>();
  const currentTemplate = summary.data?.templates[0];
  const { data: recipeData, isStale: recipeStale, refetch: refetchRecipe } = recipe;
  const { revision: summaryRevision, isStale: summaryStale, refetch: refetchSummary } = summary;
  useEffect(() => {
    if (initial || !recipeData || recipeStale || !currentTemplate || summaryStale || !summaryRevision) return;
    const a = recipeData.revision;
    const b = summaryRevision;
    if (a.epoch !== b.epoch || a.seq !== b.seq) {
      // The two small reads must describe one accepted revision before fields
      // mount. Background refreshes never reinitialize a mounted draft.
      if (a.epoch === b.epoch && BigInt(a.seq) < BigInt(b.seq)) refetchRecipe();
      else refetchSummary();
      return;
    }
    setInitial({ recipe: recipeData, template: currentTemplate });
  }, [
    initial,
    recipeData,
    recipeStale,
    refetchRecipe,
    currentTemplate,
    summaryStale,
    summaryRevision,
    refetchSummary,
  ]);
  const readError = recipe.error ?? summary.error;
  const retry = () => {
    recipe.refetch();
    summary.refetch();
  };
  if (props.template && !initial) {
    return (
      <Modal title={t("templatesEditTemplate")} subtitle={t("templatesLoadSetup")} onClose={props.onClose}>
        {readError ? (
          <ReadError error={readError} retry={retry} />
        ) : summary.data && !currentTemplate && !summary.loading ? (
          <Alert severity="error">{t("templatesUnavailable")}</Alert>
        ) : (
          <CircularProgress size={24} aria-label={t("templatesLoadingRecipe")} />
        )}
      </Modal>
    );
  }
  return (
    <TemplateEditorFields
      {...props}
      template={initial?.template ?? props.template}
      recipe={initial?.recipe}
      recipeError={readError}
      retryRecipe={retry}
    />
  );
}

function ReadError({ error, retry }: { error: Error; retry: () => unknown }) {
  const { t } = useTranslation("pages");
  return (
    <Alert severity="error" action={<Button onClick={() => void retry()}>{t("templatesRetry")}</Button>}>
      {error.message}
    </Alert>
  );
}

function TemplateEditorFields({
  template,
  folderId,
  onSaved,
  onClose,
  recipe,
  recipeError,
  retryRecipe,
}: EditorProps & { recipe?: EditorRecipe; recipeError: Error | null; retryRecipe: () => unknown }) {
  const { t, i18n } = useTranslation("pages");
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
    if (
      !sourceMiniatureId ||
      !source.data ||
      source.isStale ||
      source.error ||
      populatedSource.current === sourceMiniatureId
    )
      return;
    const miniature = source.data.miniature;
    if (!miniature || miniature.id !== sourceMiniatureId) return;
    populatedSource.current = sourceMiniatureId;
    setName(miniature.title);
    setManufacturer(miniature.manufacturer);
    setFaction(miniature.faction);
    setImageUrl(miniature.imageUrl?.startsWith("http") ? miniature.imageUrl : "");
  }, [sourceMiniatureId, source.data, source.isStale, source.error]);
  const [selectedSchemes, setSelectedSchemes] = useState<SchemeChoice[]>(() =>
    (recipe?.schemeIds ?? []).map(
      (id) => recipe?.schemeOptions.find((scheme) => scheme.id === id) ?? { id, name: id },
    ),
  );
  const [selectedPaints, setSelectedPaints] = useState<PaintChoice[]>(() => [
    ...new Map(
      (recipe?.paints ?? []).map(({ paintId: id }) => [
        id,
        recipe?.paintOptions.find((paint) => paint.id === id) ?? { id, name: id, brand: "" },
      ]),
    ).values(),
  ]);
  // Row identity is not paint identity: the same paint may occur in different
  // steps, with separate notes and order. A picker controls membership only.
  const [paintEntries, setPaintEntries] = useState<Array<{ paintId: string; step: string; notes: string }>>(
    () =>
      [...(recipe?.paints ?? [])]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(({ paintId, step, notes }) => ({ paintId, step, notes })),
  );
  const choosePaints = (items: PaintChoice[]) => {
    setSelectedPaints(items);
    setPaintEntries((previous) => [
      ...previous.filter((entry) => items.some((paint) => paint.id === entry.paintId)),
      ...items
        .filter((paint) => !previous.some((entry) => entry.paintId === paint.id))
        .map((paint) => ({ paintId: paint.id, step: "OTHER", notes: "" })),
    ]);
  };
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
        paints: paintEntries.map((entry, sortOrder) => ({ ...entry, sortOrder })),
      };
      if (template) await actions.update(template.id, input);
      else await actions.create({ ...input, folderId });
      await onSaved();
    } catch (error) {
      setSaveError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={template ? t("templatesEditTemplate") : t("templatesNewTemplate")}
      subtitle={template ? t("templatesUpdateSetup") : t("templatesStartSetup")}
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
                  <CircularProgress size={24} aria-label={t("templatesLoadingSourceRecipe")} />
                ) : !source.data.miniature ? (
                  <Alert severity="error">{t("templatesSourceUnavailable")}</Alert>
                ) : (
                  <Alert severity="info">
                    {t("templatesCopyRecipe", {
                      schemes: t("templatesSchemeCount", {
                        count: source.data.schemeIds.length,
                        formattedCount: new Intl.NumberFormat(i18n.language).format(
                          source.data.schemeIds.length,
                        ),
                      }),
                      paints: t("templatesPaintStepCount", { count: source.data.paints.length }),
                    })}
                  </Alert>
                )}
              </>
            )}
          </>
        )}
        <TextField
          required
          label={t("templatesName")}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label={t("templatesManufacturer")}
          value={manufacturer}
          onChange={(event) => setManufacturer(event.target.value)}
        />
        <TextField
          label={t("templatesFaction")}
          value={faction}
          onChange={(event) => setFaction(event.target.value)}
        />
        <TextField
          label={t("templatesImageUrl")}
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          helperText={t("templatesImageUrlHelp")}
        />
        {!sourceMiniatureId && (
          <>
            <TemplateSchemePicker selected={selectedSchemes} onChange={setSelectedSchemes} />
            <TemplatePaintPicker selected={selectedPaints} onChange={choosePaints} />
            {paintEntries.map((entry, index) => (
              <Box
                key={`${entry.paintId}:${index}`}
                sx={{ display: "grid", gap: 1, gridTemplateColumns: { sm: "minmax(0, 1fr) 14rem" } }}
              >
                <TextField
                  size="small"
                  label={selectedPaints.find((paint) => paint.id === entry.paintId)?.name ?? entry.paintId}
                  value={entry.notes}
                  onChange={(event) =>
                    setPaintEntries((entries) =>
                      entries.map((row, i) => (i === index ? { ...row, notes: event.target.value } : row)),
                    )
                  }
                  placeholder={t("templatesNotesPlaceholder")}
                />
                <TextField
                  select
                  size="small"
                  label={t("templatesStep")}
                  value={entry.step}
                  onChange={(event) =>
                    setPaintEntries((entries) =>
                      entries.map((row, i) => (i === index ? { ...row, step: event.target.value } : row)),
                    )
                  }
                >
                  {["PRIMER", "BASECOAT", "SHADE", "LAYER", "HIGHLIGHT", "DETAIL", "BASING", "OTHER"].map(
                    (step) => (
                      <MenuItem
                        key={step}
                        value={step}
                        disabled={paintEntries.some(
                          (row, i) => i !== index && row.paintId === entry.paintId && row.step === step,
                        )}
                      >
                        {t(
                          (
                            {
                              PRIMER: "templatesStepPrimer",
                              BASECOAT: "templatesStepBasecoat",
                              SHADE: "templatesStepShade",
                              LAYER: "templatesStepLayer",
                              HIGHLIGHT: "templatesStepHighlight",
                              DETAIL: "templatesStepDetail",
                              BASING: "templatesStepBasing",
                              OTHER: "templatesStepOther",
                            } as const
                          )[
                            step as
                              | "PRIMER"
                              | "BASECOAT"
                              | "SHADE"
                              | "LAYER"
                              | "HIGHLIGHT"
                              | "DETAIL"
                              | "BASING"
                              | "OTHER"
                          ],
                        )}
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
                {t("templatesRetry")}
              </Button>
            }
          >
            {saveError.message}
          </Alert>
        )}
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, pt: 1 }}>
          <Button type="button" onClick={onClose}>
            {t("templatesCancel")}
          </Button>
          <Button type="submit" variant="contained" disabled={!name.trim() || busy || !sourceReady}>
            {t("templatesSaveTemplate")}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

function SourceMiniaturePicker({ onSelect }: { onSelect: (id: string) => void }) {
  const { t } = useTranslation("pages");
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
      <StableAutocomplete
        noOptionsText={t("templatesNoOptions")}
        loadingText={t("templatesLoadingOptions")}
        clearText={t("templatesClear")}
        openText={t("templatesOpen")}
        closeText={t("templatesClose")}
        options={miniatures.rows.map(({ mini }) => ({ id: mini.id, name: mini.title }))}
        hasNextPage={miniatures.hasNextPage}
        onLoadMore={miniatures.loadMore}
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
            label={t("templatesStartFromMiniature")}
            helperText={t("templatesStartFromMiniatureHelp")}
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
          {t("templatesStartFromScratch")}
        </Button>
      )}
      {miniatures.error && <ReadError error={new Error(miniatures.error)} retry={miniatures.retry} />}
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
  const { t } = useTranslation("pages");
  const [search, setSearch] = useState("");
  const schemes = useSchemeOptions(search);
  return (
    <>
      <StableAutocomplete
        noOptionsText={t("templatesNoOptions")}
        loadingText={t("templatesLoadingOptions")}
        clearText={t("templatesClear")}
        openText={t("templatesOpen")}
        closeText={t("templatesClose")}
        multiple
        filterSelectedOptions
        options={schemes.items}
        hasNextPage={schemes.hasNextPage}
        onLoadMore={schemes.loadMore}
        value={selected}
        loading={schemes.loading}
        filterOptions={(options) => options}
        getOptionLabel={(item) => item.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        onInputChange={(_, value, reason) => {
          if (reason === "input" || reason === "clear") setSearch(value);
        }}
        onChange={(_, items) => onChange(items)}
        renderInput={(params) => <TextField {...params} label={t("templatesSchemes")} />}
      />
      {schemes.error && <ReadError error={schemes.error} retry={schemes.refetch} />}
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
  const { t } = useTranslation("pages");
  const [search, setSearch] = useState("");
  const paints = usePaintOptions(
    search,
    selected.map((paint) => paint.id),
  );
  return (
    <>
      <StableAutocomplete
        noOptionsText={t("templatesNoOptions")}
        loadingText={t("templatesLoadingOptions")}
        clearText={t("templatesClear")}
        openText={t("templatesOpen")}
        closeText={t("templatesClose")}
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
          <TextField
            {...params}
            label={t("templatesRequiredPaints")}
            helperText={t("templatesSearchPaintHelp")}
          />
        )}
      />
      {paints.error && <ReadError error={paints.error} retry={retry} />}
    </>
  );
}
