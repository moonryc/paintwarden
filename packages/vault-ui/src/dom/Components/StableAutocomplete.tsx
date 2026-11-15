import { Autocomplete, Box, Skeleton, type AutocompleteProps } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { usePageLoading } from "./PageLoadingStatus";

import { useVaultGraphQL } from "../graphql/provider";
import { nearSearchBottom, useSearchResults } from "../utils/use-search-results";

const popupHeight = "min(240px, 40dvh)";

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
  const initialLoading = loading && previous === null;
  usePageLoading(initialLoading);
  return (
    <>
      <Autocomplete<T, Multiple, DisableClearable, FreeSolo>
        {...props}
        disabled={props.disabled || initialLoading}
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
              htmlInput: {
                ...params.slotProps.htmlInput,
                ...(initialLoading ? { placeholder: t("loading"), "aria-busy": true } : {}),
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
    </>
  );
}
