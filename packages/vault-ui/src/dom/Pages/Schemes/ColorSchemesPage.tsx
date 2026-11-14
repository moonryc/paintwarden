import { Alert, Autocomplete, Button, MenuItem, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { isColorCategory } from "@paint-vault/core/color-categories";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "../../Components/EmptyState";
import { FilterToolbar } from "../../Components/FilterToolbar";
import { PageHeader } from "../../Components/PageHeader";
import { PageSkeleton } from "../../Components/PageSkeletons";
import { PaintBottle } from "../../Components/PaintBottle";
import { schemeSummaryModel, paintModel } from "../../graphql/miniature-scheme-model";
import { useSchemes, useSchemePaintOptions } from "../../graphql/schemes-hooks";
import { Layers, Plus, SearchX } from "../../icons";
import { ColorSchemesDialog } from "../../Modals/ColorSchemesDialog";
import { breakpoints, up } from "../../theme-tokens";
import type { Paint } from "../../types";
import { schemeGridWindow } from "../../utils/scheme-grid-window";
import { useInitialPageLoading } from "../useInitialPageLoading";

import { SchemeCard } from "./SchemeCard";

const categoryKeys = {
  RED: "schemesCategoryRed",
  PINK: "schemesCategoryPink",
  ORANGE: "schemesCategoryOrange",
  YELLOW: "schemesCategoryYellow",
  GREEN: "schemesCategoryGreen",
  TURQUOISE: "schemesCategoryTurquoise",
  BLUE: "schemesCategoryBlue",
  PURPLE: "schemesCategoryPurple",
  BROWN: "schemesCategoryBrown",
  BLACK: "schemesCategoryBlack",
  GREY: "schemesCategoryGrey",
  WHITE: "schemesCategoryWhite",
  GOLD: "schemesCategoryGold",
  SILVER: "schemesCategorySilver",
  BONE: "schemesCategoryBone",
  FLESH: "schemesCategoryFlesh",
} as const;

type Readiness = "ALL" | "READY" | "MISSING";

const readinessOptions = [
  ["ALL", "schemesAll"],
  ["READY", "schemesReady"],
  ["MISSING", "schemesMissing"],
] as const;

export function ColorSchemesPage() {
  const { t, i18n } = useTranslation("pages");
  const number = new Intl.NumberFormat(i18n.resolvedLanguage ?? i18n.language);
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const [search, setSearch] = useState(""),
    [categoryFilter, setCategoryFilter] = useState("ALL"),
    [readiness, setReadiness] = useState<Readiness>("ALL"),
    [selectedPaints, setSelectedPaints] = useState<Paint[]>([]);
  const [paintQuery, setPaintQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [debouncedPaintQuery, setDebouncedPaintQuery] = useState(paintQuery);
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 120);
    return () => clearTimeout(timeout);
  }, [search]);
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedPaintQuery(paintQuery), 120);
    return () => clearTimeout(timeout);
  }, [paintQuery]);
  const result = useSchemes({
    search: debouncedSearch.trim(),
    category: categoryFilter === "ALL" ? null : categoryFilter === "UNCATEGORIZED" ? "" : categoryFilter,
    sourceId: sourceFilter === "ALL" || sourceFilter === "NONE" ? null : sourceFilter,
    noSource: sourceFilter === "NONE",
    readiness: readiness === "ALL" ? null : readiness,
    usesPaintIds: selectedPaints.map((paint) => paint.id),
  });
  const initialLoading = useInitialPageLoading(result.loading, Boolean(result.error));
  const paintOptions = useSchemePaintOptions(
    debouncedPaintQuery.trim(),
    selectedPaints.map((paint) => paint.id),
  );
  const paintMatches = paintQuery === debouncedPaintQuery ? paintOptions.items.map(paintModel) : [];
  const schemes = result.items;
  const facets = result.facets;
  const globalCount = facets?.categories.reduce((sum, facet) => sum + facet.count, 0) ?? 0;
  const sourceOptions = facets?.sources.filter((source) => source.key !== "") ?? [];
  const readinessCount = (value: Readiness) =>
    facets?.readiness.find((facet) => facet.key === value)?.count ?? 0;
  const q = search.trim();
  const gridRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ gridTop: 0, scrollY: 0, viewportHeight: 900, width: 0 });
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(null);
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let frame = 0;
    const measure = () => {
      const next = {
        gridTop: grid.getBoundingClientRect().top + window.scrollY,
        scrollY: window.scrollY,
        viewportHeight: window.innerHeight,
        width: window.innerWidth,
      };
      setViewport((previous) =>
        previous.gridTop === next.gridTop &&
        previous.scrollY === next.scrollY &&
        previous.viewportHeight === next.viewportHeight &&
        previous.width === next.width
          ? previous
          : next,
      );
    };
    const schedule = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          measure();
        });
      }
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(grid);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [schemes.length, selectedPaints, initialLoading]);
  const columns = viewport.width >= breakpoints.xl ? 3 : viewport.width >= breakpoints.sm ? 2 : 1;
  const rowGap = viewport.width >= breakpoints.sm ? 16 : 12;
  const gridWindow = schemeGridWindow({
    itemCount: schemes.length,
    columns,
    rowHeight: 288,
    rowGap,
    gridTop: viewport.gridTop,
    scrollY: viewport.scrollY,
    viewportHeight: viewport.viewportHeight,
    overscanRows: 3,
  });
  useLayoutEffect(() => {
    if (pendingFocusIndex === null) return;
    const target = gridRef.current?.querySelector<HTMLElement>(`[data-scheme-index="${pendingFocusIndex}"]`);
    if (target) {
      target.focus();
      setPendingFocusIndex(null);
    }
  }, [pendingFocusIndex, gridWindow.startIndex, gridWindow.endIndex]);
  const focusSchemeAt = useCallback(
    (index: number) => {
      const row = Math.floor(index / columns);
      window.scrollTo({ top: viewport.gridTop + row * (288 + rowGap) - 120, behavior: "auto" });
      setViewport((previous) => ({ ...previous, scrollY: window.scrollY }));
      setPendingFocusIndex(index);
    },
    [columns, viewport.gridTop, rowGap],
  );
  const handleSchemeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (event.key !== "Tab") return;
      const next = event.shiftKey ? index - 1 : index + 1;
      if (next < 0 || next >= schemes.length) return;
      if (next >= gridWindow.startIndex && next < gridWindow.endIndex) return;
      event.preventDefault();
      focusSchemeAt(next);
    },
    [schemes.length, gridWindow.startIndex, gridWindow.endIndex, focusSchemeAt],
  );
  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("ALL");
    setReadiness("ALL");
    setSourceFilter("ALL");
    setSelectedPaints([]);
  };
  const usedCategories = (facets?.categories ?? []).filter((facet) => facet.count > 0);
  const { hasNextPage, loading, error, loadMore } = result;
  useEffect(() => {
    if (hasNextPage && !loading && !error && gridWindow.endIndex >= schemes.length - columns * 3) loadMore();
  }, [hasNextPage, loading, error, loadMore, gridWindow.endIndex, schemes.length, columns]);
  if (initialLoading) return <PageSkeleton page="schemes" />;
  return (
    <Box sx={{ "& .MuiFormLabel-root.Mui-focused": { color: "var(--ink)" } }}>
      <PageHeader
        eyebrow={t("schemesEyebrow")}
        title={t("schemesTitle")}
        body={t("schemesDescription")}
        action={
          <Button variant="contained" onClick={() => setEditing(null)} startIcon={<Plus size={16} />}>
            {t("schemesNew")}
          </Button>
        }
      />
      {globalCount > 0 ||
      result.loading ||
      Boolean(result.error) ||
      Boolean(q) ||
      categoryFilter !== "ALL" ||
      sourceFilter !== "ALL" ||
      selectedPaints.length > 0 ? (
        <>
          <FilterToolbar
            search={search}
            setSearch={setSearch}
            placeholder={t("schemesSearch")}
            singleLineFilters
          >
            <Box
              component="div"
              sx={{
                display: "grid",
                minWidth: 0,
                gap: 1,
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 16rem), 1fr))",
              }}
            >
              {sourceOptions.length > 0 && (
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={t("schemesPlugin")}
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                >
                  <MenuItem value="ALL">{t("schemesAllPlugins")}</MenuItem>
                  {sourceOptions.map((source) => (
                    <MenuItem key={source.key} value={source.key}>
                      {source.label}
                    </MenuItem>
                  ))}
                  <MenuItem value="NONE">{t("schemesNoPlugin")}</MenuItem>
                </TextField>
              )}
              <TextField
                select
                fullWidth
                size="small"
                label={t("schemesColorCategory")}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <MenuItem value="ALL">{t("schemesAllCount", { count: number.format(globalCount) })}</MenuItem>
                {usedCategories.map((category) => (
                  <MenuItem key={category.key} value={category.key || "UNCATEGORIZED"}>
                    {t("schemesFilterCount", {
                      label: isColorCategory(category.key)
                        ? t(categoryKeys[category.key])
                        : category.key === ""
                          ? t("schemesUncategorized")
                          : category.label,
                      count: number.format(category.count),
                    })}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                size="small"
                label={t("schemesStatus")}
                value={readiness}
                onChange={(e) => setReadiness(e.target.value as Readiness)}
              >
                {readinessOptions.map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {t("schemesFilterCount", {
                      label: t(label),
                      count: number.format(readinessCount(value)),
                    })}
                  </MenuItem>
                ))}
              </TextField>
              <Autocomplete<Paint, true, false, false>
                multiple
                fullWidth
                size="small"
                limitTags={2}
                filterSelectedOptions
                options={paintMatches}
                loading={paintOptions.loading || paintQuery !== debouncedPaintQuery}
                noOptionsText={paintOptions.error ? t("schemesPaintsLoadError") : t("schemesNoPaintMatches")}
                inputValue={paintQuery}
                onInputChange={(_, value) => setPaintQuery(value)}
                value={selectedPaints}
                onChange={(_, paints) => setSelectedPaints(paints)}
                getOptionLabel={(paint) => paint.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                filterOptions={(options) => options}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t("schemesUsesPaints")}
                    placeholder={t("schemesSearchPaints")}
                    error={Boolean(paintOptions.error)}
                    helperText={paintOptions.error?.message}
                  />
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
                        <Box
                          component="span"
                          sx={{ display: "block", color: "text.secondary", fontSize: 12 }}
                        >
                          {paint.brand} · {paint.range}
                        </Box>
                      </Box>
                    </Box>
                  );
                }}
                sx={{
                  minWidth: 0,
                  gridColumn: { sm: "1 / -1" },
                  [up.xl]: { gridColumn: "auto" },
                }}
              />
            </Box>
          </FilterToolbar>
          {result.error && (
            <Alert severity="error" action={<Button onClick={result.refetch}>{t("schemesRetry")}</Button>}>
              {result.error.message}
            </Alert>
          )}
          {result.loading && (
            <Box role="status" sx={{ mb: 2 }}>
              {t("schemesLoading")}
            </Box>
          )}
          {schemes.length ? (
            <Box
              component="div"
              ref={gridRef}
              sx={{
                position: "relative",
              }}
              style={{ height: gridWindow.totalHeight }}
            >
              <Box
                component="div"
                sx={{
                  position: "absolute",
                  insetInline: 0,
                  display: "grid",
                  gap: 1.5,
                  [up.sm]: {
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 2,
                  },
                  [up.xl]: {
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  },
                }}
                style={{ top: gridWindow.topOffset }}
              >
                {schemes.slice(gridWindow.startIndex, gridWindow.endIndex).map((scheme, visibleIndex) => {
                  const index = gridWindow.startIndex + visibleIndex;
                  return (
                    <SchemeCard
                      key={scheme.id}
                      scheme={schemeSummaryModel(scheme)}
                      summary={{
                        gradient: scheme.gradient,
                        previewUrl: scheme.imageUrl,
                        uses: scheme.usageCount,
                        paintNames: scheme.paintNames,
                        previewMoreCount: scheme.previewMoreCount,
                      }}
                      index={index}
                      available={scheme.availableCount}
                      total={scheme.paintCount}
                      onOpen={setEditing}
                      onKeyDown={handleSchemeKeyDown}
                    />
                  );
                })}
              </Box>
            </Box>
          ) : !result.loading && !result.error ? (
            <EmptyState
              icon={<SearchX size={27} />}
              title={t("schemesNoMatches")}
              body={
                readiness === "READY" && !q && categoryFilter === "ALL"
                  ? t("schemesNoReady")
                  : t("schemesTryFilters")
              }
              action={
                <Button variant="outlined" onClick={clearFilters}>
                  {t("schemesClearFilters")}
                </Button>
              }
            />
          ) : null}
          {result.hasNextPage && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Button onClick={result.loadMore} disabled={result.loading}>
                {t("schemesLoadMore")}
              </Button>
            </Box>
          )}
        </>
      ) : (
        <EmptyState
          icon={<Layers size={27} />}
          title={t("schemesEmptyTitle")}
          body={t("schemesEmptyBody")}
          action={
            <Button variant="contained" onClick={() => setEditing(null)} startIcon={<Plus size={16} />}>
              {t("schemesCreateFirst")}
            </Button>
          }
        />
      )}
      {editing !== undefined && (
        <ColorSchemesDialog initialId={editing} onClose={() => setEditing(undefined)} />
      )}
    </Box>
  );
}
