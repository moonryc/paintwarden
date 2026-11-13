import { Alert, Autocomplete, Box, Button, Card, Divider, TextField } from "@mui/material";
import { rankPaintsByColor } from "@paint-vault/core/paint-color-similarity";
import { useState } from "react";

import { PaintBottle } from "../../Components/PaintBottle";
import { PaintDetailsButton } from "../../Components/PaintDetailsButton";
import { PaintSimilarityList } from "../../Components/PaintSimilarityList";
import { usePaintOptions } from "../../graphql/detail-hooks";
import { paintModel } from "../../graphql/miniature-scheme-model";
import { usePaintRanking } from "../../graphql/paint-tools-hooks";
import { ArrowLeftRight } from "../../icons";
import type { Paint } from "../../types";

export function PaintComparison({ onOpenPaint }: { onOpenPaint(id: string): void }) {
  const [selectedPaint, setSelectedPaint] = useState<Paint | null>(null);
  const [query, setQuery] = useState("");
  const options = usePaintOptions(query.trim(), []);
  const matches = options.items.map(paintModel);

  return (
    <Card sx={{ p: { xs: 2, sm: 4 } }}>
      <Autocomplete<Paint>
        options={matches}
        inputValue={query}
        onInputChange={(_, value) => setQuery(value)}
        value={selectedPaint}
        onChange={(_, paint) => setSelectedPaint(paint)}
        loading={options.loading}
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
      {options.error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {options.error.message}
        </Alert>
      )}
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
      {selectedPaint && <SelectedComparison id={selectedPaint.id} onOpenPaint={onOpenPaint} />}
    </Card>
  );
}

function SelectedComparison({ id, onOpenPaint }: { id: string; onOpenPaint(id: string): void }) {
  const result = usePaintRanking(id);
  const selectedPaint = result.data?.paint ? paintModel(result.data.paint) : null;
  const ranked = result.data?.nodes.map((row) => ({ ...row, paint: paintModel(row.paint) })) ?? [];
  const validColor = selectedPaint ? rankPaintsByColor(selectedPaint, []) !== null : false;
  return (
    <>
      {result.loading && (
        <Box role="status" sx={{ mt: 2 }}>
          Loading color matches…
        </Box>
      )}
      {result.error && (
        <Alert severity="error" sx={{ mt: 2 }} action={<Button onClick={result.refetch}>Retry</Button>}>
          {result.error.message}
        </Alert>
      )}
      {!result.loading && !result.error && !selectedPaint && (
        <Alert severity="info" sx={{ mt: 2 }}>
          This paint is no longer in the catalog.
        </Alert>
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
          {validColor ? (
            <>
              <PaintSimilarityList key={selectedPaint.id} ranked={ranked} />
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1.5 }}>
                <Box sx={{ color: "text.secondary", fontSize: 12 }}>
                  {ranked.length} of {result.data?.totalCount ?? 0} matches
                </Box>
                {result.data?.pageInfo.hasNextPage && (
                  <Button disabled={result.loading} onClick={result.loadMore}>
                    Load more matches
                  </Button>
                )}
              </Box>
            </>
          ) : (
            <Box sx={{ mt: 2.5, color: "text.secondary", fontSize: 13 }}>
              Add a valid hex color to this paint to compare it with the catalog.
            </Box>
          )}
        </>
      )}
    </>
  );
}
