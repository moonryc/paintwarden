import { Alert, Button, MenuItem, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "../../Components/EmptyState";
import { FilterPluginSelect, useFilterPlugin } from "../../Components/FilterPlugin";
import { FilterToolbar } from "../../Components/FilterToolbar";
import { PageHeader } from "../../Components/PageHeader";
import { Plus, TemplateCopy } from "../../icons";
import { useVaultStore } from "../../store/hooks";
import { useTemplateCatalog } from "../../store/template-hooks";
import type { MiniatureTemplate } from "../../types";
import { schemeGridWindow } from "../../utils/scheme-grid-window";
import { useFuzzySearch } from "../../utils/use-fuzzy-search";

import { TemplateCard } from "./TemplateCard";
import { TemplateDetailsDialog } from "./TemplateDetailsDialog";
import { TemplateEditorDialog } from "./TemplateEditorDialog";

// Cards are outlined (1px border) around a 4:5 image, so their height follows the column width.
const CARD_BORDER = 1;
const templateSearchText = (template: MiniatureTemplate) =>
  [template.name, template.faction, template.manufacturer].join(" ");

export function MiniatureTemplatesPage({ onUse }: { onUse(id: string): void }) {
  const api = useVaultStore((s) => s.api);
  const notify = useVaultStore((s) => s.notify);
  const catalogQuery = useTemplateCatalog();
  const catalog = catalogQuery.data;
  const error = catalogQuery.error?.message;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [editing, setEditing] = useState<MiniatureTemplate | null | undefined>();
  const [selected, setSelected] = useState<MiniatureTemplate | null>(null);
  // The template whose Delete was clicked once; a second click deletes it.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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
  const templates = useMemo(() => catalog?.templates ?? [], [catalog]);
  const pluginFilter = useFilterPlugin(templates);
  const matchesPlugin = pluginFilter.matches;
  const searchCandidates = useMemo(
    () =>
      templates.filter(
        (template) =>
          (category === "ALL" || template.categories.includes(category)) && matchesPlugin(template),
      ),
    [templates, category, matchesPlugin],
  );
  const matching = useFuzzySearch(searchCandidates, search, templateSearchText);
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
      await api("/api/miniature-templates", { method: "DELETE", body: JSON.stringify({ id: template.id }) });
      setSelected(null);
      notify("Template deleted");
    } catch {
      /* api reports the error */
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Miniature templates"
        body="Browse templates from your catalog sources or save a reusable setup of your own."
        action={
          <Button variant="contained" startIcon={<Plus size={17} />} onClick={() => setEditing(null)}>
            New template
          </Button>
        }
      />
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={<Button onClick={() => void catalogQuery.refetch()}>Retry</Button>}
        >
          {error}
        </Alert>
      )}
      <FilterToolbar
        search={search}
        setSearch={(value) => {
          setSearch(value);
        }}
        placeholder="Search templates…"
      >
        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: {
              xs: "1fr",
              sm: pluginFilter.plugins.length ? "repeat(2, minmax(0, 1fr))" : "1fr",
            },
          }}
        >
          <FilterPluginSelect filter={pluginFilter} />
          <TextField
            select
            fullWidth
            size="small"
            label="Category"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
            }}
          >
            <MenuItem value="ALL">All categories</MenuItem>
            {catalog?.categories.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </FilterToolbar>
      {catalog && templates.length === 0 ? (
        <EmptyState
          icon={<TemplateCopy size={26} />}
          title="No templates yet"
          body="Install a plugin with miniature templates from Data & settings → Plugins, or use New template to save a reusable setup of your own."
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
            {matching.length.toLocaleString()} templates
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
            notify(editing ? "Template updated" : "Template created");
          }}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
