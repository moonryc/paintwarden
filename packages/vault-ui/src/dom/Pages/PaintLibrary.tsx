import { Button, Card, MenuItem, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { isPaintAvailable } from "@paint-vault/core/paint-substitutions";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "../Components/EmptyState";
import { FilterPluginSelect, useFilterPlugin } from "../Components/FilterPlugin";
import { FilterToolbar } from "../Components/FilterToolbar";
import { LibraryPaintRow } from "../Components/LibraryPaintRow";
import { PageHeader } from "../Components/PageHeader";
import { FlaskConical, Heart, PaintDrop, Plus, SearchX } from "../icons";
import { PaintDetailsOverlay } from "../Modals/PaintDetailsOverlay";
import { useVault, useVaultStore } from "../store/hooks";
import { up } from "../theme-tokens";
import type { Paint } from "../types";
import { listResetSx } from "../utils/element-resets";
import { buzz } from "../utils/misc";
import { schemeGridWindow } from "../utils/scheme-grid-window";
import { useFuzzySearch } from "../utils/use-fuzzy-search";

const paintSearchText = (paint: Paint) =>
  `${paint.isCustom ? "Custom " : ""}${paint.brand} ${paint.range} ${paint.name}`;

export function PaintLibrary({ onAddPaint }: { onAddPaint(): void }) {
  const data = useVault();
  const filter = useVaultStore((s) => s.paintFilter);
  const setFilter = useVaultStore((s) => s.setPaintFilter);
  const search = useVaultStore((s) => s.paintSearch);
  const setSearch = useVaultStore((s) => s.setPaintSearch);
  const [openPaintId, setOpenPaintId] = useState<string | null>(null),
    [brand, setBrand] = useState("ALL"),
    q = search.trim();
  const filterBrand = (paint: Paint) => (paint.isCustom ? "Custom" : paint.brand);
  const brands = useMemo(
    () =>
      [...new Set(data.catalog.map((paint) => (paint.isCustom ? "Custom" : paint.brand)))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [data.catalog],
  );
  useEffect(() => {
    if (brand !== "ALL" && !brands.includes(brand)) setBrand("ALL");
  }, [brand, brands]);
  const pluginFilter = useFilterPlugin(data.catalog);
  const availablePaintIds = useMemo(
    () =>
      new Set(
        data.catalog
          .filter((paint) => isPaintAvailable(data, data.paintRecords, paint.id))
          .map((paint) => paint.id),
      ),
    [data],
  );
  const activeFilter = q ? "ALL" : filter;
  const match = (p: Paint, f: string) =>
    f === "ALL" ||
    (f === "OWNED"
      ? availablePaintIds.has(p.id)
      : f === "UNTRACKED"
        ? !availablePaintIds.has(p.id) && data.paintStates[p.id] !== "WISHLIST"
        : data.paintStates[p.id] === f);
  const searchResults = useFuzzySearch(data.catalog, q, paintSearchText);
  const searched = searchResults.filter(
    (paint) => (brand === "ALL" || filterBrand(paint) === brand) && pluginFilter.matches(paint),
  );
  const list = searched.filter((p) => match(p, activeFilter));
  const listRef = useRef<HTMLUListElement>(null);
  const [viewport, setViewport] = useState({ gridTop: 0, scrollY: 0, viewportHeight: 900 });
  const [pendingFocus, setPendingFocus] = useState<{ index: number; reverse: boolean } | null>(null);
  useLayoutEffect(() => {
    const listElement = listRef.current;
    if (!listElement) return;
    let frame = 0;
    const measure = () => {
      const bounds = listElement.getBoundingClientRect();
      const next = {
        gridTop: bounds.top + window.scrollY,
        scrollY: window.scrollY,
        viewportHeight: window.innerHeight,
      };
      setViewport((previous) =>
        previous.gridTop === next.gridTop &&
        previous.scrollY === next.scrollY &&
        previous.viewportHeight === next.viewportHeight
          ? previous
          : next,
      );
    };
    const schedule = () => {
      if (frame === 0) {
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
    observer.observe(listElement);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [list.length]);
  const paintWindow = schemeGridWindow({
    itemCount: list.length,
    columns: 1,
    rowHeight: 66,
    rowGap: 0,
    gridTop: viewport.gridTop,
    scrollY: viewport.scrollY,
    viewportHeight: viewport.viewportHeight,
    overscanRows: 5,
  });
  useLayoutEffect(() => {
    if (!pendingFocus) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-paint-index="${pendingFocus.index}"]`);
    if (!row) return;
    // Text inputs participate in native tab order, but handoff never focuses a text field.
    // Quantity +/- controls may have tabIndex=-1 and are valid non-text handoff targets.
    const controls = [...row.querySelectorAll<HTMLElement>("button, input[type='checkbox']")].filter(
      (control) => !control.hasAttribute("disabled"),
    );
    (pendingFocus.reverse ? controls.at(-1) : controls[0])?.focus();
    setPendingFocus(null);
  }, [pendingFocus, paintWindow.startIndex, paintWindow.endIndex]);
  const focusPaintAt = (index: number, reverse: boolean) => {
    window.scrollTo({ top: viewport.gridTop + index * 66 - 120, behavior: "auto" });
    setViewport((previous) => ({ ...previous, scrollY: window.scrollY }));
    setPendingFocus({ index, reverse });
  };
  const filters = ["ALL", "OWNED", "WISHLIST", "UNTRACKED"] as const;
  const ownedCount = availablePaintIds.size;
  const wishlistCount = data.catalog.filter((paint) => data.paintStates[paint.id] === "WISHLIST").length;
  return (
    <div>
      <PageHeader
        eyebrow="Color library"
        title="Paints"
        body={
          ownedCount || wishlistCount
            ? `${ownedCount.toLocaleString()} paint${ownedCount === 1 ? "" : "s"} available${wishlistCount ? ` · ${wishlistCount} on your wishlist` : ""} · ${data.catalog.length.toLocaleString()} in the library.`
            : "Browse paints from your catalog sources or add your own colors."
        }
        action={
          <Button variant="contained" onClick={onAddPaint} startIcon={<Plus size={16} />}>
            Add paint
          </Button>
        }
      />
      <FilterToolbar
        search={search}
        setSearch={setSearch}
        placeholder="Search brand, range, or paint…"
        // Three filters need the full row until the window is wide enough to sit beside the search.
        singleLineFilters={pluginFilter.plugins.length > 0}
      >
        <Box
          component="div"
          sx={[
            {
              display: "grid",
              minWidth: 0,
              gap: 1,
            },
            pluginFilter.plugins.length
              ? {
                  [up.sm]: {
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  },
                }
              : {
                  [up.sm]: {
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  },
                },
          ]}
        >
          <FilterPluginSelect filter={pluginFilter} />
          <TextField
            select
            size="small"
            label="Brand"
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
          >
            <MenuItem value="ALL">All brands</MenuItem>
            {brands.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Inventory"
            value={activeFilter}
            onChange={(event) => {
              buzz();
              setFilter(event.target.value as typeof filter);
            }}
          >
            {filters.map((item, index) => (
              <MenuItem key={item} value={item}>
                {["All", "Owned", "Wishlist", "Not owned"][index]} (
                {searched.filter((paint) => match(paint, item)).length})
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </FilterToolbar>
      {list.length ? (
        <Card
          component="ul"
          ref={listRef}
          onKeyDownCapture={(event) => {
            if (event.key !== "Tab") return;
            const row = (event.target as HTMLElement).closest<HTMLElement>("[data-paint-index]");
            if (!row) return;
            const index = Number(row.dataset.paintIndex);
            const controls = [...row.querySelectorAll<HTMLElement>("button, input")].filter(
              (control) => control.tabIndex >= 0 && !control.hasAttribute("disabled"),
            );
            const reverse = event.shiftKey;
            if (event.target !== (reverse ? controls[0] : controls.at(-1))) return;
            const next = reverse ? index - 1 : index + 1;
            if (next < 0 || next >= list.length) return;
            if (next >= paintWindow.startIndex && next < paintWindow.endIndex) return;
            event.preventDefault();
            focusPaintAt(next, reverse);
          }}
          sx={{
            ...listResetSx,
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          {paintWindow.topOffset > 0 && <li aria-hidden="true" style={{ height: paintWindow.topOffset }} />}
          {list.slice(paintWindow.startIndex, paintWindow.endIndex).map((paint, visibleIndex) => {
            const index = paintWindow.startIndex + visibleIndex;
            return (
              <LibraryPaintRow key={paint.id} paint={paint} onOpenPaint={setOpenPaintId} index={index} />
            );
          })}
          {paintWindow.endIndex < list.length && (
            <li aria-hidden="true" style={{ height: (list.length - paintWindow.endIndex) * 66 }} />
          )}
        </Card>
      ) : data.catalog.length === 0 ? (
        <EmptyState
          icon={<PaintDrop size={26} />}
          title="Your paint library is empty"
          body="Install a plugin from Data & settings → Plugins to add paint ranges, or add your own paints."
          action={
            <Button variant="contained" onClick={onAddPaint} startIcon={<Plus size={16} />}>
              Add a paint
            </Button>
          }
        />
      ) : (
        <PaintLibraryEmptyState
          search={q ? search : ""}
          brand={brand}
          plugin={pluginFilter.description}
          filter={activeFilter}
          onBrowseAll={() => setFilter("ALL")}
          onClear={() => {
            setSearch("");
            setBrand("ALL");
            pluginFilter.reset();
            setFilter("ALL");
          }}
        />
      )}
      {data.catalog.length > 0 && (
        <Box
          component="p"
          sx={{
            m: 0,
            mt: 1.5,
            textAlign: "center",
            fontSize: "0.75rem",
            lineHeight: 4 / 3,
            color: "var(--ink-faint)",
            [up.md]: {
              textAlign: "right",
            },
          }}
        >
          {list.length.toLocaleString()} matching paint{list.length === 1 ? "" : "s"}
        </Box>
      )}
      <PaintDetailsOverlay paintId={openPaintId} onClose={() => setOpenPaintId(null)} />
    </div>
  );
}

function PaintLibraryEmptyState({
  search,
  brand,
  plugin,
  filter,
  onBrowseAll,
  onClear,
}: {
  search: string;
  brand: string;
  plugin: string | null;
  filter: "ALL" | "OWNED" | "WISHLIST" | "UNTRACKED";
  onBrowseAll(): void;
  onClear(): void;
}) {
  // A narrowed search, brand, or plugin is the likely cause, so offer to clear it.
  if (search || brand !== "ALL" || plugin || filter === "ALL" || filter === "UNTRACKED") {
    const scope = [brand === "ALL" ? "" : ` in ${brand}`, plugin ? ` ${plugin}` : ""].join("");
    return (
      <EmptyState
        icon={<SearchX size={26} />}
        title="No paints match"
        body={
          search
            ? `Nothing found for “${search}”${scope}. Check the spelling or try a shorter name.`
            : `No paints in this view${scope}.`
        }
        action={
          <Button variant="outlined" onClick={onClear}>
            Clear filters
          </Button>
        }
      />
    );
  }
  const owned = filter === "OWNED";
  return (
    <EmptyState
      icon={owned ? <FlaskConical size={26} /> : <Heart size={24} />}
      title={owned ? "No paints owned yet" : "Your wishlist is empty"}
      body={
        owned
          ? "Mark bottles on your shelf as owned, or set an active substitution whose ingredients are on hand."
          : "Browse the library and tap the heart on paints you want to buy."
      }
      action={
        <Button variant="contained" onClick={onBrowseAll}>
          Browse all paints
        </Button>
      }
    />
  );
}
