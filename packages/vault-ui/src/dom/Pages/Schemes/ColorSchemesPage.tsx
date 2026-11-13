import { Autocomplete, Button, MenuItem, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import {
  type ColorCategory,
  COLOR_CATEGORIES,
  COLOR_CATEGORY_LABELS,
} from "@paint-vault/core/color-categories";
import { isPaintAvailable } from "@paint-vault/core/paint-substitutions";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { EmptyState } from "../../Components/EmptyState";
import { FilterPluginSelect, useFilterPlugin } from "../../Components/FilterPlugin";
import { FilterToolbar } from "../../Components/FilterToolbar";
import { PageHeader } from "../../Components/PageHeader";
import { PaintBottle } from "../../Components/PaintBottle";
import { Layers, Plus, SearchX } from "../../icons";
import { ColorSchemesDialog } from "../../Modals/ColorSchemesDialog";
import { useVault } from "../../store/hooks";
import { breakpoints, up } from "../../theme-tokens";
import type { ColorScheme, Paint } from "../../types";
import { schemeGridWindow } from "../../utils/scheme-grid-window";
import {
  filteredSchemes,
  schemeCategoryCount,
  schemePaintIdIndex,
  sortedSchemes,
} from "../../utils/semantic-contract";
import { useFuzzySearch } from "../../utils/use-fuzzy-search";

import { SchemeCard } from "./SchemeCard";

const schemeSearchText = (scheme: ColorScheme) =>
  `${scheme.name} ${scheme.category ? COLOR_CATEGORY_LABELS[scheme.category] : ""}`;
const paintSearchText = (paint: Paint) => `${paint.brand} ${paint.range} ${paint.name}`;

type Readiness = "ALL" | "READY" | "MISSING";

const readinessOptions: [Readiness, string][] = [
  ["ALL", "All"],
  ["READY", "Ready to paint"],
  ["MISSING", "Missing paints"],
];

export function ColorSchemesPage() {
  const data = useVault();
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const [search, setSearch] = useState(""),
    [categoryFilter, setCategoryFilter] = useState<ColorCategory | "ALL">("ALL"),
    [readiness, setReadiness] = useState<Readiness>("ALL"),
    [selectedPaints, setSelectedPaints] = useState<Paint[]>([]);
  const [paintQuery, setPaintQuery] = useState("");
  const pluginFilter = useFilterPlugin(data.colorSchemes);
  const matchesPlugin = pluginFilter.matches;
  const q = search.trim();
  const schemePaintIds = useMemo(() => schemePaintIdIndex(data), [data]);
  const paintOptions = useMemo(() => {
    const usedPaintIds = new Set([...schemePaintIds.values()].flatMap((paintIds) => [...paintIds]));
    return data.catalog.filter((paint) => usedPaintIds.has(paint.id));
  }, [data.catalog, schemePaintIds]);
  const availablePaintIds = useMemo(
    () =>
      new Set(
        data.catalog
          .filter((paint) => isPaintAvailable(data, data.paintRecords, paint.id))
          .map((paint) => paint.id),
      ),
    [data],
  );
  // Availability includes paints resolved by an active substitution.
  const availability = useMemo(() => {
    const result = new Map<string, { available: number; total: number }>();
    for (const scheme of data.colorSchemes) {
      const paintIds = schemePaintIds.get(scheme.id) ?? new Set<string>();
      let available = 0;
      for (const paintId of paintIds) if (availablePaintIds.has(paintId)) available += 1;
      result.set(scheme.id, { available, total: paintIds.size });
    }
    return result;
  }, [data.colorSchemes, schemePaintIds, availablePaintIds]);
  const readyIds = useMemo(
    () =>
      new Set(
        [...availability]
          .filter(([, counts]) => counts.total > 0 && counts.available === counts.total)
          .map(([schemeId]) => schemeId),
      ),
    [availability],
  );
  const readinessCount = (value: Readiness) =>
    filteredSchemes(
      data,
      categoryFilter,
      matchesPlugin,
      selectedPaints.map((paint) => paint.id),
      schemePaintIds,
      value,
      readyIds,
    ).length;
  const schemeCandidates = useMemo(
    () =>
      filteredSchemes(
        data,
        categoryFilter,
        matchesPlugin,
        selectedPaints.map((paint) => paint.id),
        schemePaintIds,
        readiness,
        readyIds,
      ),
    [data, categoryFilter, matchesPlugin, selectedPaints, schemePaintIds, readiness, readyIds],
  );
  const schemeMatches = useFuzzySearch(schemeCandidates, q, schemeSearchText);
  const schemes = useMemo(() => sortedSchemes(schemeMatches), [schemeMatches]);
  // MUI removes selected options before calling filterOptions; preserve that order before limiting.
  const paintCandidates = useMemo(
    () => paintOptions.filter((paint) => !selectedPaints.some((selected) => selected.id === paint.id)),
    [paintOptions, selectedPaints],
  );
  const paintMatches = useFuzzySearch(paintCandidates, paintQuery.trim(), paintSearchText, 40);
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
  }, [schemes.length, selectedPaints]);
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
    setSelectedPaints([]);
  };
  const usedCategories = COLOR_CATEGORIES.filter((category) =>
    data.colorSchemes.some((scheme) => scheme.category === category),
  ).sort((a, b) =>
    COLOR_CATEGORY_LABELS[a].localeCompare(COLOR_CATEGORY_LABELS[b], undefined, { sensitivity: "base" }),
  );
  return (
    <div>
      <PageHeader
        eyebrow="Reusable palettes"
        title="Schemes"
        body="Ordered groups of paints you can add to any miniature in one tap."
        action={
          <Button variant="contained" onClick={() => setEditing(null)} startIcon={<Plus size={16} />}>
            New scheme
          </Button>
        }
      />
      {data.colorSchemes.length ? (
        <>
          <FilterToolbar
            search={search}
            setSearch={setSearch}
            placeholder="Search schemes…"
            singleLineFilters
          >
            <Box
              component="div"
              sx={[
                {
                  display: "grid",
                  minWidth: 0,
                  gap: 1,
                  [up.sm]: {
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  },
                },
                {
                  // With the Plugin filter, the three selects share a row and Uses paints gets its own.
                  ...(pluginFilter.plugins.length
                    ? { [up.sm]: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } }
                    : {}),
                  [up.xl]: {
                    gridTemplateColumns: `repeat(${pluginFilter.plugins.length ? 4 : 3}, minmax(0, 1fr))`,
                  },
                },
              ]}
            >
              <FilterPluginSelect filter={pluginFilter} />
              <TextField
                select
                fullWidth
                size="small"
                label="Color category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as ColorCategory | "ALL")}
              >
                <MenuItem value="ALL">All ({data.colorSchemes.length})</MenuItem>
                {usedCategories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {COLOR_CATEGORY_LABELS[category]} ({schemeCategoryCount(data, category)})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                size="small"
                label="Status"
                value={readiness}
                onChange={(e) => setReadiness(e.target.value as Readiness)}
              >
                {readinessOptions.map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label} ({readinessCount(value)})
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
                inputValue={paintQuery}
                onInputChange={(_, value) => setPaintQuery(value)}
                value={selectedPaints}
                onChange={(_, paints) => setSelectedPaints(paints)}
                getOptionLabel={(paint) => paint.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                filterOptions={(options) => options}
                renderInput={(params) => (
                  <TextField {...params} label="Uses paints" placeholder="Search paints…" />
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
                      scheme={scheme}
                      index={index}
                      available={availability.get(scheme.id)?.available ?? 0}
                      total={availability.get(scheme.id)?.total ?? 0}
                      onOpen={setEditing}
                      onKeyDown={handleSchemeKeyDown}
                    />
                  );
                })}
              </Box>
            </Box>
          ) : (
            <EmptyState
              icon={<SearchX size={27} />}
              title="No color schemes match"
              body={
                readiness === "READY" && !q && categoryFilter === "ALL"
                  ? "No scheme has every paint marked as owned yet. Mark paints as owned on the Paints page."
                  : "Try another name, color category, or paint filter."
              }
              action={
                <Button variant="outlined" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )}
        </>
      ) : (
        <EmptyState
          icon={<Layers size={27} />}
          title="No color schemes yet"
          body="Install a plugin with ready-made schemes from Data & settings → Plugins, or create a named palette and arrange its paints in the order you use them."
          action={
            <Button variant="contained" onClick={() => setEditing(null)} startIcon={<Plus size={16} />}>
              Create your first scheme
            </Button>
          }
        />
      )}
      {editing !== undefined && (
        <ColorSchemesDialog initialId={editing} onClose={() => setEditing(undefined)} />
      )}
    </div>
  );
}
