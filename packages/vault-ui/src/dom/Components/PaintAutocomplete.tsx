import { StableAutocomplete } from "./StableAutocomplete";
import { useTranslation } from "react-i18next";
import { TextField } from "@mui/material";
import Box from "@mui/material/Box";

import { usePaintOptions } from "../graphql/detail-hooks";
import type { Paint } from "../types";
import { truncateSx } from "../utils/truncate";

import { PaintBottle } from "./PaintBottle";

export type PaintOption = {
  id: string;
  brand: string;
  range: string;
  name: string;
  colorHex: string | null;
};

type PickerProps<T extends PaintOption> = {
  excludedIds: string[];
  query: string;
  onQueryChange: (value: string) => void;
  onChoose: (paint: T) => void;
};

export function PaintAutocomplete(props: PickerProps<Paint>) {
  const { items, loading, error } = usePaintOptions(props.query, props.excludedIds);
  // Server projections contain the complete picker paint, not caller snapshot pages.
  const options = items.map((paint) => ({
    ...paint,
    sourceName: paint.sourceName ?? undefined,
  }));
  return <PaintAutocompleteView {...props} matches={options} loading={loading} error={error} />;
}

function PaintAutocompleteView<T extends PaintOption>({
  matches,
  query,
  onQueryChange,
  onChoose,
  loading,
  error,
}: PickerProps<T> & { matches: T[]; loading?: boolean; error?: Error | null }) {
  const { t } = useTranslation("components");
  return (
    <StableAutocomplete
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
      noOptionsText={error ? t("couldNotLoadPaintsTryChangingTheSearch") : t("noMorePaintsMatch")}
      onInputChange={(_, value, reason) => {
        if (reason === "input" || reason === "clear") onQueryChange(value);
      }}
      onChange={(_, paint) => {
        if (paint) onChoose(paint);
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t("addPaint")}
          placeholder={t("searchPaintBrandOrRange")}
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
