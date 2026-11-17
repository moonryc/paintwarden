import { appScrollOffset } from "../utils/app-layout";
import { formatNumber } from "../i18n";
import { useTranslation } from "react-i18next";
import { Card } from "@mui/material";
import Box from "@mui/material/Box";
import type { ReactNode } from "react";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import { listResetSx } from "../utils/element-resets";

const ROW_HEIGHT = 66;
// Include padding and borders in this fixed height so long brands cannot change the window geometry.
const HEADER_HEIGHT = 34;
const OVERSCAN = ROW_HEIGHT * 5;

function rowControls(row: Element) {
  return [...row.querySelectorAll<HTMLElement>("button, input[type='checkbox']")].filter(
    (control) => !control.matches(":disabled, [aria-disabled='true']"),
  );
}

type Entry<T> =
  | { kind: "header"; groupIndex: number; top: number; height: number }
  | { kind: "row"; groupIndex: number; top: number; height: number; index: number; position: number; row: T };

// Find the first entry whose bottom is past the requested offset. One flattened window bounds both
// rows and headers, including the many-brands/one-paint-per-brand case.
function entryAt<T>(entries: Entry<T>[], offset: number) {
  let low = 0;
  let high = entries.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const entry = entries[middle];
    if (entry.top + entry.height <= offset) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function WishlistPaintList<T extends { paint: { id: string } }>({
  groups,
  renderRow,
}: {
  groups: readonly (readonly [brand: string, items: readonly T[]])[];
  renderRow: (row: T, position: { index: number; size: number }) => ReactNode;
}) {
  const { t } = useTranslation("components");
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: 0, scrollY: 0, height: 900 });
  const [pendingFocus, setPendingFocus] = useState<{ index: number; reverse: boolean } | null>(null);
  const { entries, rows, totalHeight } = useMemo(() => {
    const entries: Entry<T>[] = [];
    const rows: Extract<Entry<T>, { kind: "row" }>[] = [];
    let top = 0;
    groups.forEach(([, items], groupIndex) => {
      if (groups.length > 1) {
        entries.push({ kind: "header", groupIndex, top, height: HEADER_HEIGHT });
        top += HEADER_HEIGHT;
      }
      items.forEach((row, position) => {
        const entry = {
          kind: "row" as const,
          groupIndex,
          top,
          height: ROW_HEIGHT,
          index: rows.length,
          position,
          row,
        };
        entries.push(entry);
        rows.push(entry);
        top += ROW_HEIGHT;
      });
    });
    return { entries, rows, totalHeight: top };
  }, [groups]);

  useLayoutEffect(() => {
    const element = listRef.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      const next = {
        top: element.getBoundingClientRect().top + window.scrollY,
        scrollY: window.scrollY,
        height: window.innerHeight,
      };
      setViewport((previous) =>
        previous.top === next.top && previous.scrollY === next.scrollY && previous.height === next.height
          ? previous
          : next,
      );
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    // Content above the list (including missing-project paints) can move it without resizing it.
    observer.observe(document.body);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [totalHeight]);

  const start = Math.min(
    Math.max(0, entries.length - 1),
    entryAt(entries, viewport.scrollY - viewport.top - OVERSCAN),
  );
  const end = Math.min(
    entries.length,
    Math.max(start + 1, entryAt(entries, viewport.scrollY + viewport.height - viewport.top + OVERSCAN) + 1),
  );
  const topOffset = entries[start]?.top ?? 0;
  const bottomOffset = entries[end]?.top ?? totalHeight;
  const visibleSections: {
    groupIndex: number;
    header: boolean;
    rows: Extract<Entry<T>, { kind: "row" }>[];
  }[] = [];
  for (const entry of entries.slice(start, end)) {
    let section = visibleSections.at(-1);
    if (section?.groupIndex !== entry.groupIndex) {
      section = { groupIndex: entry.groupIndex, header: false, rows: [] };
      visibleSections.push(section);
    }
    if (entry.kind === "header") section.header = true;
    else section.rows.push(entry);
  }

  useLayoutEffect(() => {
    if (!pendingFocus) return;
    const lists = listRef.current?.querySelectorAll<HTMLUListElement>("ul[data-wishlist-start]");
    for (const list of lists ?? []) {
      const index = pendingFocus.index - Number(list.dataset.wishlistStart);
      const row = list.children.item(index);
      if (!row) continue;
      const controls = rowControls(row);
      (pendingFocus.reverse ? controls.at(-1) : controls[0])?.focus();
      setPendingFocus(null);
      return;
    }
    // The target may have been removed by an action/filter while navigation was pending.
    if (pendingFocus.index >= rows.length) setPendingFocus(null);
  }, [pendingFocus, start, end, rows.length]);

  return (
    <Card
      component="div"
      ref={listRef}
      onKeyDownCapture={(event) => {
        if (event.key !== "Tab" || !(event.target instanceof HTMLElement)) return;
        const row = event.target.closest("li");
        const list = row?.parentElement;
        if (!row || !list?.matches("ul[data-wishlist-start]")) return;
        const reverse = event.shiftKey;
        // QuantityCounter's editable input is a native tab stop while its +/- buttons have
        // tabIndex=-1. Detect the boundary using every tab stop, not just the safe focus targets.
        const direction = reverse ? Node.DOCUMENT_POSITION_PRECEDING : Node.DOCUMENT_POSITION_FOLLOWING;
        const targetElement = event.target;
        const hasNextTabStop = [
          ...row.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]"),
        ].some(
          (control) =>
            control.tabIndex >= 0 &&
            !control.matches(":disabled, [aria-disabled='true']") &&
            Boolean(targetElement.compareDocumentPosition(control) & direction),
        );
        if (hasNextTabStop) return;
        const index = Number(list.dataset.wishlistStart) + [...list.children].indexOf(row);
        const next = reverse ? index - 1 : index + 1;
        const target = rows[next];
        if (!target) return; // Preserve normal Tab exit before the first and after the final row.
        const flatIndex = next + (groups.length > 1 ? target.groupIndex + 1 : 0);
        if (flatIndex >= start && flatIndex < end) return;
        event.preventDefault();
        window.scrollTo({ top: viewport.top + target.top - appScrollOffset(), behavior: "auto" });
        setViewport((previous) => ({ ...previous, scrollY: window.scrollY }));
        setPendingFocus({ index: next, reverse });
      }}
      sx={{ boxSizing: "border-box", overflow: "hidden" }}
    >
      {topOffset > 0 && <div aria-hidden="true" style={{ height: topOffset }} />}
      {visibleSections.map((section) => {
        const [brand, items] = groups[section.groupIndex];
        const headingId = `${id}-brand-${section.groupIndex}`;
        return (
          <Box
            component="section"
            key={brand}
            aria-labelledby={section.header ? headingId : undefined}
            aria-label={section.header ? undefined : brand}
          >
            {section.header && (
              <Box
                component="h3"
                id={headingId}
                sx={{
                  boxSizing: "border-box",
                  height: HEADER_HEIGHT,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                  px: { xs: 2, md: 2.5 },
                  bgcolor: "var(--sunken)",
                  borderTop: section.groupIndex > 0 ? "1px solid var(--line)" : 0,
                  borderBottom: "1px solid var(--line)",
                  color: "var(--ink-soft)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  m: 0,
                }}
              >
                <Box
                  component="span"
                  sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {brand}
                </Box>
                <Box component="span" sx={{ color: "var(--ink-faint)", flexShrink: 0 }}>
                  {formatNumber(items.length)}
                </Box>
              </Box>
            )}
            {section.rows.length > 0 && (
              <Box
                component="ul"
                data-wishlist-start={section.rows[0].index}
                aria-label={t("wishlistBrandPaints", { brand, count: items.length })}
                sx={{
                  ...listResetSx,
                  boxSizing: "border-box",
                  "& > :where(:not(:last-child))": { borderBottom: "1px solid var(--line)" },
                  "& > :last-child": {
                    borderBottom: section.rows.at(-1)?.row !== items.at(-1) ? "1px solid var(--line)" : 0,
                  },
                }}
              >
                {section.rows.map(({ row, position }) =>
                  renderRow(row, { index: position, size: items.length }),
                )}
              </Box>
            )}
          </Box>
        );
      })}
      {bottomOffset < totalHeight && (
        <div aria-hidden="true" style={{ height: totalHeight - bottomOffset }} />
      )}
    </Card>
  );
}
