import { Autocomplete, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { useMemo } from "react";

import { usePaintOptions } from "../graphql/detail-hooks";
import { useVaultGraphQL } from "../graphql/provider";
import { truncateSx } from "../utils/truncate";
import { useFuzzySearch } from "../utils/use-fuzzy-search";

import { PaintBottle } from "./PaintBottle";

export type PaintOption = {
  id: string;
  brand: string;
  range: string;
  name: string;
  colorHex: string | null;
};

const paintSearchText = (paint: PaintOption) => `${paint.brand} ${paint.range} ${paint.name}`;

type PickerProps<T extends PaintOption> = {
  paints: T[];
  excludedIds: string[];
  query: string;
  onQueryChange: (value: string) => void;
  onChoose: (paint: T) => void;
};

export function PaintAutocomplete<T extends PaintOption>(props: PickerProps<T>) {
  const graphql = useVaultGraphQL();
  return graphql ? <ApolloPaintAutocomplete {...props} /> : <LegacyPaintAutocomplete {...props} />;
}

function ApolloPaintAutocomplete<T extends PaintOption>(props: PickerProps<T>) {
  const { items, loading, error } = usePaintOptions(props.query, props.excludedIds);
  // Server projections contain the complete picker paint, not caller snapshot pages.
  // PaintOption's generic only preserves callers' paint shape on the legacy path.
  const options = items.map((paint) => ({
    ...paint,
    sourceName: paint.sourceName ?? undefined,
  })) as unknown as T[];
  return <PaintAutocompleteView {...props} matches={options} loading={loading} error={error} />;
}

function LegacyPaintAutocomplete<T extends PaintOption>(props: PickerProps<T>) {
  const { paints, excludedIds, query } = props;
  // Callers may derive the exclusions inline; use their contents, not the array identity.
  const excludedKey = JSON.stringify(excludedIds);
  const candidates = useMemo(() => {
    const excluded = new Set<string>(JSON.parse(excludedKey) as string[]);
    return paints.filter((paint) => !excluded.has(paint.id));
  }, [paints, excludedKey]);
  const matches = useFuzzySearch(candidates, query.trim(), paintSearchText, 30);
  return <PaintAutocompleteView {...props} matches={matches} />;
}

function PaintAutocompleteView<T extends PaintOption>({
  matches,
  query,
  onQueryChange,
  onChoose,
  loading,
  error,
}: PickerProps<T> & { matches: T[]; loading?: boolean; error?: Error | null }) {
  return (
    <Autocomplete
      fullWidth
      size="small"
      openOnFocus
      autoHighlight
      value={null}
      inputValue={query}
      options={matches}
      filterOptions={(options) => options}
      getOptionLabel={(paint) => paint.name}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      loading={loading}
      noOptionsText={error ? "Could not load paints. Try changing the search." : "No more paints match."}
      onInputChange={(_, value, reason) => {
        if (reason === "input" || reason === "clear") onQueryChange(value);
      }}
      onChange={(_, paint) => {
        if (paint) onChoose(paint);
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Add paint"
          placeholder="Search paint, brand, or range…"
          sx={{ "& .MuiInputLabel-root.Mui-focused:not(.Mui-error)": { color: "var(--brand-text)" } }}
          error={Boolean(error)}
          helperText={error?.message}
        />
      )}
      renderOption={(props, paint) => {
        const { key, ...optionProps } = props;
        return (
          <Box
            component="li"
            key={key}
            {...optionProps}
            sx={{ boxSizing: "border-box", gap: "0.75rem" }}
            className={optionProps.className}
          >
            <PaintBottle paint={paint} size="sm" />
            <Box
              component="span"
              sx={{
                minWidth: 0,
                flex: "1",
              }}
            >
              <Box
                component="b"
                sx={{
                  display: "block",
                  ...truncateSx,
                  fontSize: "0.875rem",
                  lineHeight: 10 / 7,
                }}
              >
                {paint.name}
              </Box>
              <Box
                component="small"
                sx={{
                  display: "block",
                  ...truncateSx,
                  color: "var(--ink-faint)",
                }}
              >
                {paint.brand} · {paint.range}
              </Box>
            </Box>
          </Box>
        );
      }}
    />
  );
}
