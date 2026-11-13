import { Box, Button } from "@mui/material";
import { useLayoutEffect, useRef, useState } from "react";

import { Heart } from "../icons";
import type { Paint } from "../types";
import { listResetSx } from "../utils/element-resets";
import { schemeGridWindow } from "../utils/scheme-grid-window";

import { PaintChecklistItem } from "./PaintChecklistItem";
import { PaintRowActions } from "./PaintRowActions";
import { ProgressSummaryCard } from "./ProgressSummaryCard";

export type MissingPaint = { paint: Paint; projectCount: number };

// Missing project paints are not on the wishlist until the painter adds them; this offers that step.
export function MissingProjectPaints({
  items,
  listedCount,
  onAdd,
  onAddAll,
}: {
  items: MissingPaint[];
  listedCount: number;
  onAdd(paint: Paint): void;
  onAddAll(): void;
}) {
  if (!items.length) return null;
  const count = items.length;
  const totalNeeded = listedCount + count;
  return (
    <ProgressSummaryCard
      title={`${count} paint${count === 1 ? "" : "s"} your projects need ${count === 1 ? "isn’t" : "aren’t"} on this list`}
      subtitle="Only bottles marked Owned cross off a project checklist."
      progress={(listedCount / totalNeeded) * 100}
      progressLabel={`${listedCount} of ${totalNeeded} missing project paints on the wishlist`}
      hint="Most-needed first. Select a paint to add it to your wishlist."
      action={
        <Button size="small" variant="contained" onClick={onAddAll} startIcon={<Heart size={14} />}>
          Add {count === 1 ? "it" : `all ${count}`}
        </Button>
      }
      sx={{ mb: { xs: 2, lg: 2.5 } }}
      checklist={<MissingPaintChecklist items={items} onAdd={onAdd} />}
    />
  );
}

// The summary only mounts this viewport while expanded. Keep the same auto-fill columns and
// 360px scroll area as the other progress checklists, but mount only visible rows plus overscan.
function MissingPaintChecklist({ items, onAdd }: { items: MissingPaint[]; onAdd: (paint: Paint) => void }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 360, scrollTop: 0, rowHeight: 52 });
  const [pendingFocus, setPendingFocus] = useState<{ index: number; reverse: boolean } | null>(null);
  const [pendingEdge, setPendingEdge] = useState<"Home" | "End" | null>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let frame = 0;
    const measure = () => {
      const row = list.querySelector<HTMLElement>("[data-checklist-index]");
      const next = {
        width: list.clientWidth,
        height: list.clientHeight,
        scrollTop: list.scrollTop,
        rowHeight: row?.getBoundingClientRect().height || 52,
      };
      setViewport((previous) =>
        previous.width === next.width &&
        previous.height === next.height &&
        previous.scrollTop === next.scrollTop &&
        previous.rowHeight === next.rowHeight
          ? previous
          : next,
      );
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(list);
    list.addEventListener("scroll", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      list.removeEventListener("scroll", schedule);
    };
  }, [items.length]);
  const columns = Math.max(1, Math.floor((viewport.width - 16 + 4) / (230 + 4)));
  const listWindow = schemeGridWindow({
    itemCount: items.length,
    columns,
    rowHeight: viewport.rowHeight,
    rowGap: 4,
    gridTop: 8,
    scrollY: viewport.scrollTop,
    viewportHeight: viewport.height,
    overscanRows: 2,
  });
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!pendingEdge || !list) return;
    // Wait for the newly measured column count to reach the DOM before scrolling. This also
    // handles End pressed immediately after a desktop/phone reflow, before ResizeObserver runs.
    list.scrollTop = pendingEdge === "Home" ? 0 : list.scrollHeight;
    setViewport((previous) => ({ ...previous, scrollTop: list.scrollTop }));
    setPendingEdge(null);
  }, [pendingEdge, columns, listWindow.totalHeight]);
  useLayoutEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>("[data-checklist-index]");
    if (!row) return;
    const observer = new ResizeObserver(() => {
      const rowHeight = row.getBoundingClientRect().height;
      if (rowHeight > 0) {
        setViewport((previous) => (previous.rowHeight === rowHeight ? previous : { ...previous, rowHeight }));
      }
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, [listWindow.startIndex, items.length]);
  useLayoutEffect(() => {
    if (!pendingFocus) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-checklist-index="${pendingFocus.index}"]`);
    if (!row) return;
    const controls = [...row.querySelectorAll<HTMLButtonElement>("button")].filter(
      (control) => control.tabIndex >= 0 && !control.disabled,
    );
    (pendingFocus.reverse ? controls.at(-1) : controls[0])?.focus();
    setPendingFocus(null);
  }, [pendingFocus, listWindow.startIndex, listWindow.endIndex]);
  return (
    <Box
      component="ul"
      ref={listRef}
      aria-label="Missing project paints"
      tabIndex={0}
      onKeyDownCapture={(event) => {
        const list = event.currentTarget;
        if (event.target === list && (event.key === "Home" || event.key === "End")) {
          event.preventDefault();
          setViewport((previous) => ({ ...previous, width: list.clientWidth }));
          setPendingEdge(event.key);
          return;
        }
        if (event.key !== "Tab") return;
        const row = (event.target as HTMLElement).closest<HTMLElement>("[data-checklist-index]");
        if (!row) return;
        const controls = [...row.querySelectorAll<HTMLButtonElement>("button")].filter(
          (control) => control.tabIndex >= 0 && !control.disabled,
        );
        const reverse = event.shiftKey;
        if (event.target !== (reverse ? controls[0] : controls.at(-1))) return;
        const next = Number(row.dataset.checklistIndex) + (reverse ? -1 : 1);
        if (next < 0 || next >= items.length) return;
        if (next >= listWindow.startIndex && next < listWindow.endIndex) return;
        event.preventDefault();
        list.scrollTop = Math.floor(next / columns) * (viewport.rowHeight + 4);
        setViewport((previous) => ({ ...previous, scrollTop: list.scrollTop }));
        setPendingFocus({ index: next, reverse });
      }}
      sx={{
        ...listResetSx,
        boxSizing: "border-box",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 230px), 1fr))",
        gap: 0.5,
        p: 1,
        maxHeight: 360,
        overflowY: "auto",
        overscrollBehavior: "contain",
        "&:focus-visible": { outline: "2px solid var(--gold)", outlineOffset: -2 },
      }}
    >
      {listWindow.topOffset > 0 && (
        <li aria-hidden="true" style={{ gridColumn: "1 / -1", height: listWindow.topOffset - 4 }} />
      )}
      {items.slice(listWindow.startIndex, listWindow.endIndex).map(({ paint, projectCount }, offset) => (
        <PaintChecklistItem
          key={paint.id}
          listPosition={{ index: listWindow.startIndex + offset, count: items.length }}
          paint={paint}
          subtitle={`${paint.range} · ${projectCount} project${projectCount === 1 ? "" : "s"}`}
          selectAction="add to wishlist"
          onSelect={() => onAdd(paint)}
          actions={
            <PaintRowActions
              wishlist={{
                label: `Add ${paint.name} to wishlist`,
                title: "Add to wishlist",
                onClick: () => onAdd(paint),
              }}
            />
          }
        />
      ))}
      {listWindow.endRow < listWindow.totalRows && (
        <li
          aria-hidden="true"
          style={{
            gridColumn: "1 / -1",
            height: (listWindow.totalRows - listWindow.endRow) * (viewport.rowHeight + 4) - 4,
          }}
        />
      )}
    </Box>
  );
}
