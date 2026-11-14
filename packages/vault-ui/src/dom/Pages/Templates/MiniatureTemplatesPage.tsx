import { Alert, Button, MenuItem, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "../../Components/EmptyState";
import { FilterToolbar } from "../../Components/FilterToolbar";
import { PageHeader } from "../../Components/PageHeader";
import { PageSkeleton } from "../../Components/PageSkeletons";
import { Plus, TemplateCopy } from "../../icons";
import { useVaultStore } from "../../store/hooks";
import { useTemplateActions, useTemplateCatalog } from "../../store/template-hooks";
import type { MiniatureTemplate } from "../../types";
import { schemeGridWindow } from "../../utils/scheme-grid-window";
import { useInitialPageLoading } from "../useInitialPageLoading";

import { TemplateCard } from "./TemplateCard";
import { TemplateDetailsDialog } from "./TemplateDetailsDialog";
import { TemplateEditorDialog } from "./TemplateEditorDialog";

// Cards are outlined (1px border) around a 4:5 image, so their height follows the column width.
const CARD_BORDER = 1;

export function MiniatureTemplatesPage({ onUse }: { onUse(id: string): void }) {
  const { t, i18n } = useTranslation("pages");
  const actions = useTemplateActions();
  const notify = useVaultStore((s) => s.notify);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [plugin, setPlugin] = useState("ALL");
  const catalogQuery = useTemplateCatalog(true, {
    search,
    category: category === "ALL" ? null : category,
    sourceId: plugin === "ALL" || plugin === "NONE" ? null : plugin,
    noSource: plugin === "NONE",
  });
  const catalog = catalogQuery.data;
  const error = catalogQuery.error?.message;
  const loadMore = catalogQuery.loadMore;
  const loading = catalogQuery.loading;
  const initialLoading = useInitialPageLoading(loading, Boolean(catalogQuery.error));
  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !catalog?.hasNextPage || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [catalog?.hasNextPage, loading, loadMore]);
  const [editing, setEditing] = useState<MiniatureTemplate | null | undefined>();
  const [selected, setSelected] = useState<MiniatureTemplate | null>(null);
  // The template whose Delete was clicked once; a second click deletes it.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const hasGrid =
    !initialLoading &&
    !(catalog && catalog.totalCount === 0 && !search && category === "ALL" && plugin === "ALL");
  const gridRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ gridTop: 0, gridWidth: 0, scrollY: 0, viewportHeight: 900 });
  const [pendingFocus, setPendingFocus] = useState<number | null>(null);
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let frame = 0;
    const measure = () => {
      const rect = grid.getBoundingClientRect();
      const next = {
        gridTop: rect.top + window.scrollY,
        gridWidth: rect.width,
        scrollY: window.scrollY,
        viewportHeight: window.innerHeight,
      };
      setViewport((previous) =>
        previous.gridTop === next.gridTop &&
        previous.gridWidth === next.gridWidth &&
        previous.scrollY === next.scrollY &&
        previous.viewportHeight === next.viewportHeight
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
    // The grid's own height changes with the result count, which can move content below it.
    const observer = new ResizeObserver(schedule);
    observer.observe(grid);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [hasGrid]);
  const { gridWidth } = viewport;
  const columns = gridWidth >= 1100 ? 5 : gridWidth >= 840 ? 4 : gridWidth >= 600 ? 3 : 2;
  const gap = gridWidth >= 600 ? 16 : 12;
  const columnWidth = Math.max(0, (gridWidth - gap * (columns - 1)) / columns);
  const rowHeight = Math.max(1, ((columnWidth - 2 * CARD_BORDER) * 5) / 4 + 2 * CARD_BORDER);
  const matching = catalog?.templates ?? [];
  const gridWindow = schemeGridWindow({
    itemCount: matching.length,
    columns,
    rowHeight,
    rowGap: gap,
    gridTop: viewport.gridTop,
    scrollY: viewport.scrollY,
    viewportHeight: viewport.viewportHeight,
    overscanRows: 2,
  });
  useLayoutEffect(() => {
    if (pendingFocus === null) return;
    const target = gridRef.current?.querySelector<HTMLElement>(`[data-template-index="${pendingFocus}"]`);
    if (target) {
      target.focus();
      setPendingFocus(null);
    }
  }, [pendingFocus, gridWindow.startIndex, gridWindow.endIndex]);
  // Tab past the rendered rows scrolls the next card into the window before focusing it.
  const focusTemplateAt = (index: number) => {
    const row = Math.floor(index / columns);
    window.scrollTo({ top: viewport.gridTop + row * (rowHeight + gap) - 120, behavior: "auto" });
    setViewport((previous) => ({ ...previous, scrollY: window.scrollY }));
    setPendingFocus(index);
  };
  const remove = async (template: MiniatureTemplate) => {
    try {
      await actions.remove(template.id);
      setSelected(null);
      notify(t("templatesDeleted"));
    } catch {
      /* actions report the error */
    }
  };
  if (initialLoading) return <PageSkeleton page="templates" />;
  return (
    <>
      <PageHeader
        eyebrow={t("templatesLibrary")}
        title={t("templatesPageTitle")}
        body={t("templatesPageBody")}
        action={
          <Button variant="contained" startIcon={<Plus size={17} />} onClick={() => setEditing(null)}>
            {t("templatesNewTemplate")}
          </Button>
        }
      />
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={<Button onClick={() => void catalogQuery.refetch()}>{t("templatesRetry")}</Button>}
        >
          {error}
        </Alert>
      )}
      <FilterToolbar
        search={search}
        setSearch={(value) => {
          setSearch(value);
        }}
        placeholder={t("templatesSearchPlaceholder")}
      >
        <Box
          sx={{
            display: "grid",
            gap: 1,
            "& .MuiInputLabel-root.Mui-focused": { color: "var(--ink-soft)" },
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 16rem), 1fr))",
          }}
        >
          {!!catalogQuery.sourceCounts.length && (
            <TextField
              select
              fullWidth
              size="small"
              label={t("templatesPlugin")}
              value={plugin}
              onChange={(event) => setPlugin(event.target.value)}
            >
              <MenuItem value="ALL">{t("templatesAllPlugins")}</MenuItem>
              {catalogQuery.sourceCounts
                .filter((facet) => facet.key)
                .map((facet) => (
                  <MenuItem key={facet.key} value={facet.key}>
                    {facet.label}
                  </MenuItem>
                ))}
              <MenuItem value="NONE">{t("templatesNoPlugin")}</MenuItem>
            </TextField>
          )}
          <TextField
            select
            fullWidth
            size="small"
            label={t("templatesCategory")}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
            }}
          >
            <MenuItem value="ALL">{t("templatesAllCategories")}</MenuItem>
            {catalogQuery.categories.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </FilterToolbar>
      {!hasGrid ? (
        <EmptyState
          icon={<TemplateCopy size={26} />}
          title={t("templatesEmptyTitle")}
          body={t("templatesEmptyBody")}
        />
      ) : (
        <>
          <Box
            component="p"
            sx={{
              m: 0,
              mb: 1.5,
              fontSize: "0.875rem",
              lineHeight: 10 / 7,
              color: "var(--ink-faint)",
            }}
          >
            {t("templatesTotalCount", {
              count: catalog?.totalCount ?? 0,
              formattedCount: new Intl.NumberFormat(i18n.language).format(catalog?.totalCount ?? 0),
            })}
          </Box>
          <Box ref={gridRef} sx={{ position: "relative" }} style={{ height: gridWindow.totalHeight }}>
            <Box
              sx={{
                position: "absolute",
                insetInline: 0,
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap: `${gap}px`,
              }}
              style={{ top: gridWindow.topOffset }}
            >
              {matching.slice(gridWindow.startIndex, gridWindow.endIndex).map((template, offset) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  index={gridWindow.startIndex + offset}
                  onOpen={() => setSelected(template)}
                  onKeyDown={(event) => {
                    if (event.key !== "Tab") return;
                    const next = gridWindow.startIndex + offset + (event.shiftKey ? -1 : 1);
                    if (next < 0 || next >= matching.length) return;
                    if (next >= gridWindow.startIndex && next < gridWindow.endIndex) return;
                    event.preventDefault();
                    focusTemplateAt(next);
                  }}
                />
              ))}
            </Box>
          </Box>
        </>
      )}
      <Box ref={loadMoreRef} sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
        {catalog?.hasNextPage && (
          <Button onClick={catalogQuery.loadMore} disabled={catalogQuery.loading}>
            {t("templatesLoadMoreTemplates")}
          </Button>
        )}
        {catalogQuery.loading && <Box role="status">{t("templatesLoadingTemplates")}</Box>}
      </Box>
      {selected && (
        <TemplateDetailsDialog
          template={selected}
          confirmingDelete={confirmDeleteId === selected.id}
          onDelete={() =>
            confirmDeleteId === selected.id ? void remove(selected) : setConfirmDeleteId(selected.id)
          }
          onEdit={() => {
            setEditing(selected);
            setSelected(null);
          }}
          onUse={() => {
            onUse(selected.id);
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}
      {editing !== undefined && (
        <TemplateEditorDialog
          template={editing}
          onSaved={async () => {
            setEditing(undefined);
            notify(editing ? t("templatesUpdated") : t("templatesCreated"));
          }}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
