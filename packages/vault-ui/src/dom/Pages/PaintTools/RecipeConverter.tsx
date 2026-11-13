import { Alert, Autocomplete, Box, Button, Card, Chip, MenuItem, TextField } from "@mui/material";
import {
  COLOR_CATEGORIES,
  COLOR_CATEGORY_LABELS,
  type ColorCategory,
} from "@paint-vault/core/color-categories";
import { paintType, rankOwnedPaintMatches } from "@paint-vault/core/recipe-converter";
import { useEffect, useMemo, useState } from "react";

import { PaintBottle } from "../../Components/PaintBottle";
import { PaintDetailsButton } from "../../Components/PaintDetailsButton";
import { useMiniatureScheme, useSchemeOptions } from "../../graphql/miniature-scheme-hooks";
import {
  paintModel,
  schemeEntryModels,
  schemeSummaryModel,
  type SchemeSummaryModel,
} from "../../graphql/miniature-scheme-model";
import { useOwnedPaintOptions, usePaintConversion } from "../../graphql/paint-tools-hooks";
import { paintConversionModel, resolveConversionChoices } from "../../graphql/paint-tools-model";
import { useSchemeActions } from "../../graphql/scheme-actions";
import { useVaultStore } from "../../store/hooks";
import type { Paint } from "../../types";
import { createClientId } from "../../utils/client-id";
import { convertedSchemeEntries } from "../../utils/converted-scheme-entries";
import { truncateSx } from "../../utils/truncate";

export function RecipeConverter({ onOpenPaint }: { onOpenPaint(id: string): void }) {
  const actions = useSchemeActions();
  const notify = useVaultStore((s) => s.notify);
  const [schemeQuery, setSchemeQuery] = useState("");
  const [selectedScheme, setSelectedScheme] = useState<SchemeSummaryModel | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ColorCategory | "">("");
  const [saving, setSaving] = useState(false);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const schemeOptions = useSchemeOptions(schemeQuery.trim());
  const detail = useMiniatureScheme(selectedScheme?.id ?? "");
  const scheme = selectedScheme;
  const schemeMatches = schemeOptions.items.map(schemeSummaryModel);
  const entries = useMemo(
    () => (detail.data && scheme ? schemeEntryModels(detail.data.entries.nodes).entries : []),
    [detail.data, scheme],
  );
  const paintIds = entries.flatMap((entry) => (entry.type === "PAINT" ? [entry.paintId] : []));
  const conversion = usePaintConversion(paintIds, Object.values(choices));
  const model = useMemo(() => paintConversionModel(conversion.data), [conversion.data]);
  const rows = model.rows;
  const catalog = model.paints;
  const resolvedChoices = resolveConversionChoices(model, choices);
  const revisionsMatch =
    !detail.data ||
    !conversion.data ||
    (detail.data.revision.epoch === conversion.data.revision.epoch &&
      detail.data.revision.seq === conversion.data.revision.seq);
  const loading = detail.loading || conversion.loading || !revisionsMatch;
  const { loading: detailLoading, refetch: refreshDetail } = detail;
  const { loading: conversionLoading, refetch: refreshConversion } = conversion;
  useEffect(() => {
    if (!revisionsMatch && !detailLoading && !conversionLoading) {
      refreshDetail();
      refreshConversion();
    }
  }, [revisionsMatch, detailLoading, conversionLoading, refreshDetail, refreshConversion]);
  const error = detail.error ?? conversion.error;
  const alreadyOwned = rows.filter((row) => row.owned).length;
  const swapped = rows.filter(
    (row) => !row.owned && resolvedChoices[row.original.id] !== row.original.id,
  ).length;
  const stillMissing = rows.length - alreadyOwned - swapped;
  const signature = JSON.stringify({
    schemeId: scheme?.id,
    name: name.trim(),
    category,
    choices: resolvedChoices,
  });

  const selectScheme = (next: SchemeSummaryModel | null) => {
    setSelectedScheme(next);
    setName(next ? `${next.name} · My paints` : "");
    setCategory(next?.category ?? "");
    setChoices({});
    setSavedSignature(null);
  };
  const save = async () => {
    if (!scheme || !name.trim() || !category || !swapped || saving || loading || error) return;
    setSaving(true);
    try {
      await actions.create({
        name: name.trim(),
        category,
        entries: convertedSchemeEntries(entries, resolvedChoices, createClientId),
      });
      setSavedSignature(signature);
      notify("Converted scheme saved");
    } catch {
      // Scoped actions report command failures and leave the draft retryable.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card sx={{ p: { xs: 2, sm: 4 } }}>
      <Box sx={{ fontWeight: 700, fontSize: 18, mb: 0.5 }}>Recipe converter</Box>
      <Box sx={{ color: "text.secondary", fontSize: 13, mb: 3 }}>
        Choose a scheme to make a new version using paints you have on hand.
      </Box>
      <Autocomplete<SchemeSummaryModel>
        options={schemeMatches}
        loading={schemeOptions.loading}
        inputValue={schemeQuery}
        onInputChange={(_, value) => setSchemeQuery(value)}
        value={scheme}
        onChange={(_, next) => selectScheme(next)}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        filterOptions={(options) => options}
        renderInput={(params) => <TextField {...params} label="Source scheme" placeholder="Find a scheme…" />}
        fullWidth
      />
      {schemeOptions.error && (
        <Alert
          severity="error"
          sx={{ mt: 2 }}
          action={<Button onClick={schemeOptions.refetch}>Retry</Button>}
        >
          {schemeOptions.error.message}
        </Alert>
      )}
      {schemeOptions.hasNextPage && (
        <Button onClick={schemeOptions.loadMore} disabled={schemeOptions.loading}>
          Load more schemes
        </Button>
      )}
      {!scheme && (
        <Box sx={{ mt: 3, color: "text.secondary", fontSize: 13 }}>
          Your original scheme stays unchanged. You can review every replacement before saving a copy.
        </Box>
      )}
      {scheme && loading && (
        <Box role="status" sx={{ mt: 2 }}>
          Loading scheme conversions…
        </Box>
      )}
      {scheme && error && (
        <Alert
          severity="error"
          sx={{ mt: 2 }}
          action={
            <Button
              onClick={() => {
                detail.refetch();
                conversion.refetch();
              }}
            >
              Retry
            </Button>
          }
        >
          {error.message}
        </Alert>
      )}
      {scheme && !loading && !error && !detail.data?.scheme && (
        <Alert severity="info" sx={{ mt: 2 }}>
          This scheme is no longer available.
        </Alert>
      )}
      {scheme && detail.data?.scheme && conversion.data && (
        <>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 3, mb: 1.5 }}>
            <Chip size="small" color="success" variant="outlined" label={`${alreadyOwned} already owned`} />
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={`${swapped} replacements`}
              sx={{ color: "var(--brand-text)" }}
            />
            <Chip
              size="small"
              color={stillMissing ? "warning" : "success"}
              variant="outlined"
              label={`${stillMissing} still missing`}
            />
          </Box>
          <Box sx={{ color: "text.secondary", fontSize: 12, mb: 2.5 }}>
            Matches compare catalog screen colors. Paint type is inferred from the range name; check finish,
            coverage, and primer before using a replacement.
          </Box>
          {rows.length ? (
            <Box
              role="list"
              aria-label="Scheme paint conversions"
              sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}
            >
              {rows.map((row, index) => {
                const chosenId = resolvedChoices[row.original.id];
                const chosen = catalog.get(chosenId) ?? row.original;
                const chosenMatch =
                  row.matches.find((match) => match.paint.id === chosenId) ??
                  rankOwnedPaintMatches(row.original, [chosen])[0];
                return (
                  <Box
                    key={row.original.id}
                    role="listitem"
                    sx={{ p: { xs: 1.5, sm: 2 }, borderTop: index ? "1px solid" : 0, borderColor: "divider" }}
                  >
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "minmax(0,1fr) minmax(0,1fr)" },
                        gap: { xs: 1.5, md: 3 },
                        alignItems: "center",
                      }}
                    >
                      <PaintDetailsButton
                        onClick={() => onOpenPaint(row.original.id)}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          gap: 1.5,
                          minWidth: 0,
                          textAlign: "left",
                          borderRadius: 1,
                          "&:hover": { bgcolor: "action.hover" },
                        }}
                      >
                        <PaintBottle paint={row.original} size="sm" />
                        <Box sx={{ minWidth: 0 }}>
                          <Box
                            sx={{
                              fontWeight: 700,
                              fontSize: 14,
                              ...truncateSx,
                            }}
                          >
                            {row.original.name}
                          </Box>
                          <Box
                            sx={{
                              color: "text.secondary",
                              fontSize: 12,
                              ...truncateSx,
                            }}
                          >
                            {row.original.brand} · {row.original.range}
                          </Box>
                        </Box>
                      </PaintDetailsButton>
                      {row.owned ? (
                        <Box sx={{ color: "success.main", fontWeight: 700, fontSize: 13 }}>
                          On hand · keep original
                        </Box>
                      ) : (
                        <ConversionPaintPicker
                          original={row.original}
                          chosen={chosen}
                          onChoose={(paintId) =>
                            setChoices((current) => ({ ...current, [row.original.id]: paintId }))
                          }
                        />
                      )}
                    </Box>
                    {!row.owned && (
                      <Box
                        sx={{
                          color: chosenId === row.original.id ? "warning.main" : "text.secondary",
                          fontSize: 12,
                          mt: 1,
                          ml: { xs: 0, md: "calc(50% + 12px)" },
                        }}
                      >
                        {chosenId === row.original.id
                          ? "Original paint remains in the copy."
                          : chosenMatch
                            ? `${chosenMatch.match.score}% screen-color match · ${chosenMatch.sameType ? "same range type" : `different type (${paintType(chosen.range)})`}`
                            : "No catalog color available to score this choice."}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Box sx={{ color: "text.secondary", py: 3 }}>This scheme has no available paints to convert.</Box>
          )}
          {rows.length > 0 && (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "minmax(0,1fr) 180px" },
                gap: 1.5,
                mt: 3,
              }}
            >
              <TextField
                label="New scheme name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                fullWidth
              />
              <TextField
                select
                label="Category"
                value={category}
                onChange={(event) => setCategory(event.target.value as ColorCategory)}
                fullWidth
              >
                {COLOR_CATEGORIES.map((item) => (
                  <MenuItem key={item} value={item}>
                    {COLOR_CATEGORY_LABELS[item]}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          )}
          {rows.length > 0 && (
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1.5,
                mt: 2,
              }}
            >
              <Box sx={{ color: "text.secondary", fontSize: 12 }}>
                {swapped
                  ? "Saving creates a new reusable scheme. The source is unchanged."
                  : "Choose at least one replacement to save a converted scheme."}
              </Box>
              <Button
                variant="contained"
                disabled={
                  !name.trim() ||
                  !category ||
                  !swapped ||
                  saving ||
                  loading ||
                  !!error ||
                  savedSignature === signature
                }
                onClick={() => void save()}
              >
                {saving ? "Saving…" : savedSignature === signature ? "Saved" : "Save converted scheme"}
              </Button>
            </Box>
          )}
        </>
      )}
    </Card>
  );
}

function ConversionPaintPicker({
  original,
  chosen,
  onChoose,
}: {
  original: Paint;
  chosen: Paint;
  onChoose(paintId: string): void;
}) {
  const [query, setQuery] = useState("");
  const options = useOwnedPaintOptions(query.trim());
  const matches = [original, ...options.items.map(paintModel).filter((paint) => paint.id !== original.id)];
  return (
    <Autocomplete<Paint>
      options={matches}
      loading={options.loading}
      noOptionsText={options.error ? options.error.message : "No owned paints match"}
      inputValue={query}
      onInputChange={(_, value) => setQuery(value)}
      value={chosen}
      onChange={(_, paint) => onChoose(paint?.id ?? original.id)}
      getOptionLabel={(paint) => `${paint.name} · ${paint.brand} · ${paint.range}`}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      filterOptions={(options) => options}
      renderInput={(params) => <TextField {...params} size="small" label="Use paint" />}
      renderOption={(props, paint) => {
        const { key, ...optionProps } = props;
        return (
          <Box component="li" key={key} {...optionProps} sx={{ display: "flex", gap: 1 }}>
            <PaintBottle paint={paint} size="sm" />
            <Box component="span" sx={{ minWidth: 0 }}>
              <Box component="span" sx={{ display: "block", fontWeight: 700 }}>
                {paint.name}
              </Box>
              <Box component="span" sx={{ display: "block", color: "text.secondary", fontSize: 12 }}>
                {paint.brand} · {paint.range}
                {paint.id === original.id ? " · Keep original" : ""}
              </Box>
            </Box>
          </Box>
        );
      }}
      fullWidth
    />
  );
}
