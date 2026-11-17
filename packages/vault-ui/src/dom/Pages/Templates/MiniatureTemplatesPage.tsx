import { appScrollOffset } from "../../utils/app-layout";
import { Button, MenuItem, Skeleton, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { BulkDeleteDialog } from "../../Components/BulkDeleteDialog";
import { AddMiniatureTile } from "../../Components/AddMiniatureTile";
import { FilterToolbar, filterGridSx } from "../../Components/FilterToolbar";
import { FolderBrowser } from "../../Components/FolderBrowser";
import { FolderNameDialog } from "../../Components/FolderNameDialog";
import { FolderPicker } from "../../Components/FolderPicker";
import type { FolderView } from "../../Components/FolderTile";
import { PageHeader } from "../../Components/PageHeader";
import { QueryErrorNotice } from "../../Components/QueryErrorNotice";
import { SelectionBar } from "../../Components/SelectionBar";
import { useFolderBrowser, useFolderCommands } from "../../graphql/folder-hooks";
import { useFolderSearch } from "../../graphql/folder-search-hooks";
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
  const { t, i18n } = useTranslation(["pages", "components"]);
  const actions = useTemplateActions();
  const notify = useVaultStore((s) => s.notify);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [plugin, setPlugin] = useState("ALL");
  const browser = useFolderBrowser("templates", "TEMPLATE", search);
  const commands = useFolderCommands();
  const selectedNames = useRef(new Map<string, string>());
  const [deleting, setDeleting] = useState<{ id: string; name: string }[] | null>(null);
  const [addingFolder, setAddingFolder] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Checkboxes, and tapping a card to select it, only while edit mode is on.
  const [selectMode, setSelectMode] = useState(false);
  const [movingIds, setMovingIds] = useState<string[] | null>(null);
  useEffect(() => {
    setSelectedIds([]);
  }, [browser.folderId, browser.flat, search, category, plugin]);
  const catalogQuery = useTemplateCatalog(true, {
    search,
    folderId: browser.flat ? null : browser.folderId,
    flat: browser.flat || Boolean(search.trim()),
    category: category === "ALL" ? null : category,
    sourceId: plugin === "ALL" || plugin === "NONE" ? null : plugin,
    noSource: plugin === "NONE",
  });
  const mixedSearch = useFolderSearch({
    kind: "TEMPLATE",
    search,
    folderId: browser.flat ? null : browser.folderId,
    category: category === "ALL" ? null : category,
    sourceId: plugin === "ALL" || plugin === "NONE" ? null : plugin,
    noSource: plugin === "NONE",
  });
  const searching = Boolean(search.trim());
  const catalog = catalogQuery.data;
  const error = searching ? mixedSearch.error : catalogQuery.error?.message;
  const loadMore = searching ? mixedSearch.loadMore : catalogQuery.loadMore;
  const retry = searching ? mixedSearch.retry : catalogQuery.refetch;
  const loading = searching ? mixedSearch.loading || mixedSearch.refreshing : catalogQuery.loading;
  const hasNextPage = searching ? mixedSearch.hasNextPage : catalog?.hasNextPage;
  const totalCount = searching ? mixedSearch.totalCount : (catalog?.totalCount ?? 0);
  const initialLoading = useInitialPageLoading(loading, Boolean(error));
  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasNextPage || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, loading, loadMore]);
  const [editing, setEditing] = useState<MiniatureTemplate | null | undefined>();
  const [selected, setSelected] = useState<MiniatureTemplate | null>(null);
  // The template whose Delete was clicked once; a second click deletes it.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
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
  }, []);
  const { gridWidth } = viewport;
  const columns = gridWidth >= 1100 ? 5 : gridWidth >= 840 ? 4 : gridWidth >= 600 ? 3 : 2;
  const gap = gridWidth >= 600 ? 16 : 12;
  const columnWidth = Math.max(0, (gridWidth - gap * (columns - 1)) / columns);
  const rowHeight = Math.max(1, ((columnWidth - 2 * CARD_BORDER) * 5) / 4 + 2 * CARD_BORDER);
  const matching = useMemo(
    () => (searching ? mixedSearch.templates : (catalog?.templates ?? [])),
    [searching, mixedSearch.templates, catalog?.templates],
  );
  useEffect(() => {
    for (const item of matching) {
      if (selectedIds.includes(item.id)) selectedNames.current.set(item.id, item.name);
    }
  }, [matching, selectedIds]);
  const folders = searching ? mixedSearch.folders : browser.visibleFolders;
  // The add tile leads the grid (not while searching), then folders, then templates.
  const gridItems: (MiniatureTemplate | FolderView | null | "loading" | "add-folder")[] = initialLoading
    ? [
        null,
        ...(!browser.flat && selectMode ? ["add-folder" as const] : []),
        ...Array.from({ length: 9 }, () => "loading" as const),
      ]
    : [
        ...(searching ? [] : [null, ...(!browser.flat && selectMode ? ["add-folder" as const] : [])]),
        ...folders,
        ...matching,
      ];
  const gridWindow = schemeGridWindow({
    itemCount: gridItems.length,
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
    const target = gridRef.current?.querySelector<HTMLElement>(
      `[data-template-index="${pendingFocus}"], [data-folder-index="${pendingFocus}"] button`,
    );
    if (target) {
      target.focus();
      setPendingFocus(null);
    }
  }, [pendingFocus, gridWindow.startIndex, gridWindow.endIndex]);
  // Tab past the rendered rows scrolls the next card into the window before focusing it.
  const focusTemplateAt = (index: number) => {
    const row = Math.floor(index / columns);
    window.scrollTo({
      top: viewport.gridTop + row * (rowHeight + gap) - appScrollOffset(),
      behavior: "auto",
    });
    setViewport((previous) => ({ ...previous, scrollY: window.scrollY }));
    setPendingFocus(index);
  };
  const toggleSelected = (id: string) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id]));
  const remove = async (template: MiniatureTemplate) => {
    try {
      await actions.remove(template.id);
      setSelected(null);
      notify(t("templatesDeleted"));
    } catch {
      /* actions report the error */
    }
  };
  return (
    <Box sx={{ minWidth: 0 }}>
      <PageHeader
        eyebrow={t("templatesLibrary")}
        title={t("templatesPageTitle")}
        body={t("templatesPageBody")}
      />
      {error && <QueryErrorNotice error={error} onRetry={() => void retry()} />}
      <FilterToolbar
        search={search}
        setSearch={(value) => {
          setSearch(value);
        }}
        placeholder={t("templatesSearchPlaceholder")}
      >
        <Box sx={filterGridSx}>
          <TextField
            select
            fullWidth
            size="small"
            label={t("templatesPlugin")}
            value={plugin}
            disabled={initialLoading}
            slotProps={{
              select: { renderValue: initialLoading ? () => t("components:loading") : undefined },
            }}
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
          <TextField
            select
            fullWidth
            size="small"
            label={t("templatesCategory")}
            value={category}
            disabled={initialLoading}
            slotProps={{
              select: { renderValue: initialLoading ? () => t("components:loading") : undefined },
            }}
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
      <FolderBrowser
        browser={{
          ...browser,
          visibleFolders: folders,
          navigate: (id) => {
            setSearch("");
            browser.navigate(id);
          },
        }}
        kind="template"
        editing={selectMode}
        onEditingChange={(next) => {
          setSelectMode(next);
          if (!next) setSelectedIds([]);
        }}
      >
        {(renderFolder) => (
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
              {initialLoading
                ? t("components:loading")
                : searching
                  ? t("folders.resultsCount", { count: totalCount })
                  : t("templatesTotalCount", {
                      count: totalCount,
                      formattedCount: new Intl.NumberFormat(i18n.language).format(totalCount),
                    })}
            </Box>
            <Box
              ref={gridRef}
              aria-busy={loading}
              aria-label={t("templatesPageTitle")}
              data-skeleton={initialLoading ? "templates" : undefined}
              sx={{ position: "relative", minWidth: 0 }}
              style={{ height: gridWindow.totalHeight }}
            >
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
                {gridItems.slice(gridWindow.startIndex, gridWindow.endIndex).map((template, offset) =>
                  template === "loading" ? (
                    <Skeleton
                      key={`loading:${offset}`}
                      aria-hidden="true"
                      variant="rounded"
                      animation={false}
                      sx={{ height: rowHeight, minWidth: 0 }}
                    />
                  ) : template === "add-folder" ? (
                    <AddMiniatureTile
                      key="add-folder"
                      folder
                      title={t("folders.addFolder")}
                      onClick={() => setAddingFolder(true)}
                      sx={{ width: "100%", height: "100%" }}
                    />
                  ) : template && "recursiveCount" in template ? (
                    <Box
                      key={`folder:${template.id}`}
                      data-folder-index={gridWindow.startIndex + offset}
                      sx={{ minWidth: 0 }}
                    >
                      {renderFolder(template, { width: "100%", height: "100%" })}
                    </Box>
                  ) : template ? (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      index={gridWindow.startIndex + offset}
                      checked={selectedIds.includes(template.id)}
                      onSelect={selectMode ? () => toggleSelected(template.id) : undefined}
                      onOpen={() => (selectMode ? toggleSelected(template.id) : setSelected(template))}
                      onKeyDown={(event) => {
                        if (event.key !== "Tab") return;
                        const next = gridWindow.startIndex + offset + (event.shiftKey ? -1 : 1);
                        if (next < 0 || next >= gridItems.length) return;
                        if (next >= gridWindow.startIndex && next < gridWindow.endIndex) return;
                        event.preventDefault();
                        focusTemplateAt(next);
                      }}
                    />
                  ) : (
                    <AddMiniatureTile
                      key="add"
                      title={t("folders.addTemplate")}
                      onClick={() => setAdding(true)}
                      sx={{ width: "100%", height: "100%" }}
                    />
                  ),
                )}
              </Box>
            </Box>
          </>
        )}
      </FolderBrowser>
      <SelectionBar
        count={selectedIds.length}
        onMove={() => setMovingIds(selectedIds)}
        onDelete={() =>
          setDeleting(selectedIds.map((id) => ({ id, name: selectedNames.current.get(id) ?? id })))
        }
        onClear={() => setSelectedIds([])}
      />
      <Box ref={loadMoreRef} sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
        {hasNextPage && (
          <Button onClick={loadMore} disabled={loading}>
            {t("templatesLoadMoreTemplates")}
          </Button>
        )}
      </Box>
      {selected && (
        <TemplateDetailsDialog
          template={selected}
          onMove={() => {
            setMovingIds([selected.id]);
            setSelected(null);
          }}
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
      {movingIds && (
        <FolderPicker
          folders={browser.folders}
          onMove={async (destination) => {
            await browser.moveItems(movingIds, destination);
            setMovingIds(null);
            setSelectedIds([]);
          }}
          onClose={() => setMovingIds(null)}
        />
      )}
      {deleting && (
        <BulkDeleteDialog
          items={deleting}
          kind="TEMPLATE"
          onClose={() => setDeleting(null)}
          onDelete={async () => {
            await commands.deleteItems(
              "TEMPLATE",
              deleting.map((item) => item.id),
            );
            setSelectedIds([]);
            setSelectMode(false);
            notify(t("folders.deletedItems", { count: deleting.length }));
          }}
        />
      )}
      {adding && (
        <TemplateEditorDialog
          template={null}
          folderId={browser.flat ? null : browser.folderId}
          onSaved={async () => {
            setAdding(false);
            notify(t("templatesCreated"));
          }}
          onClose={() => setAdding(false)}
        />
      )}
      {addingFolder && (
        <FolderNameDialog
          title={t("folders.createFolder")}
          onSave={(name) => browser.create(name)}
          onClose={() => setAddingFolder(false)}
        />
      )}
      {editing !== undefined && (
        <TemplateEditorDialog
          template={editing}
          folderId={browser.flat ? null : browser.folderId}
          onSaved={async () => {
            setEditing(undefined);
            notify(editing ? t("templatesUpdated") : t("templatesCreated"));
          }}
          onClose={() => setEditing(undefined)}
        />
      )}
    </Box>
  );
}
