import { Autocomplete, Box, CircularProgress, Skeleton, type AutocompleteProps } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useVaultGraphQL } from "../graphql/provider";
import { nearSearchBottom, useSearchResults } from "../utils/use-search-results";

const popupHeight = "min(240px, 40dvh)";
const statusSx = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clipPath: "inset(50%)",
} as const;

type Props<
  T,
  Multiple extends boolean | undefined,
  DisableClearable extends boolean | undefined,
  FreeSolo extends boolean | undefined,
> = AutocompleteProps<T, Multiple, DisableClearable, FreeSolo> & {
  hasNextPage?: boolean;
  onLoadMore?: () => void;
};

/** One stable popup for every picker: accepted results survive revalidation,
 * loading/no-results share its footprint, and paging happens inside the list.
 */
export function StableAutocomplete<
  T,
  Multiple extends boolean | undefined = false,
  DisableClearable extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
>({
  options,
  loading = false,
  hasNextPage,
  onLoadMore,
  slotProps,
  renderInput,
  sx,
  ...props
}: Props<T, Multiple, DisableClearable, FreeSolo>) {
  const { t } = useTranslation("components");
  const scope = useVaultGraphQL();
  const previous = useSearchResults(options.length || !loading ? options : null, loading, scope);
  // Search hooks own retention so they can remove newly excluded/selected rows
  // immediately rather than reintroducing an excluded previous option here.
  const retained = options;
  const paging = useRef<{ list: HTMLElement; top: number; count: number; started: boolean } | null>(null);
  useEffect(() => {
    // MUI synchronizes highlighting on both loading and options updates. Restore
    // the captured viewport after that synchronization, without remounting the list.
    const current = paging.current;
    if (!current) return;
    current.list.scrollTop = current.top;
    if (loading) current.started = true;
    else if (current.started || options.length > current.count) paging.current = null;
  }, [options, loading]);
  const [placement, setPlacement] = useState<"bottom-start" | "top-start">("bottom-start");
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), 300);
    return () => clearTimeout(timer);
  }, [loading]);
  return (
    <>
      <Autocomplete<T, Multiple, DisableClearable, FreeSolo>
        {...props}
        onInputChange={(event, value, reason) => {
          if (reason === "input" || reason === "clear") paging.current = null;
          props.onInputChange?.(event, value, reason);
        }}
        onOpen={(event) => {
          // Pick the fitting side once on open, not again as options change.
          const root = event.target instanceof Element ? event.target.closest(".MuiAutocomplete-root") : null;
          const bounds = root?.getBoundingClientRect();
          const height = Math.min(240, window.innerHeight * 0.4);
          setPlacement(
            bounds && window.innerHeight - bounds.bottom < height && bounds.top >= height
              ? "top-start"
              : "bottom-start",
          );
          props.onOpen?.(event);
        }}
        options={retained}
        loading={loading && previous === null}
        loadingText={
          <Box
            role="listbox"
            aria-busy="true"
            aria-label={t("searchResults")}
            sx={{ boxSizing: "border-box", height: popupHeight, px: 2, py: 1 }}
          >
            {[0, 1, 2, 3, 4].map((row) => (
              <Box key={row} sx={{ height: 40, display: "flex", alignItems: "center" }}>
                <Skeleton width="80%" animation={false} />
              </Box>
            ))}
          </Box>
        }
        renderInput={(params) =>
          renderInput({
            ...params,
            slotProps: {
              ...params.slotProps,
              input: {
                ...params.slotProps.input,
                endAdornment: (
                  <>
                    {params.slotProps.input.endAdornment}
                    <Box
                      component="span"
                      aria-hidden="true"
                      sx={{
                        position: "absolute",
                        right: 60,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 20,
                        height: 20,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {loading && slow ? <CircularProgress size={16} /> : null}
                    </Box>
                  </>
                ),
              },
            },
          })
        }
        sx={[
          { "& .MuiAutocomplete-inputRoot": { paddingRight: "88px !important" } },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
        slotProps={{
          ...slotProps,
          popper: {
            placement,
            modifiers: [
              { name: "flip", enabled: false },
              { name: "preventOverflow", enabled: false },
            ],
          },
          paper: {
            sx: {
              height: popupHeight,
              "& .MuiAutocomplete-loading": { padding: 0 },
              "& .MuiAutocomplete-loading, & .MuiAutocomplete-noOptions": {
                boxSizing: "border-box",
                height: popupHeight,
              },
            },
          },
          listbox: {
            "aria-busy": loading,
            onScroll: (event) => {
              if (hasNextPage && !loading && !paging.current && nearSearchBottom(event.currentTarget)) {
                paging.current = {
                  list: event.currentTarget,
                  top: event.currentTarget.scrollTop,
                  count: options.length,
                  started: false,
                };
                onLoadMore?.();
              }
            },
            sx: {
              boxSizing: "border-box",
              height: popupHeight,
              maxHeight: popupHeight,
              overflowAnchor: "none",
            },
          },
        }}
      />
      <Box component="span" role="status" aria-live="polite" aria-atomic="true" sx={statusSx}>
        {!loading ? t("searchResultCount", { count: retained.length }) : ""}
      </Box>
    </>
  );
}
