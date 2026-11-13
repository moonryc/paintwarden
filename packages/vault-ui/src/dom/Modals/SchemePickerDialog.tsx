import { Button, ButtonBase, InputAdornment, MenuItem, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import {
  COLOR_CATEGORIES,
  COLOR_CATEGORY_LABELS,
  type ColorCategory,
} from "@paint-vault/core/color-categories";
import { isPaintAvailable } from "@paint-vault/core/paint-substitutions";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { Modal } from "../Components/Modal";
import { SchemeChip } from "../Components/SchemeChip";
import { SchemeSwatch } from "../Components/SchemeSwatch";
import { Check, Plus, Search } from "../icons";
import { useVault } from "../store/hooks";
import type { ColorScheme } from "../types";
import { schemeGridWindow } from "../utils/scheme-grid-window";
import { schemePaintRows } from "../utils/scheme-order";
import { truncateSx } from "../utils/truncate";
import { useFuzzySearch } from "../utils/use-fuzzy-search";

const schemeSearchText = (scheme: ColorScheme) =>
  `${scheme.name} ${scheme.category ? COLOR_CATEGORY_LABELS[scheme.category] : ""}`;

type Filter = "ALL" | "SELECTED" | ColorCategory;

// Each row is 56px tall with a 1px separator; only rows near the list viewport are rendered.
const ROW_HEIGHT = 56;
const ROW_GAP = 1;
// Picked schemes beyond this collapse behind a "+N more" chip.
const COLLAPSED_CHIPS = 3;

// Picks are staged here and added together, so browsing the list never edits the miniature.
// Schemes already on the miniature are hidden; remove those from their cards instead.
export function SchemePickerDialog({
  attachedIds,
  onSave,
  onClose,
}: {
  attachedIds: string[];
  onSave(schemeIds: string[]): Promise<unknown>;
  onClose(): void;
}) {
  const data = useVault();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const listRef = useRef<HTMLUListElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const [pendingFocus, setPendingFocus] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [chipsExpanded, setChipsExpanded] = useState(false);

  const counts = useMemo(() => {
    const result = new Map<string, { available: number; total: number }>();
    for (const scheme of data.colorSchemes) {
      const paintIds = new Set(schemePaintRows(data, scheme.id).map((row) => row.paintId));
      let available = 0;
      for (const paintId of paintIds) if (isPaintAvailable(data, data.paintRecords, paintId)) available += 1;
      result.set(scheme.id, { available, total: paintIds.size });
    }
    return result;
  }, [data]);

  const available = useMemo(
    () => data.colorSchemes.filter((scheme) => !attachedIds.includes(scheme.id)),
    [attachedIds, data.colorSchemes],
  );
  const categories = COLOR_CATEGORIES.map((category) => ({
    category,
    count: available.filter((scheme) => scheme.category === category).length,
  })).filter((item) => item.count > 0);

  const query = search.trim();
  const pool = useMemo(
    () =>
      available.filter((scheme) =>
        filter === "ALL"
          ? true
          : filter === "SELECTED"
            ? selected.includes(scheme.id)
            : scheme.category === filter,
      ),
    [available, filter, selected],
  );
  const searchMatches = useFuzzySearch(pool, query, schemeSearchText);
  const alphabetical = useMemo(
    () => [...pool].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [pool],
  );
  const matches = query ? searchMatches : alphabetical;
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => setListHeight(list.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);
  const listWindow = schemeGridWindow({
    itemCount: matches.length,
    columns: 1,
    rowHeight: ROW_HEIGHT,
    rowGap: ROW_GAP,
    gridTop: 0,
    scrollY: scrollTop,
    // Before the first measurement, render enough rows to fill the tallest list.
    viewportHeight: listHeight || 800,
    overscanRows: 4,
  });
  const visible = matches.slice(listWindow.startIndex, listWindow.endIndex);
  const renderedHeight = visible.length ? visible.length * (ROW_HEIGHT + ROW_GAP) - ROW_GAP : 0;
  useLayoutEffect(() => {
    if (pendingFocus === null) return;
    const target = listRef.current?.querySelector<HTMLElement>(`[data-scheme-index="${pendingFocus}"]`);
    if (target) {
      target.focus({ preventScroll: true });
      setPendingFocus(null);
    }
  }, [pendingFocus, listWindow.startIndex, listWindow.endIndex]);
  // Tab moves row by row, scrolling the next row into view before focusing it, so focus
  // never lands on a row that virtual scrolling is about to remove.
  const focusRow = (index: number) => {
    const list = listRef.current;
    if (!list) return;
    const top = index * (ROW_HEIGHT + ROW_GAP);
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + ROW_HEIGHT > list.scrollTop + list.clientHeight)
      list.scrollTop = top + ROW_HEIGHT - list.clientHeight;
    setScrollTop(list.scrollTop);
    setPendingFocus(index);
  };
  const resetScroll = () => {
    if (listRef.current) listRef.current.scrollTop = 0;
    setScrollTop(0);
  };

  const picked = selected
    .map((id) => data.colorSchemes.find((scheme) => scheme.id === id))
    .filter((scheme) => scheme !== undefined);
  const changed = picked.length > 0;
  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave([...attachedIds, ...picked.map((scheme) => scheme.id)]);
      onClose();
    } catch {
      setSaving(false);
    }
  };
  const plural = (count: number) => `${count} scheme${count === 1 ? "" : "s"}`;
  const summary = changed
    ? `${plural(picked.length)} to add`
    : attachedIds.length
      ? `${plural(attachedIds.length)} already on this miniature`
      : "Choose schemes to add";

  return (
    <Modal
      title="Color schemes"
      subtitle="Pick schemes to add to this miniature. Nothing changes until you save."
      onClose={onClose}
      fillBody
      footer={
        <>
          <Box
            component="span"
            aria-live="polite"
            sx={{ flex: 1, minWidth: 140, fontSize: 13, color: changed ? "var(--ink)" : "var(--ink-faint)" }}
          >
            {summary}
          </Box>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save} disabled={!changed || saving}>
            {saving ? "Adding…" : picked.length > 1 ? `Add ${picked.length} schemes` : "Add scheme"}
          </Button>
        </>
      }
    >
      <TextField
        fullWidth
        size="small"
        sx={{ flexShrink: 0 }}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          resetScroll();
        }}
        placeholder="Search schemes or colors…"
        slotProps={{
          htmlInput: { "aria-label": "Search color schemes" },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search size={16} />
              </InputAdornment>
            ),
          },
        }}
      />
      <TextField
        select
        fullWidth
        size="small"
        label="Filter schemes"
        value={filter}
        onChange={(event) => {
          setFilter(event.target.value as Filter);
          resetScroll();
        }}
        sx={{ flexShrink: 0, mt: 1.5 }}
      >
        <MenuItem value="ALL">All ({available.length})</MenuItem>
        <MenuItem value="SELECTED">Selected ({selected.length})</MenuItem>
        {categories.map(({ category, count }) => (
          <MenuItem key={category} value={category}>
            {COLOR_CATEGORY_LABELS[category]} ({count})
          </MenuItem>
        ))}
      </TextField>

      <Box
        component="ul"
        ref={listRef}
        aria-label="Color schemes"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        sx={{
          listStyle: "none",
          m: 0,
          mt: 1.5,
          p: 0,
          border: "1px solid var(--line)",
          borderRadius: "16px",
          overflowY: "auto",
          overscrollBehavior: "contain",
          // On phones the list fills the full-screen sheet and scrolls on its own.
          flex: { xs: "1 1 auto", sm: "none" },
          minHeight: { xs: 0, sm: "auto" },
          maxHeight: { xs: "none", sm: "max(calc(min(52dvh, 460px) - 171px), 120px)" }, // About three rows shorter than the old cap, never under two rows.
          bgcolor: "var(--surface-raised)",
        }}
      >
        {listWindow.topOffset > 0 && <li aria-hidden="true" style={{ height: listWindow.topOffset }} />}
        {visible.length ? (
          visible.map((scheme, offset) => {
            const on = selected.includes(scheme.id);
            const { available, total } = counts.get(scheme.id) ?? { available: 0, total: 0 };
            return (
              <Box
                component="li"
                key={scheme.id}
                aria-posinset={listWindow.startIndex + offset + 1}
                aria-setsize={matches.length}
                sx={{
                  boxSizing: "border-box",
                  height: ROW_HEIGHT,
                  "& + &": { height: ROW_HEIGHT + ROW_GAP, borderTop: "1px solid var(--line)" },
                }}
              >
                <ButtonBase
                  onClick={() => toggle(scheme.id)}
                  onKeyDown={(event) => {
                    if (event.key !== "Tab") return;
                    const next = listWindow.startIndex + offset + (event.shiftKey ? -1 : 1);
                    if (next < 0 || next >= matches.length) return;
                    event.preventDefault();
                    focusRow(next);
                  }}
                  data-scheme-index={listWindow.startIndex + offset}
                  aria-pressed={on}
                  aria-label={scheme.name}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    width: "100%",
                    height: ROW_HEIGHT,
                    px: 1.5,
                    textAlign: "left",
                    bgcolor: on ? "color-mix(in oklab, var(--brand-soft) 55%, transparent)" : "transparent",
                    "&:hover": { bgcolor: on ? "var(--brand-soft)" : "var(--sunken)" },
                  }}
                >
                  <SchemeSwatch schemeId={scheme.id} />
                  <Box component="span" sx={{ minWidth: 0, flex: 1 }}>
                    <Box
                      component="span"
                      sx={{
                        display: "block",
                        fontSize: 14,
                        fontWeight: 700,
                        ...truncateSx,
                      }}
                    >
                      {scheme.name}
                    </Box>
                    <Box component="span" sx={{ display: "block", fontSize: 12, color: "var(--ink-faint)" }}>
                      {scheme.category ? COLOR_CATEGORY_LABELS[scheme.category] : "Uncategorized"} ·{" "}
                      {total === 0
                        ? "No paints"
                        : available === total
                          ? `All ${total} paints on hand`
                          : `${available} of ${total} paints on hand`}
                    </Box>
                  </Box>
                  <Box
                    component="span"
                    aria-hidden="true"
                    sx={{
                      display: "grid",
                      placeItems: "center",
                      width: 30,
                      height: 30,
                      flexShrink: 0,
                      borderRadius: "50%",
                      border: on ? "0" : "1.5px solid var(--line-strong)",
                      bgcolor: on ? "var(--brand)" : "transparent",
                      color: on ? "var(--brand-fg, #fff)" : "var(--ink-faint)",
                    }}
                  >
                    {on ? <Check size={16} /> : <Plus size={16} />}
                  </Box>
                </ButtonBase>
              </Box>
            );
          })
        ) : (
          <Box component="li" sx={{ p: 4, textAlign: "center", fontSize: 14, color: "var(--ink-faint)" }}>
            {!data.colorSchemes.length
              ? "Create a color scheme on the Schemes page first."
              : !available.length
                ? "Every scheme is already on this miniature."
                : query
                  ? `No schemes match “${query}”.`
                  : "No schemes in this filter."}
          </Box>
        )}
        {visible.length > 0 && listWindow.totalHeight > listWindow.topOffset + renderedHeight && (
          <li
            aria-hidden="true"
            style={{ height: listWindow.totalHeight - listWindow.topOffset - renderedHeight }}
          />
        )}
      </Box>

      {picked.length > 0 && (
        <Box sx={{ flexShrink: 0, mt: 1.5 }}>
          <Box sx={{ mb: 0.75, fontSize: 12, fontWeight: 650, color: "var(--ink-faint)" }}>To add</Box>
          <Box
            component="ul"
            aria-label="Schemes to add"
            sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexWrap: "wrap", gap: 0.75 }}
          >
            {(chipsExpanded ? picked : picked.slice(0, COLLAPSED_CHIPS)).map((scheme) => (
              <Box component="li" key={scheme.id} sx={{ display: "flex", minWidth: 0, maxWidth: "100%" }}>
                <SchemeChip scheme={scheme} size="md" onRemove={() => toggle(scheme.id)} />
              </Box>
            ))}
            {picked.length > COLLAPSED_CHIPS && (
              <Box component="li" sx={{ display: "flex" }}>
                <ButtonBase
                  onClick={() => setChipsExpanded((value) => !value)}
                  aria-expanded={chipsExpanded}
                  sx={{
                    px: 1.25,
                    minHeight: 30,
                    border: "1px dashed var(--line-strong)",
                    borderRadius: 999,
                    color: "var(--ink-soft)",
                    fontSize: 13,
                    fontWeight: 600,
                    "&:hover": { bgcolor: "var(--sunken)", color: "var(--ink)" },
                    "&:focus-visible": { outline: "2px solid var(--gold)", outlineOffset: 2 },
                  }}
                >
                  {chipsExpanded ? "Show less" : `+${picked.length - COLLAPSED_CHIPS} more`}
                </ButtonBase>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Modal>
  );
}
