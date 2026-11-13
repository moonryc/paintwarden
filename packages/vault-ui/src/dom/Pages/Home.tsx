import { Alert, Button, ButtonBase, Card, CircularProgress, MenuItem, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { AddMiniatureTile } from "../Components/AddMiniatureTile";
import { EmptyState } from "../Components/EmptyState";
import { FilterToolbar } from "../Components/FilterToolbar";
import { MiniatureTile } from "../Components/MiniatureTile";
import { PageHeader } from "../Components/PageHeader";
import { PageSkeleton } from "../Components/PageSkeletons";
import { SectionHeader } from "../Components/SectionHeader";
import { useMiniatureList } from "../graphql/miniature-list-hooks";
import type { MiniatureTileProjection } from "../graphql/miniature-list-model";
import { Archive, Plus, SearchX } from "../icons";
import { useVaultStore } from "../store/hooks";
import { up } from "../theme-tokens";
import type { PaintingStatus } from "../types";
import { STAGES } from "../utils/constants";
import { greeting } from "../utils/misc";
import { schemeGridWindow } from "../utils/scheme-grid-window";
import { visuallyHiddenSx } from "../utils/visually-hidden";

import { useInitialPageLoading } from "./useInitialPageLoading";

const shelfTileSx = { width: "100%", height: "100%" };

export function Home({ view, onAdd }: { view: "dashboard" | "miniatures"; onAdd(): void }) {
  const filter = useVaultStore((s) => s.miniatureFilter);
  const setFilter = useVaultStore((s) => s.setMiniatureFilter);
  const goTab = useVaultStore((s) => s.go);
  const openMini = useVaultStore((s) => s.openMini);
  const [search, setSearch] = useState(""),
    q = search.trim();
  const [stageFilter, setStageFilter] = useState<PaintingStatus | "ALL">("ALL");
  const workbench = view === "dashboard";
  const list = useMiniatureList({ workbench, ownership: filter, stage: stageFilter, search: q });
  const {
    rows: visibleProjects,
    statusCounts,
    stageCounts,
    ready,
    missingProjectPaints,
    wishlistedMissingPaints,
    loading,
    refreshing,
    hasNextPage,
    loadMore,
  } = list;
  const initialLoading = useInitialPageLoading(loading, Boolean(list.error));
  const pct = list.owned ? (ready / list.owned) * 100 : 0;
  const shelfItems: (MiniatureTileProjection | null)[] = q ? visibleProjects : [null, ...visibleProjects];
  const hasQuery = Boolean(q);
  // The add tile is still one item while an empty vault loads. Track whether the
  // shelf actually exists, not just its item count, so its first mount is measured.
  const hasShelf = visibleProjects.length > 0 || (!q && !loading && !list.error);
  const shelfRef = useRef<HTMLDivElement>(null);
  const [shelfViewport, setShelfViewport] = useState({
    gridTop: 0,
    scrollY: 0,
    viewportHeight: 900,
    width: 0,
  });
  const [pendingShelfFocus, setPendingShelfFocus] = useState<{ index: number; origin: HTMLElement } | null>(
    null,
  );
  useEffect(() => {
    const cancelOutside = (event: PointerEvent) => {
      if (!shelfRef.current?.contains(event.target as Node)) setPendingShelfFocus(null);
    };
    document.addEventListener("pointerdown", cancelOutside, true);
    return () => document.removeEventListener("pointerdown", cancelOutside, true);
  }, []);
  useEffect(() => setPendingShelfFocus(null), [q, filter, stageFilter, workbench]);
  useLayoutEffect(() => {
    const shelf = shelfRef.current;
    if (!shelf) return;
    let frame = 0;
    const measure = () => {
      const next = {
        gridTop: shelf.getBoundingClientRect().top + window.scrollY,
        scrollY: window.scrollY,
        viewportHeight: window.innerHeight,
        width: shelf.clientWidth,
      };
      setShelfViewport((previous) =>
        previous.gridTop === next.gridTop &&
        previous.scrollY === next.scrollY &&
        previous.viewportHeight === next.viewportHeight &&
        previous.width === next.width
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
    observer.observe(shelf);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [shelfItems.length, hasQuery, hasShelf]);
  const shelfColumns =
    shelfViewport.width >= 1100 ? 5 : shelfViewport.width >= 840 ? 4 : shelfViewport.width >= 600 ? 3 : 2;
  const shelfGap = shelfViewport.width >= 600 ? 16 : 12;
  const shelfTileWidth = Math.max(0, (shelfViewport.width - (shelfColumns - 1) * shelfGap) / shelfColumns);
  const shelfRowHeight = shelfTileWidth * 1.25 + 4;
  const shelfWindow = schemeGridWindow({
    itemCount: shelfItems.length,
    columns: shelfColumns,
    rowHeight: shelfRowHeight,
    rowGap: shelfGap,
    gridTop: shelfViewport.gridTop,
    scrollY: shelfViewport.scrollY,
    viewportHeight: shelfViewport.viewportHeight,
    overscanRows: 3,
  });
  useLayoutEffect(() => {
    if (pendingShelfFocus === null) return;
    // Network/virtualized handoff must not steal focus after a click elsewhere.
    const active = document.activeElement;
    const originUnmounted = active === document.body && !pendingShelfFocus.origin.isConnected;
    if (active !== pendingShelfFocus.origin && !originUnmounted) {
      setPendingShelfFocus(null);
      return;
    }
    const target = shelfRef.current?.querySelector<HTMLElement>(
      `[data-mini-index="${pendingShelfFocus.index}"] button`,
    );
    if (!target) return;
    target.focus();
    setPendingShelfFocus(null);
  }, [pendingShelfFocus, shelfWindow.startIndex, shelfWindow.endIndex, visibleProjects.length]);
  useEffect(() => {
    if (
      hasNextPage &&
      !loading &&
      !refreshing &&
      !list.error &&
      shelfWindow.endIndex >= shelfItems.length - shelfColumns * 2
    )
      loadMore();
  }, [
    hasNextPage,
    loading,
    refreshing,
    list.error,
    shelfWindow.endIndex,
    shelfItems.length,
    shelfColumns,
    loadMore,
  ]);
  const focusShelfItem = (index: number, origin: HTMLElement) => {
    const row = Math.floor(index / shelfColumns);
    window.scrollTo({
      top: shelfViewport.gridTop + row * (shelfRowHeight + shelfGap) - 120,
      behavior: "auto",
    });
    setShelfViewport((previous) => ({ ...previous, scrollY: window.scrollY }));
    setPendingShelfFocus({ index, origin });
  };
  if (initialLoading) return <PageSkeleton page={workbench ? "home" : "miniatures"} />;
  return (
    <Box
      component="div"
      sx={{
        "& > :where(:not(:last-child))": { mb: 4 },
        [up.lg]: {
          "& > :where(:not(:last-child))": { mb: 5 },
        },
      }}
    >
      <PageHeader
        eyebrow={workbench ? greeting() : "COLLECTION"}
        title={workbench ? "Workbench" : "Miniatures"}
        body={
          workbench
            ? "See which projects are ready to paint and what's left to gather."
            : "Browse your owned and wishlisted miniatures."
        }
      />
      {workbench && !loading && !list.error && list.catalogCount === 0 && (
        // A new vault has no catalog until a plugin is installed, so point there first.
        <Alert severity="info">
          Your paint library is empty. Install a plugin from Data &amp; settings → Plugins to add paints,
          color schemes, and miniature templates.
        </Alert>
      )}
      {workbench && (
        <Card
          sx={{
            boxSizing: "border-box",
            overflow: "hidden",
            [up.lg]: {
              display: "flex",
            },
          }}
        >
          <Box
            component="div"
            sx={{
              boxSizing: "border-box",
              display: "flex",
              width: "100%",
              minWidth: 0,
              flex: "1",
              alignItems: "center",
              gap: 2,
              p: 2,
              textAlign: "left",
              [up.lg]: {
                gap: 3,
                p: 3,
              },
            }}
          >
            <Box
              component="span"
              sx={{
                position: "relative",
                display: "grid",
                height: "4.5rem",
                width: "4.5rem",
                flexShrink: 0,
                placeItems: "center",
                [up.lg]: {
                  height: "6rem",
                  width: "6rem",
                },
              }}
            >
              <CircularProgress
                variant="determinate"
                value={100}
                size="100%"
                thickness={4.5}
                aria-hidden="true"
                sx={{
                  boxSizing: "border-box",
                  position: "absolute",
                  inset: 0,
                  color: "var(--sunken)",
                }}
              />
              <CircularProgress
                variant="determinate"
                value={pct}
                size="100%"
                thickness={4.5}
                color={ready && ready === list.owned ? "success" : "secondary"}
                aria-label={`${ready} of ${list.collectionCount} projects ready to paint`}
                sx={[
                  {
                    boxSizing: "border-box",
                    position: "absolute",
                    inset: 0,
                  },
                  { "& circle": { strokeLinecap: "round" } },
                ]}
              />
              <Box
                component="span"
                sx={{
                  fontFamily: "var(--font-serif)",
                  letterSpacing: "-0.02em",
                  fontOpticalSizing: "auto",
                  fontSize: "1.25rem",
                  lineHeight: 1.4,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  [up.lg]: {
                    fontSize: "1.5rem",
                    lineHeight: 4 / 3,
                  },
                }}
              >
                {ready}
                <Box
                  component="span"
                  sx={{
                    fontSize: "0.875rem",
                    lineHeight: 10 / 7,
                    color: "var(--ink-faint)",
                  }}
                >
                  /{list.collectionCount}
                </Box>
              </Box>
            </Box>
            <Box
              component="span"
              sx={{
                minWidth: 0,
                flex: "1",
              }}
            >
              <Box
                component="b"
                sx={{
                  display: "block",
                  fontFamily: "var(--font-serif)",
                  letterSpacing: "-0.02em",
                  fontOpticalSizing: "auto",
                  fontSize: "1.125rem",
                  lineHeight: 1.25,
                  [up.lg]: {
                    fontSize: "1.5rem",
                    lineHeight: 1.25,
                  },
                }}
              >
                {list.collectionCount
                  ? ready === list.collectionCount
                    ? "Everything's ready to paint"
                    : `${ready} of ${list.collectionCount} ready to paint`
                  : "Start your first project"}
              </Box>
              <Box
                component="span"
                sx={{
                  mt: 0.5,
                  display: "block",
                  fontSize: "0.875rem",
                  lineHeight: 10 / 7,
                  color: "var(--ink-faint)",
                }}
              >
                {list.collectionCount
                  ? missingProjectPaints
                    ? `${missingProjectPaints} paint${missingProjectPaints === 1 ? "" : "s"} missing from projects`
                    : "Every project paint is ready"
                  : "Add a miniature to plan its paints"}
              </Box>
            </Box>
          </Box>
          <Box
            component="div"
            sx={{
              boxSizing: "border-box",
              borderTopStyle: "solid",
              borderTopWidth: "1px",
              borderColor: "var(--line)",
              [up.lg]: {
                width: "16rem",
                flexShrink: 0,
                borderTopStyle: "solid",
                borderTopWidth: "0px",
                borderLeftStyle: "solid",
                borderLeftWidth: "1px",
              },
            }}
          >
            <ButtonBase
              onClick={() => goTab("wishlist")}
              sx={{
                boxSizing: "border-box",
                display: "flex",
                height: "100%",
                width: "100%",
                flexDirection: "column",
                paddingBlock: "0.75rem",
                "&:hover": {
                  "@media (hover: hover)": {
                    bgcolor: "color-mix(in oklab, var(--sunken) 50%, transparent) !important",
                  },
                },
                [up.lg]: {
                  paddingBlock: "1.5rem !important",
                },
              }}
            >
              <Box
                component="b"
                sx={{
                  fontFamily: "var(--font-serif)",
                  letterSpacing: "-0.02em",
                  fontOpticalSizing: "auto",
                  fontSize: "1.25rem",
                  lineHeight: 1,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  [up.lg]: {
                    fontSize: "1.875rem",
                    lineHeight: 1,
                  },
                }}
              >
                {wishlistedMissingPaints}
                <Box
                  component="span"
                  sx={{
                    color: "var(--ink-faint)",
                  }}
                >
                  {" "}
                  / {missingProjectPaints}
                </Box>
              </Box>
              <Box
                component="span"
                sx={{
                  mt: 0.75,
                  fontSize: "10px",
                  fontWeight: 600,
                  letterSpacing: "0.025em",
                  color: "var(--ink-faint)",
                  textTransform: "uppercase",
                }}
              >
                Missing paints on wishlist
              </Box>
              <Box component="span" sx={visuallyHiddenSx}>
                , open wishlist
              </Box>
            </ButtonBase>
          </Box>
        </Card>
      )}

      <Box
        component="section"
        id="miniature-shelf"
        sx={{
          minWidth: 0,
          scrollMarginTop: "6rem",
        }}
      >
        {workbench && <SectionHeader title="What can you paint?" />}
        <FilterToolbar search={search} setSearch={setSearch} placeholder="Search miniatures…" wideSearch>
          <TextField
            select
            fullWidth
            size="small"
            label={workbench ? "Step" : "Collection"}
            value={workbench ? stageFilter : filter}
            onChange={(event) =>
              workbench
                ? setStageFilter(event.target.value as PaintingStatus | "ALL")
                : setFilter(event.target.value as typeof filter)
            }
          >
            {workbench
              ? [
                  <MenuItem key="ALL" value="ALL">
                    All ({stageCounts.ALL})
                  </MenuItem>,
                  ...STAGES.map(([stage, label]) => (
                    <MenuItem key={stage} value={stage}>
                      {label} ({stageCounts[stage]})
                    </MenuItem>
                  )),
                ]
              : [
                  <MenuItem key="ALL" value="ALL">
                    All ({statusCounts.ALL})
                  </MenuItem>,
                  <MenuItem key="OWNED" value="OWNED">
                    Owned ({statusCounts.OWNED})
                  </MenuItem>,
                  <MenuItem key="WISHLIST" value="WISHLIST">
                    Wishlist ({statusCounts.WISHLIST})
                  </MenuItem>,
                ]}
          </TextField>
        </FilterToolbar>
        {list.error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={list.retry}>
                Retry
              </Button>
            }
          >
            {list.error}
          </Alert>
        )}
        {(loading || refreshing) && (
          <Box role="status" sx={{ py: 1, color: "var(--ink-faint)" }}>
            {loading ? "Loading miniatures…" : "Updating miniatures…"}
          </Box>
        )}
        {hasShelf ? (
          <Box
            component="div"
            ref={shelfRef}
            role="list"
            aria-label="Miniature shelf"
            aria-busy={loading || refreshing}
            data-loaded-count={visibleProjects.length}
            data-total-count={list.totalCount}
            sx={{
              position: "relative",
              minWidth: 0,
            }}
            style={{ height: shelfWindow.totalHeight }}
          >
            <Box
              component="div"
              sx={{
                position: "absolute",
                insetInline: 0,
                display: "grid",
                minWidth: 0,
              }}
              style={{
                top: shelfWindow.topOffset,
                gridTemplateColumns: `repeat(${shelfColumns}, minmax(0, 1fr))`,
                gap: shelfGap,
                gridAutoRows: shelfRowHeight,
              }}
              onKeyDownCapture={(event) => {
                if (event.key !== "Tab") return;
                const current = (event.target as HTMLElement).closest<HTMLElement>("[data-mini-index]");
                if (!current) return;
                const index = Number(current.dataset.miniIndex) + (event.shiftKey ? -1 : 1);
                if (index < 0) return;
                if (index >= shelfItems.length) {
                  if (!event.shiftKey && hasNextPage) {
                    event.preventDefault();
                    setPendingShelfFocus({ index, origin: event.target as HTMLElement });
                    loadMore();
                  }
                  return;
                }
                if (index >= shelfWindow.startIndex && index < shelfWindow.endIndex) return;
                event.preventDefault();
                focusShelfItem(index, event.target as HTMLElement);
              }}
            >
              {shelfItems.slice(shelfWindow.startIndex, shelfWindow.endIndex).map((project, visibleIndex) => {
                const index = shelfWindow.startIndex + visibleIndex;
                return (
                  <Box
                    component="div"
                    key={project?.mini.id ?? "add"}
                    role="listitem"
                    data-mini-index={index}
                    data-miniature-index={index}
                    sx={{
                      minWidth: 0,
                    }}
                  >
                    {project ? (
                      <MiniatureTile
                        mini={project.mini}
                        swatches={project.swatches}
                        total={project.total}
                        missing={project.missing}
                        onOpen={openMini}
                        sx={shelfTileSx}
                      />
                    ) : (
                      <AddMiniatureTile onClick={onAdd} sx={shelfTileSx} />
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        ) : loading || list.error ? null : list.collectionCount ? (
          <EmptyState
            icon={<SearchX size={26} />}
            title="No miniatures match"
            body="Try a different search or filter."
            action={
              <Button
                variant="outlined"
                onClick={() => {
                  setSearch("");
                  if (workbench) setStageFilter("ALL");
                  else setFilter("ALL");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<Archive size={26} />}
            title={workbench ? "Your workbench is empty" : "Your shelf is empty"}
            body={
              workbench
                ? "Add an owned miniature, then build the paint recipe it needs."
                : "Add your first miniature, then build the paint recipe it needs."
            }
            action={
              <Button variant="contained" onClick={onAdd} startIcon={<Plus size={16} />}>
                Add a miniature
              </Button>
            }
          />
        )}
        {hasNextPage && (
          <Button onClick={loadMore} disabled={loading || refreshing} sx={{ mt: 2 }}>
            Load more miniatures
          </Button>
        )}
      </Box>
    </Box>
  );
}
