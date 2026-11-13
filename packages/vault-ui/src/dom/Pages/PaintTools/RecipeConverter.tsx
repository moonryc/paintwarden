import { Autocomplete, Box, Button, Card, Chip, MenuItem, TextField } from "@mui/material";
import {
  COLOR_CATEGORIES,
  COLOR_CATEGORY_LABELS,
  type ColorCategory,
} from "@paint-vault/core/color-categories";
import { paintType, rankOwnedPaintMatches, suggestedOwnedPaint } from "@paint-vault/core/recipe-converter";
import { useMemo, useState } from "react";

import { PaintBottle } from "../../Components/PaintBottle";
import { PaintDetailsButton } from "../../Components/PaintDetailsButton";
import { useVault, useVaultStore } from "../../store/hooks";
import type { ColorScheme, Paint } from "../../types";
import { createClientId } from "../../utils/client-id";
import { convertedSchemeEntries } from "../../utils/converted-scheme-entries";
import { schemeOrderEntries } from "../../utils/scheme-order";
import { truncateSx } from "../../utils/truncate";
import { useFuzzySearch } from "../../utils/use-fuzzy-search";
import { owns } from "../../utils/vault-data";

const schemeSearchText = (scheme: ColorScheme) =>
  `${scheme.name} ${scheme.category ? COLOR_CATEGORY_LABELS[scheme.category] : ""}`;
const paintSearchText = (paint: Paint) => `${paint.name} ${paint.brand} ${paint.range}`;

type ConversionRow = {
  original: Paint;
  owned: boolean;
  matches: ReturnType<typeof rankOwnedPaintMatches<Paint>>;
  suggestedId: string | null;
};

export function RecipeConverter({ onOpenPaint }: { onOpenPaint(id: string): void }) {
  const data = useVault();
  const api = useVaultStore((s) => s.api);
  const notify = useVaultStore((s) => s.notify);
  const [schemeQuery, setSchemeQuery] = useState("");
  const [schemeId, setSchemeId] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ColorCategory | "">("");
  const [saving, setSaving] = useState(false);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const scheme = data.colorSchemes.find((item) => item.id === schemeId) ?? null;
  const schemes = useMemo(
    () =>
      [...data.colorSchemes].sort(
        (left, right) =>
          Number(left.isSystem) - Number(right.isSystem) || left.name.localeCompare(right.name),
      ),
    [data.colorSchemes],
  );
  const schemeMatches = useFuzzySearch(schemes, schemeQuery.trim(), schemeSearchText, 30);
  const entries = useMemo(() => (scheme ? schemeOrderEntries(data, scheme.id) : []), [data, scheme]);
  const catalog = useMemo(() => new Map(data.catalog.map((paint) => [paint.id, paint])), [data.catalog]);
  const ownedPaints = useMemo(
    () => data.catalog.filter((paint) => owns(data.paintRecords[paint.id])),
    [data.catalog, data.paintRecords],
  );
  const rows = useMemo<ConversionRow[]>(() => {
    const ids = [...new Set(entries.filter((entry) => entry.type === "PAINT").map((entry) => entry.paintId))];
    return ids.flatMap((id) => {
      const original = catalog.get(id);
      if (!original) return [];
      const owned = owns(data.paintRecords[id]);
      const matches = owned ? [] : rankOwnedPaintMatches(original, ownedPaints);
      return [{ original, owned, matches, suggestedId: suggestedOwnedPaint(matches)?.paint.id ?? null }];
    });
  }, [entries, catalog, data.paintRecords, ownedPaints]);
  const resolvedChoices = Object.fromEntries(
    rows.map((row) => [
      row.original.id,
      row.owned ? row.original.id : (choices[row.original.id] ?? row.suggestedId ?? row.original.id),
    ]),
  );
  const alreadyOwned = rows.filter((row) => row.owned).length;
  const swapped = rows.filter(
    (row) => !row.owned && resolvedChoices[row.original.id] !== row.original.id,
  ).length;
  const stillMissing = rows.length - alreadyOwned - swapped;
  const signature = JSON.stringify({ schemeId, name: name.trim(), category, choices: resolvedChoices });

  const selectScheme = (next: ColorScheme | null) => {
    setSchemeId(next?.id ?? null);
    setName(next ? `${next.name} · My paints` : "");
    setCategory(next?.category ?? "");
    setChoices({});
    setSavedSignature(null);
  };
  const save = async () => {
    if (!scheme || !name.trim() || !category || !swapped || saving) return;
    setSaving(true);
    try {
      await api("/api/color-schemes", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          category,
          entries: convertedSchemeEntries(entries, resolvedChoices, createClientId),
        }),
      });
      setSavedSignature(signature);
      notify("Converted scheme saved");
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
      <Autocomplete<ColorScheme>
        options={schemeMatches}
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
      {!scheme && (
        <Box sx={{ mt: 3, color: "text.secondary", fontSize: 13 }}>
          Your original scheme stays unchanged. You can review every replacement before saving a copy.
        </Box>
      )}
      {scheme && (
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
                const chosenMatch = row.matches.find((match) => match.paint.id === chosenId);
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
                          ownedPaints={ownedPaints}
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
                disabled={!name.trim() || !category || !swapped || saving || savedSignature === signature}
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
  ownedPaints,
  chosen,
  onChoose,
}: {
  original: Paint;
  ownedPaints: Paint[];
  chosen: Paint;
  onChoose(paintId: string): void;
}) {
  const [query, setQuery] = useState("");
  const candidates = useMemo(() => [original, ...ownedPaints], [original, ownedPaints]);
  const matches = useFuzzySearch(candidates, query.trim(), paintSearchText, 30);
  return (
    <Autocomplete<Paint>
      options={matches}
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
