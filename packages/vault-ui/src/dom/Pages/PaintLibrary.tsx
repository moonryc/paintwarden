import { Alert, Button, Card, MenuItem, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "../Components/EmptyState";
import { FilterToolbar } from "../Components/FilterToolbar";
import { LibraryPaintRow } from "../Components/LibraryPaintRow";
import { PageHeader } from "../Components/PageHeader";
import { PageSkeleton } from "../Components/PageSkeletons";
import { ALL_LIBRARY_SOURCES, NO_LIBRARY_SOURCE, useLibraryPaints } from "../graphql/library-hooks";
import { FlaskConical, Heart, PaintDrop, Plus, SearchX } from "../icons";
import { PaintDetailsOverlay } from "../Modals/PaintDetailsOverlay";
import { useVaultStore } from "../store/hooks";
import { up } from "../theme-tokens";
import { listResetSx } from "../utils/element-resets";
import { buzz } from "../utils/misc";
import { schemeGridWindow } from "../utils/scheme-grid-window";
import { libraryInventoryFilter } from "../utils/semantic-contract";
import { visuallyHiddenSx } from "../utils/visually-hidden";

import { useInitialPageLoading } from "./useInitialPageLoading";

export function PaintLibrary({ onAddPaint }: { onAddPaint(): void }) {
  const { t, i18n } = useTranslation("pages");
  const number = (value: number) =>
    new Intl.NumberFormat(i18n.resolvedLanguage || i18n.language).format(value);
  const filter = useVaultStore((s) => s.paintFilter);
  const setFilter = useVaultStore((s) => s.setPaintFilter);
  const search = useVaultStore((s) => s.paintSearch);
  const setSearch = useVaultStore((s) => s.setPaintSearch);
  const [openPaintId, setOpenPaintId] = useState<string | null>(null);
  const [brand, setBrand] = useState("ALL");
  const [plugin, setPlugin] = useState(ALL_LIBRARY_SOURCES);
  const q = search.trim();
  const activeFilter = libraryInventoryFilter(q, filter);
  const library = useLibraryPaints({ search: q, brand, plugin, inventory: activeFilter });
  const { rows: list, loadMore, loading, refreshing, hasNextPage } = library;
  const initialLoading = useInitialPageLoading(loading, Boolean(library.error));
  const brands = library.brands.map((facet) => facet.key);
  const plugins = library.sources.filter((facet) => facet.key !== "");
  const pluginDescription =
    plugin === ALL_LIBRARY_SOURCES
      ? null
      : plugin === NO_LIBRARY_SOURCE
        ? t("libraryNoPluginDescription")
        : t("libraryPluginDescription", { plugin });
  useEffect(() => {
    if (!loading && !library.error && brand !== "ALL" && !library.brands.some((facet) => facet.key === brand))
      setBrand("ALL");
    if (
      !loading &&
      !library.error &&
      plugin !== ALL_LIBRARY_SOURCES &&
      plugin !== NO_LIBRARY_SOURCE &&
      !library.sources.some((facet) => facet.key === plugin)
    )
      setPlugin(ALL_LIBRARY_SOURCES);
  }, [brand, plugin, library.brands, library.sources, loading, library.error]);
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
  }, [list.length, initialLoading]);
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
    // A network boundary may take time. If the person clicked away meanwhile, do not
    // steal focus back when the page arrives.
    if (!listRef.current?.contains(document.activeElement)) {
      setPendingFocus(null);
      return;
    }
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
  const ownedCount = library.availableCount;
  const wishlistCount = library.wishlistCount;
  useEffect(() => {
    if (hasNextPage && !loading && !refreshing && !library.error && paintWindow.endIndex >= list.length - 12)
      loadMore();
  }, [hasNextPage, loading, refreshing, library.error, paintWindow.endIndex, list.length, loadMore]);
  if (initialLoading) return <PageSkeleton page="paints" />;
  return (
    <div>
      <PageHeader
        eyebrow={t("libraryColorLibrary")}
        title={t("libraryPaintsTitle")}
        body={
          ownedCount || wishlistCount
            ? t(wishlistCount ? "libraryAvailableWishlist" : "libraryAvailable", {
                count: ownedCount,
                wishlistCount,
                catalogCount: library.catalogCount,
              })
            : t("libraryBrowseBody")
        }
        action={
          <Button variant="contained" onClick={onAddPaint} startIcon={<Plus size={16} />}>
            {t("libraryAddPaint")}
          </Button>
        }
      />
      <FilterToolbar
        search={search}
        setSearch={setSearch}
        placeholder={t("librarySearchPlaceholder")}
        // Three filters need the full row until the window is wide enough to sit beside the search.
        singleLineFilters={plugins.length > 0}
      >
        <Box
          component="div"
          sx={[
            {
              display: "grid",
              minWidth: 0,
              gap: 1,
            },
            plugins.length
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
          {plugins.length > 0 && (
            <TextField
              select
              fullWidth
              size="small"
              label={t("libraryPluginLabel")}
              value={plugin}
              onChange={(event) => setPlugin(event.target.value)}
            >
              <MenuItem value={ALL_LIBRARY_SOURCES}>{t("libraryAllPlugins")}</MenuItem>
              {plugins.map((source) => (
                <MenuItem key={source.key} value={source.key}>
                  {source.label}
                </MenuItem>
              ))}
              <MenuItem value={NO_LIBRARY_SOURCE}>{t("libraryNotFromPlugin")}</MenuItem>
            </TextField>
          )}
          <TextField
            select
            size="small"
            label={t("libraryBrandLabel")}
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
          >
            <MenuItem value="ALL">{t("libraryAllBrands")}</MenuItem>
            {brands.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label={t("libraryInventoryLabel")}
            value={activeFilter}
            onChange={(event) => {
              buzz();
              setFilter(event.target.value as typeof filter);
            }}
          >
            {filters.map((item, index) => (
              <MenuItem key={item} value={item}>
                {t(
                  (
                    [
                      "libraryFilterAll",
                      "libraryFilterOwned",
                      "libraryFilterWishlist",
                      "libraryFilterUntracked",
                    ] as const
                  )[index],
                )}{" "}
                ({number(library.inventory.find((facet) => facet.key === item)?.count ?? 0)})
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </FilterToolbar>
      {library.error && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={library.retry}>
              {t("libraryRetry")}
            </Button>
          }
        >
          {library.error}
        </Alert>
      )}
      {loading && (
        <Box role="status" sx={{ py: 3 }}>
          {t("libraryLoadingPaints")}
        </Box>
      )}
      {list.length ? (
        <Card
          component="ul"
          aria-label={t("libraryPaintLibrary")}
          aria-busy={refreshing}
          data-loaded-count={list.length}
          data-total-count={library.totalCount}
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
            if (next < 0 || next >= library.totalCount) return;
            if (next >= paintWindow.startIndex && next < paintWindow.endIndex) return;
            event.preventDefault();
            focusPaintAt(next, reverse);
            if (next >= list.length) loadMore();
          }}
          sx={{
            ...listResetSx,
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          {paintWindow.topOffset > 0 && <li aria-hidden="true" style={{ height: paintWindow.topOffset }} />}
          {list.slice(paintWindow.startIndex, paintWindow.endIndex).map((projection, visibleIndex) => {
            const index = paintWindow.startIndex + visibleIndex;
            return (
              <LibraryPaintRow
                key={projection.paint.id}
                paint={projection.paint}
                projection={projection}
                onOpenPaint={setOpenPaintId}
                index={index}
              />
            );
          })}
          {paintWindow.endIndex < list.length && (
            <li aria-hidden="true" style={{ height: (list.length - paintWindow.endIndex) * 66 }} />
          )}
        </Card>
      ) : loading || library.error ? null : library.catalogCount === 0 ? (
        <EmptyState
          icon={<PaintDrop size={26} />}
          title={t("libraryEmptyTitle")}
          body={t("libraryEmptyBody")}
          action={
            <Button variant="contained" onClick={onAddPaint} startIcon={<Plus size={16} />}>
              {t("libraryAddAPaint")}
            </Button>
          }
        />
      ) : (
        <PaintLibraryEmptyState
          search={q ? search : ""}
          brand={brand}
          plugin={pluginDescription}
          filter={activeFilter}
          onBrowseAll={() => setFilter("ALL")}
          onClear={() => {
            setSearch("");
            setBrand("ALL");
            setPlugin(ALL_LIBRARY_SOURCES);
            setFilter("ALL");
          }}
        />
      )}
      {hasNextPage && (
        <Box sx={{ textAlign: "center", mt: 1.5 }}>
          <Button disabled={loading || refreshing} onClick={loadMore}>
            {t("libraryLoadMorePaints")}
          </Button>
        </Box>
      )}
      <Box role="status" sx={visuallyHiddenSx}>
        {refreshing ? t("libraryUpdatingPaints") : ""}
      </Box>
      {library.catalogCount > 0 && (
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
          {t("libraryMatchingPaints", { count: library.totalCount })}
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
  const { t } = useTranslation("pages");
  // A narrowed search, brand, or plugin is the likely cause, so offer to clear it.
  if (search || brand !== "ALL" || plugin || filter === "ALL" || filter === "UNTRACKED") {
    const scope = [brand === "ALL" ? "" : t("libraryBrandScope", { brand }), plugin ? ` ${plugin}` : ""].join(
      "",
    );
    return (
      <EmptyState
        icon={<SearchX size={26} />}
        title={t("libraryNoMatches")}
        body={search ? t("librarySearchNoResults", { search, scope }) : t("libraryViewNoResults", { scope })}
        action={
          <Button variant="outlined" onClick={onClear}>
            {t("libraryClearFilters")}
          </Button>
        }
      />
    );
  }
  const owned = filter === "OWNED";
  return (
    <EmptyState
      icon={owned ? <FlaskConical size={26} /> : <Heart size={24} />}
      title={owned ? t("libraryOwnedEmpty") : t("libraryWishlistEmpty")}
      body={owned ? t("libraryOwnedEmptyBody") : t("libraryWishlistEmptyBody")}
      action={
        <Button variant="contained" onClick={onBrowseAll}>
          {t("libraryBrowseAllPaints")}
        </Button>
      }
    />
  );
}
