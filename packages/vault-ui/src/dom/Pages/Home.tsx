import { gql, type TypedDocumentNode } from "@apollo/client";
import {
  Button,
  ButtonBase,
  Card,
  Checkbox,
  CircularProgress,
  MenuItem,
  Skeleton,
  useMediaQuery,
  TextField,
} from "@mui/material";
import Box from "@mui/material/Box";
import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AddChoiceDialog } from "../Components/AddChoiceDialog";
import { AddMiniatureTile } from "../Components/AddMiniatureTile";
import { EmptyState } from "../Components/EmptyState";
import { FilterToolbar } from "../Components/FilterToolbar";
import { FolderBrowser } from "../Components/FolderBrowser";
import { FolderNameDialog } from "../Components/FolderNameDialog";
import { FolderPicker } from "../Components/FolderPicker";
import type { FolderView } from "../Components/FolderTile";
import { MiniatureTile } from "../Components/MiniatureTile";
import { PageHeader } from "../Components/PageHeader";
import { QueryErrorNotice } from "../Components/QueryErrorNotice";
import { SectionHeader } from "../Components/SectionHeader";
import { SelectionBar } from "../Components/SelectionBar";
import { tileControlSx } from "../Components/tile-control";
import { useFolderBrowser } from "../graphql/folder-hooks";
import { useFolderSearch } from "../graphql/folder-search-hooks";
import type { MiniatureListQuery } from "../graphql/generated/graphql";
import { MiniatureFixtureContext, useMiniatureList } from "../graphql/miniature-list-hooks";
import type { MiniatureTileProjection } from "../graphql/miniature-list-model";
import { useVaultGraphQL } from "../graphql/provider";
import { useRetainedQuery } from "../graphql/use-retained-query";
import { Archive, SearchX } from "../icons";
import { CreateMiniatureDialog } from "../Modals/CreateMiniatureDialog";
import { useVaultStore } from "../store/hooks";
import { up } from "../theme-tokens";
import type { PaintingStatus } from "../types";
import { getStages } from "../utils/constants";
import { greeting } from "../utils/misc";
import { schemeGridWindow } from "../utils/scheme-grid-window";
import { visuallyHiddenSx } from "../utils/visually-hidden";

import { useInitialPageLoading } from "./useInitialPageLoading";

const shelfTileSx = { width: "100%", height: "100%" };

// Counts have their own small read: a slow grid/search must not block the Workbench summary.
// The server caches the aggregate; no miniature fields or preview images are requested here.
const workbenchSummaryDocument: TypedDocumentNode<
  { home?: Pick<NonNullable<MiniatureListQuery["home"]>, "counts" | "revision"> },
  { workbench: boolean; first: number; folderId: string | null }
> = gql`
  query MiniatureList($workbench: Boolean!, $first: Int!, $folderId: ID) {
    home(first: $first, folderId: $folderId) @include(if: $workbench) {
      revision {
        epoch
        seq
      }
      counts {
        catalogCount
        owned
        ready
        distinctMissingPaints
        wishlistedMissingPaints
        stages {
          key
          label
          count
        }
      }
    }
  }
`;

type SummaryCounts = NonNullable<MiniatureListQuery["home"]>["counts"];
function useWorkbenchSummary(enabled: boolean, folderId: string | null) {
  const scope = useVaultGraphQL();
  const { t } = useTranslation("shell");
  const fixture = useContext(MiniatureFixtureContext);
  const [state, setState] = useState<{
    scope?: typeof scope;
    folderId?: string | null;
    counts?: SummaryCounts;
    loading: boolean;
    error: string;
  }>({ loading: true, error: "" });
  const retryRef = useRef(() => {});
  useEffect(() => {
    if (!enabled || fixture || !scope) return;
    const abort = new AbortController();
    let active = true;
    let running = false;
    let pending = false;
    const refresh = async () => {
      pending = true;
      if (running) return;
      running = true;
      setState((previous) => ({ ...previous, loading: true, error: "" }));
      try {
        while (active && pending) {
          pending = false;
          const ticket = scope.controller.capture();
          const { data } = await scope.client.query({
            query: workbenchSummaryDocument,
            variables: { workbench: true, first: 1, folderId },
            fetchPolicy: "no-cache",
            context: { fetchOptions: { signal: abort.signal }, queryDeduplication: false },
          });
          if (!active) return;
          if (!data?.home) throw new Error(t("miniatureListResponseWasEmpty"));
          if (!scope.controller.accepts(ticket, data.home.revision, ["HOME"])) {
            pending = true;
            continue;
          }
          setState({ scope, folderId, counts: data.home.counts, loading: false, error: "" });
        }
      } catch (error) {
        if (active)
          setState((previous) => ({
            scope,
            folderId,
            counts: previous.scope === scope && previous.folderId === folderId ? previous.counts : undefined,
            loading: false,
            error: error instanceof Error ? error.message : t("miniatureRefreshFailed"),
          }));
      } finally {
        running = false;
      }
    };
    retryRef.current = () => void refresh();
    const unsubscribe = scope.controller.listen(["HOME"], () => void refresh());
    void refresh();
    return () => {
      active = false;
      abort.abort();
      unsubscribe();
    };
  }, [enabled, scope, fixture, folderId, t]);
  const matches = state.scope === scope && state.folderId === folderId;
  const retained = useRetainedQuery(
    matches ? state.counts : null,
    enabled && Boolean(scope) && (!matches || (state.loading && !state.error)),
    scope,
    folderId,
  );
  return {
    counts: retained.data,
    loading: !fixture && retained.loading,
    refreshing: !fixture && retained.refreshing,
    error: matches ? state.error : "",
    retry: () => retryRef.current(),
  };
}

export function Home({ view }: { view: "dashboard" | "miniatures" }) {
  const { t, i18n } = useTranslation("pages");
  const { t: tc } = useTranslation("components");
  const number = (value: number) =>
    new Intl.NumberFormat(i18n.resolvedLanguage || i18n.language).format(value);
  const filter = useVaultStore((s) => s.miniatureFilter);
  const setFilter = useVaultStore((s) => s.setMiniatureFilter);
  const goTab = useVaultStore((s) => s.go);
  const openMini = useVaultStore((s) => s.openMini);
  const [search, setSearch] = useState(""),
    q = search.trim();
  const [stageFilter, setStageFilter] = useState<PaintingStatus | "ALL">("ALL");
  const workbench = view === "dashboard";
  const folderState = useFolderBrowser(view, "MINIATURE", q);
  const mixedSearch = useFolderSearch({
    kind: "MINIATURE",
    search: q,
    folderId: folderState.flat ? null : folderState.folderId,
    ownership: workbench ? "OWNED" : filter === "ALL" ? undefined : filter,
    stage: workbench && stageFilter !== "ALL" ? stageFilter : undefined,
  });
  const hasMixedSearch = Boolean(useVaultGraphQL()) && Boolean(q);
  const summary = useWorkbenchSummary(workbench, folderState.flat ? null : folderState.folderId);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", { noSsr: true });
  const skeletonAnimation = reducedMotion ? false : "pulse";
  const browser = {
    ...folderState,
    visibleFolders: hasMixedSearch ? mixedSearch.folders : folderState.visibleFolders,
    navigate: (id: string | null) => {
      folderState.navigate(id);
      setSearch("");
    },
  };
  const [selection, setSelection] = useState<string[]>([]);
  // Checkboxes, and tapping a tile to select it, only while edit mode is on.
  const [editing, setEditing] = useState(false);
  const toggleSelected = (id: string) =>
    setSelection((previous) =>
      previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id],
    );
  const [movingItems, setMovingItems] = useState<string[] | null>(null);
  useEffect(() => {
    setSelection([]);
  }, [browser.folderId, browser.flat, view, q]);
  const list = useMiniatureList({
    workbench,
    ownership: filter,
    stage: stageFilter,
    search: q,
    folderId: browser.flat ? null : browser.folderId,
    flat: browser.flat || Boolean(q),
  });
  const {
    rows: listedProjects,
    statusCounts,
    stageCounts,
    loading: listLoading,
    refreshing: listRefreshing,
    hasNextPage: listHasNextPage,
    loadMore: listLoadMore,
  } = list;
  const visibleProjects = hasMixedSearch ? mixedSearch.miniatures : listedProjects;
  const loading = hasMixedSearch ? mixedSearch.loading : listLoading;
  const refreshing = hasMixedSearch ? mixedSearch.refreshing : listRefreshing;
  const hasNextPage = hasMixedSearch ? mixedSearch.hasNextPage : listHasNextPage;
  const loadMore = hasMixedSearch ? mixedSearch.loadMore : listLoadMore;
  const listError = hasMixedSearch ? mixedSearch.error : list.error;
  const retry = hasMixedSearch ? mixedSearch.retry : list.retry;
  const gridLoading = loading || (!browser.flat && browser.loading);
  const initialLoading = useInitialPageLoading(
    gridLoading || (workbench && summary.loading),
    Boolean(listError || summary.error),
    true,
    view,
  );
  const shelfLoading = initialLoading && gridLoading;
  const summaryLoading = workbench && initialLoading && summary.loading;
  const collectionCount = summary.counts?.owned ?? list.collectionCount;
  const ready = summary.counts?.ready ?? list.ready;
  const missingProjectPaints = summary.counts?.distinctMissingPaints ?? list.missingProjectPaints;
  const wishlistedMissingPaints = summary.counts?.wishlistedMissingPaints ?? list.wishlistedMissingPaints;
  const pct = collectionCount ? (ready / collectionCount) * 100 : 0;
  const workbenchStageCount = (stage: keyof typeof stageCounts) =>
    stage === "ALL"
      ? collectionCount
      : (summary.counts?.stages.find((facet) => facet.key === stage)?.count ?? stageCounts[stage]);
  // The add tile leads the grid (not while searching), then folders, then miniatures.
  const shelfItems: (MiniatureTileProjection | FolderView | "loading" | null)[] = [
    ...(q ? [] : [null]),
    ...(shelfLoading ? Array.from({ length: 9 }, () => "loading" as const) : browser.visibleFolders),
    ...(shelfLoading ? [] : visibleProjects),
  ];
  const hasQuery = Boolean(q);
  const hasShelf = shelfLoading || visibleProjects.length > 0 || browser.visibleFolders.length > 0 || !q;
  const [adding, setAdding] = useState(false);
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
  }, [shelfItems.length, hasQuery, hasShelf, view]);
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
      !listError &&
      shelfWindow.endIndex >= shelfItems.length - shelfColumns * 2
    )
      loadMore();
  }, [
    hasNextPage,
    loading,
    refreshing,
    listError,
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
  return (
    // Only the visible route surface changes identity; its folder/query hooks stay mounted.
    <Box
      key={view}
      component="div"
      sx={{
        minWidth: 0,
        overflowWrap: "anywhere",
        "& > :where(:not(:last-child))": { mb: 4 },
        [up.lg]: {
          "& > :where(:not(:last-child))": { mb: 5 },
        },
      }}
    >
      <PageHeader
        eyebrow={workbench ? greeting() : t("homeCollectionEyebrow")}
        title={workbench ? t("homeWorkbenchTitle") : t("homeMiniaturesTitle")}
        body={workbench ? t("homeWorkbenchBody") : t("homeMiniaturesBody")}
      />
      {workbench && (
        <Card
          component="section"
          aria-label={t("homeWorkbenchTitle")}
          aria-busy={summary.loading || summary.refreshing}
          data-loading-section="workbench-summary"
          data-skeleton={summaryLoading ? "workbench-summary" : undefined}
          sx={{
            boxSizing: "border-box",
            overflow: "hidden",
            // Stacked only on phones; side by side from the small breakpoint up.
            [up.sm]: {
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
                color={ready && ready === collectionCount ? "success" : "secondary"}
                aria-label={t("homeReadyProjectsAria", { ready, total: collectionCount })}
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
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "baseline",
                  width: "100%",
                  height: "1.75rem",
                  textAlign: "center",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
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
                    height: "2rem",
                  },
                }}
              >
                {summaryLoading ? (
                  <Skeleton
                    aria-hidden
                    animation={skeletonAnimation}
                    variant="rounded"
                    width="70%"
                    height={20}
                    sx={{ mx: "auto", alignSelf: "center" }}
                  />
                ) : (
                  <>
                    {number(ready)}
                    <Box
                      component="span"
                      sx={{
                        fontSize: "0.875rem",
                        lineHeight: 10 / 7,
                        color: "var(--ink-faint)",
                      }}
                    >
                      /{number(collectionCount)}
                    </Box>
                  </>
                )}
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
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden",
                  height: "2.5em",
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
                {summaryLoading ? (
                  <Skeleton aria-hidden animation={skeletonAnimation} variant="rounded" height="100%" />
                ) : collectionCount ? (
                  ready === collectionCount ? (
                    t("homeAllReady")
                  ) : (
                    t("homeReadyProjects", { ready, total: collectionCount })
                  )
                ) : (
                  t("homeStartFirstProject")
                )}
              </Box>
              <Box
                component="span"
                sx={{
                  mt: 0.5,
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden",
                  height: 40,
                  fontSize: "0.875rem",
                  lineHeight: 10 / 7,
                  color: "var(--ink-faint)",
                }}
              >
                {summaryLoading ? (
                  <Skeleton aria-hidden animation={skeletonAnimation} variant="rounded" height="100%" />
                ) : !summary.error && summary.counts?.catalogCount === 0 ? (
                  t("homeEmptyLibrary")
                ) : collectionCount ? (
                  missingProjectPaints ? (
                    t("homeMissingPaints", { count: missingProjectPaints })
                  ) : (
                    t("homeEveryPaintReady")
                  )
                ) : (
                  t("homeAddMiniaturePlan")
                )}
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
              [up.sm]: {
                width: "13rem",
                flexShrink: 0,
                borderTopStyle: "solid",
                borderTopWidth: "0px",
                borderLeftStyle: "solid",
                borderLeftWidth: "1px",
              },
              [up.lg]: { width: "16rem" },
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
                minWidth: 0,
                px: 1,
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
                  display: "block",
                  width: "100%",
                  height: "1em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
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
                {summaryLoading ? (
                  <Skeleton
                    aria-hidden
                    animation={skeletonAnimation}
                    variant="rounded"
                    width={90}
                    height="100%"
                    sx={{ mx: "auto" }}
                  />
                ) : (
                  <>
                    {number(wishlistedMissingPaints)}
                    <Box
                      component="span"
                      sx={{
                        color: "var(--ink-faint)",
                      }}
                    >
                      {" "}
                      / {number(missingProjectPaints)}
                    </Box>
                  </>
                )}
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
                {t("homeMissingWishlist")}
              </Box>
              <Box component="span" sx={visuallyHiddenSx}>
                {t("homeOpenWishlist")}
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
        {workbench && <QueryErrorNotice error={summary.error} onRetry={summary.retry} />}
        {workbench && <SectionHeader title={t("homePaintQuestion")} />}
        <FilterToolbar
          search={search}
          setSearch={setSearch}
          placeholder={t("homeSearchMiniatures")}
          wideSearch
        >
          <TextField
            select
            fullWidth
            size="small"
            sx={{ minWidth: 0 }}
            label={workbench ? t("homeStepLabel") : t("homeCollectionLabel")}
            disabled={workbench ? summaryLoading : shelfLoading}
            slotProps={{
              select: {
                renderValue: (workbench ? summaryLoading : shelfLoading) ? () => tc("loading") : undefined,
              },
            }}
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
                    {t("homeAllCount", { count: workbenchStageCount("ALL") })}
                  </MenuItem>,
                  ...getStages().map(([stage, label]) => (
                    <MenuItem key={stage} value={stage}>
                      {label} ({number(workbenchStageCount(stage))})
                    </MenuItem>
                  )),
                ]
              : [
                  <MenuItem key="ALL" value="ALL">
                    {t("homeAllCount", { count: statusCounts.ALL })}
                  </MenuItem>,
                  <MenuItem key="OWNED" value="OWNED">
                    {t("homeOwnedCount", { count: statusCounts.OWNED })}
                  </MenuItem>,
                  <MenuItem key="WISHLIST" value="WISHLIST">
                    {t("homeWishlistCount", { count: statusCounts.WISHLIST })}
                  </MenuItem>,
                ]}
          </TextField>
        </FilterToolbar>
        <FolderBrowser
          browser={browser}
          kind="project"
          editing={editing}
          onEditingChange={(next) => {
            setEditing(next);
            if (!next) setSelection([]);
          }}
        >
          {(renderFolder) => (
            <>
              {listError && <QueryErrorNotice error={listError} onRetry={retry} />}
              {hasShelf ? (
                <Box
                  component="div"
                  ref={shelfRef}
                  role="list"
                  aria-label={t("homeMiniatureShelf")}
                  aria-busy={gridLoading || refreshing || browser.refreshing}
                  data-loading-section="miniature-grid"
                  data-skeleton={shelfLoading ? "miniature-grid" : undefined}
                  data-loaded-count={visibleProjects.length}
                  data-total-count={hasMixedSearch ? mixedSearch.totalCount : list.totalCount}
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
                      const controls = Array.from(
                        current.querySelectorAll<HTMLElement>("button, input:not([disabled])"),
                      );
                      if (event.target !== (event.shiftKey ? controls[0] : controls.at(-1))) return;
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
                    {shelfItems
                      .slice(shelfWindow.startIndex, shelfWindow.endIndex)
                      .map((project, visibleIndex) => {
                        const index = shelfWindow.startIndex + visibleIndex;
                        return (
                          <Box
                            component="div"
                            key={
                              project === "loading"
                                ? `loading:${index}`
                                : project
                                  ? "mini" in project
                                    ? project.mini.id
                                    : `folder:${project.id}`
                                  : "add"
                            }
                            role="listitem"
                            data-mini-index={index}
                            data-miniature-index={index}
                            sx={{
                              minWidth: 0,
                            }}
                          >
                            {project === "loading" ? (
                              <Card
                                aria-hidden
                                sx={{
                                  ...shelfTileSx,
                                  boxSizing: "border-box",
                                  position: "relative",
                                  overflow: "hidden",
                                }}
                              >
                                <Skeleton
                                  animation={skeletonAnimation}
                                  variant="rectangular"
                                  width="100%"
                                  height="100%"
                                />
                                <Box sx={{ position: "absolute", insetInline: 12, bottom: 16 }}>
                                  <Skeleton
                                    animation={skeletonAnimation}
                                    variant="rounded"
                                    width="75%"
                                    height={18}
                                    sx={{ mb: 1 }}
                                  />
                                  <Skeleton
                                    animation={skeletonAnimation}
                                    variant="rounded"
                                    width="45%"
                                    height={12}
                                  />
                                </Box>
                              </Card>
                            ) : project && !("mini" in project) ? (
                              renderFolder(project, shelfTileSx)
                            ) : project ? (
                              <Box sx={{ position: "relative", height: "100%" }}>
                                <MiniatureTile
                                  mini={project.mini}
                                  swatches={project.swatches}
                                  total={project.total}
                                  missing={project.missing}
                                  onOpen={editing ? toggleSelected : openMini}
                                  sx={shelfTileSx}
                                />
                                {editing && (
                                  <Checkbox
                                    checked={selection.includes(project.mini.id)}
                                    slotProps={{
                                      input: {
                                        "aria-label": t("folders.selectItem", { name: project.mini.title }),
                                      },
                                    }}
                                    onChange={(_, checked) =>
                                      setSelection((previous) =>
                                        checked
                                          ? [...previous, project.mini.id]
                                          : previous.filter((id) => id !== project.mini.id),
                                      )
                                    }
                                    sx={{
                                      position: "absolute",
                                      top: 4,
                                      left: 4,
                                      ...tileControlSx,
                                      borderRadius: 1,
                                    }}
                                  />
                                )}
                              </Box>
                            ) : (
                              <AddMiniatureTile onClick={() => setAdding(true)} sx={shelfTileSx} />
                            )}
                          </Box>
                        );
                      })}
                  </Box>
                </Box>
              ) : loading || listError ? null : list.collectionCount ? (
                <EmptyState
                  icon={<SearchX size={26} />}
                  title={t("homeNoMatches")}
                  body={t("homeTryDifferentSearch")}
                  action={
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setSearch("");
                        if (workbench) setStageFilter("ALL");
                        else setFilter("ALL");
                      }}
                    >
                      {t("homeClearFilters")}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<Archive size={26} />}
                  title={workbench ? t("homeEmptyWorkbench") : t("homeEmptyShelf")}
                  body={workbench ? t("homeAddOwnedMiniature") : t("homeAddFirstMiniature")}
                />
              )}
              <SelectionBar
                count={selection.length}
                onMove={() => setMovingItems(selection)}
                onClear={() => setSelection([])}
              />
              {hasNextPage && (
                <Button onClick={loadMore} disabled={loading || refreshing} sx={{ mt: 2 }}>
                  {t("homeLoadMoreMiniatures")}
                </Button>
              )}
            </>
          )}
        </FolderBrowser>
      </Box>
      {movingItems && (
        <FolderPicker
          folders={browser.folders}
          onClose={() => setMovingItems(null)}
          onMove={async (destination) => {
            await browser.moveItems(movingItems, destination);
            setMovingItems(null);
            setSelection([]);
          }}
        />
      )}
      {adding && (
        <AddChoiceDialog
          folderView={!browser.flat}
          itemLabel={t("folders.miniature")}
          item={
            <CreateMiniatureDialog
              initialFolderId={browser.flat ? null : browser.folderId}
              initialTemplateId={null}
              onClose={() => setAdding(false)}
            />
          }
          folder={
            <FolderNameDialog
              title={t("folders.createFolder")}
              onSave={(name) => browser.create(name)}
              onClose={() => setAdding(false)}
            />
          }
        />
      )}
    </Box>
  );
}
