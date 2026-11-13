import { Autocomplete, Box, Card, Divider, TextField } from "@mui/material";
import { rankPaintsByColor } from "@paint-vault/core/paint-color-similarity";
import { useMemo, useState } from "react";

import { PaintBottle } from "../../Components/PaintBottle";
import { PaintDetailsButton } from "../../Components/PaintDetailsButton";
import { PaintSimilarityList } from "../../Components/PaintSimilarityList";
import { ArrowLeftRight } from "../../icons";
import { useVault } from "../../store/hooks";
import type { Paint } from "../../types";
import { useFuzzySearch } from "../../utils/use-fuzzy-search";

const paintSearchText = (paint: Paint) => `${paint.brand} ${paint.range} ${paint.name}`;

export function PaintComparison({ onOpenPaint }: { onOpenPaint(id: string): void }) {
  const data = useVault();
  const [selectedPaintId, setSelectedPaintId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const matches = useFuzzySearch(data.catalog, query.trim(), paintSearchText, 30);
  const selectedPaint = data.catalog.find((paint) => paint.id === selectedPaintId) ?? null;
  const ranked = useMemo(
    () => (selectedPaint ? rankPaintsByColor(selectedPaint, data.catalog) : null),
    [selectedPaint, data.catalog],
  );

  return (
    <Card sx={{ p: { xs: 2, sm: 4 } }}>
      <Autocomplete<Paint>
        options={matches}
        inputValue={query}
        onInputChange={(_, value) => setQuery(value)}
        value={selectedPaint}
        onChange={(_, paint) => setSelectedPaintId(paint?.id ?? null)}
        getOptionLabel={(paint) => paint.name}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        filterOptions={(options) => options}
        renderInput={(params) => (
          <TextField {...params} label="Paint" placeholder="Search paint, brand, or range…" />
        )}
        renderOption={(props, paint) => {
          const { key, ...optionProps } = props;
          return (
            <Box component="li" key={key} {...optionProps} sx={{ display: "flex", gap: 1.5 }}>
              <PaintBottle paint={paint} size="sm" />
              <Box component="span" sx={{ minWidth: 0 }}>
                <Box component="span" sx={{ display: "block", fontWeight: 700 }}>
                  {paint.name}
                </Box>
                <Box component="span" sx={{ display: "block", color: "text.secondary", fontSize: 12 }}>
                  {paint.brand} · {paint.range}
                </Box>
              </Box>
            </Box>
          );
        }}
        fullWidth
      />
      {!selectedPaint && (
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1.5,
            mt: 2.5,
            p: 2,
            borderRadius: 2,
            bgcolor: "var(--sunken)",
            color: "var(--ink-faint)",
            fontSize: 14,
          }}
        >
          <ArrowLeftRight size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            Choose a paint to rank the closest colors across every brand in the catalog. Use it to find a
            match from a range you already own or to replace a discontinued bottle.
          </span>
        </Box>
      )}
      {selectedPaint && (
        <>
          <PaintDetailsButton
            onClick={() => onOpenPaint(selectedPaint.id)}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              textAlign: "left",
              gap: 1.5,
              width: "100%",
              mt: 3,
              borderRadius: 1,
              "&:hover": { bgcolor: "action.hover" },
              "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
            }}
          >
            <PaintBottle paint={selectedPaint} />
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ fontWeight: 700 }}>{selectedPaint.name}</Box>
              <Box sx={{ color: "text.secondary", fontSize: 13 }}>
                {selectedPaint.brand} · {selectedPaint.range}
              </Box>
            </Box>
          </PaintDetailsButton>
          <Divider sx={{ mt: 2.5 }} />
          {ranked ? (
            <PaintSimilarityList key={selectedPaint.id} ranked={ranked} />
          ) : (
            <Box sx={{ mt: 2.5, color: "text.secondary", fontSize: 13 }}>
              Add a valid hex color to this paint to compare it with the catalog.
            </Box>
          )}
        </>
      )}
    </Card>
  );
}
