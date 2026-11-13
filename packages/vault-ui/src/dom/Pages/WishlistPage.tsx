import { useFragment } from "@apollo/client/react";
import { Alert, Autocomplete, Button, CircularProgress, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { useContext, useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "../Components/EmptyState";
import { MissingProjectPaints } from "../Components/MissingProjectPaints";
import { Modal } from "../Components/Modal";
import { PageHeader } from "../Components/PageHeader";
import { PageSkeleton } from "../Components/PageSkeletons";
import { WishlistPaintList } from "../Components/WishlistPaintList";
import { WishlistPaintRow } from "../Components/WishlistPaintRow";
import { PaintStockFragmentDoc } from "../graphql/generated/graphql";
import { libraryInventoryRecord } from "../graphql/library-model";
import { useVaultGraphQL, type VaultGraphQLScope } from "../graphql/provider";
import { usePaintStock } from "../graphql/stock-actions";
import {
  useWishlist,
  useWishlistModelOptions,
  WishlistFixtureContext,
  type WishlistModelOption,
  type WishlistProjection,
} from "../graphql/wishlist-hooks";
import { PackageCheck, Share2 } from "../icons";
import { PaintDetailsOverlay } from "../Modals/PaintDetailsOverlay";
import { SubstitutionDialog } from "../Modals/SubstitutionDialog";
import { useVaultStore } from "../store/hooks";
import type { Paint } from "../types";
import { owns } from "../utils/vault-data";

import { useInitialPageLoading } from "./useInitialPageLoading";

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const normalized = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

type RetainedRow = { row: WishlistProjection; miniatureId: string | null };

export function WishlistPage({ onBrowsePaints }: { onBrowsePaints?: () => void }) {
  const notify = useVaultStore((s) => s.notify);
  const { setPaintState } = usePaintStock();
  const [selectedMini, setSelectedMini] = useState<WishlistModelOption | null>(null);
  const [modelSearch, setModelSearch] = useState("");
  const [openPaintId, setOpenPaintId] = useState<string | null>(null);
  const [fixPaint, setFixPaint] = useState<Paint | null>(null);
  const [retained, setRetained] = useState<Map<string, RetainedRow>>(new Map());
  const [sharing, setSharing] = useState(false);
  const [retainedMembership, setRetainedMembership] = useState<Record<string, boolean>>({});
  const list = useWishlist(selectedMini?.id ?? null);
  const initialLoading = useInitialPageLoading(list.loading, Boolean(list.error));
  const models = useWishlistModelOptions(modelSearch);
  const readRelatedProjects = list.relatedProjects;
  const displayRows = useMemo(() => {
    const ids = new Set(list.rows.map(({ paint }) => paint.id));
    const extra = [...retained.values()]
      .filter(
        ({ row, miniatureId }) =>
          !ids.has(row.paint.id) &&
          (!selectedMini ||
            miniatureId === selectedMini.id ||
            row.projects.some((p) => p.id === selectedMini.id) ||
            retainedMembership[`${row.paint.id}:${selectedMini.id}`] === true),
      )
      .map(({ row }) => ({ ...row, reasons: row.reasons.filter((reason) => reason !== "missingStock") }));
    return [...list.rows, ...extra].sort(
      (a, b) =>
        compare(normalized(a.brandGroup), normalized(b.brandGroup)) ||
        b.projectCount - a.projectCount ||
        compare(normalized(a.paint.name), normalized(b.paint.name)) ||
        compare(a.paint.id, b.paint.id),
    );
  }, [list.rows, retained, selectedMini, retainedMembership]);
  // Preview projects are not the full association set. A later model filter must
  // resolve membership for bought rows whose selected project is beyond that preview.
  useEffect(() => {
    if (!selectedMini) return;
    let active = true;
    const miniatureId = selectedMini.id;
    for (const { row, miniatureId: boughtFor } of retained.values()) {
      const key = `${row.paint.id}:${miniatureId}`;
      if (
        !row.projectsTruncated ||
        boughtFor === miniatureId ||
        row.projects.some((p) => p.id === miniatureId) ||
        key in retainedMembership
      )
        continue;
      void (async () => {
        let after: string | null = null;
        do {
          const page = await readRelatedProjects(row.paint.id, after);
          if (!active) return;
          if (page.nodes.some((project) => project.id === miniatureId)) {
            setRetainedMembership((previous) => ({ ...previous, [key]: true }));
            return;
          }
          after = page.hasNextPage ? page.endCursor : null;
        } while (after);
        if (active) setRetainedMembership((previous) => ({ ...previous, [key]: false }));
      })().catch(() => {
        if (active)
          notify("Could not check bought paint project associations. Retry the miniature filter.", "error");
      });
    }
    return () => {
      active = false;
    };
  }, [selectedMini, retained, retainedMembership, readRelatedProjects, notify]);

  const groups = useMemo(() => {
    const grouped = new Map<string, WishlistProjection[]>();
    for (const row of displayRows) {
      const items = grouped.get(row.brandGroup) ?? [];
      items.push(row);
      grouped.set(row.brandGroup, items);
    }
    return [...grouped];
  }, [displayRows]);

  async function share() {
    setSharing(true);
    try {
      // The server exports the complete filtered list, never just the loaded window.
      const { title, text } = await list.exportList();
      if (navigator.share) await navigator.share({ title, text });
      else {
        await navigator.clipboard.writeText(text);
        notify("Shopping list copied");
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") notify("Couldn't share the list", "error");
    } finally {
      setSharing(false);
    }
  }
  function addToWishlist(paints: Paint[]) {
    for (const paint of paints) setPaintState(paint.id, "WISHLIST");
    notify(
      paints.length === 1
        ? `${paints[0].name} added to wishlist`
        : `${paints.length} paints added to wishlist`,
      "ok",
      {
        label: "Undo",
        onClick: () => {
          for (const paint of paints) {
            const previous = list.missing.find((row) => row.paint.id === paint.id)?.record;
            setPaintState(paint.id, previous?.state ?? null, previous?.stockLevel, previous?.quantity);
          }
        },
      },
    );
  }

  const [projectsPaint, setProjectsPaint] = useState<Paint | null>(null);
  if (initialLoading) return <PageSkeleton page="wishlist" />;
  return (
    <div>
      <PageHeader
        eyebrow="Supply run"
        title="Wishlist"
        body={
          list.counts.shoppingPaints
            ? `${list.counts.shoppingPaints} paint${list.counts.shoppingPaints === 1 ? "" : "s"} to buy${list.counts.projectCount ? ` for ${list.counts.projectCount} project${list.counts.projectCount === 1 ? "" : "s"}` : ""}. Tick one off when it’s on your shelf.`
            : retained.size
              ? "All listed paints bought. Set bottle quantities before leaving this page."
              : "Wishlisted and depleted paints appear here."
        }
      />
      <MissingProjectPaints
        items={list.missing}
        totalCount={list.missingCount}
        missingStockCount={list.counts.missingStock}
        brokenSubstitutionCount={list.counts.brokenSubstitution}
        listedCount={list.counts.listedMissingStock}
        hasMore={list.missingHasNextPage}
        onAdd={(paint) => addToWishlist([paint])}
        onAddAll={addToWishlist}
        onFix={setFixPaint}
      />
      {list.missingHasNextPage && (
        <Box sx={{ mb: 2 }}>
          <Button onClick={list.loadMoreMissing} disabled={list.loading || list.refreshing}>
            Load more project paint issues ({list.missing.length} of {list.missingCount})
          </Button>
        </Box>
      )}
      <Box sx={{ mb: 1.5, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
        <Autocomplete
          size="small"
          sx={{ flex: "0 1 340px", minWidth: 180 }}
          options={models.options}
          value={selectedMini}
          onChange={(_event, value) => setSelectedMini(value)}
          onInputChange={(_event, value, reason) => {
            if (reason === "input" || reason === "clear") setModelSearch(value);
          }}
          getOptionLabel={(option) => option.title}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          filterOptions={(options) => options}
          loading={models.loading}
          noOptionsText="No miniatures found"
          renderOption={(props, option) => {
            const { key, ...rest } = props;
            return (
              <li key={key} {...rest}>
                {option.title} ({option.projectCount})
              </li>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Miniature"
              placeholder="All miniatures"
              sx={{ "& .MuiInputLabel-root.Mui-focused": { color: "var(--ink)" } }}
            />
          )}
        />
        {models.hasNextPage && (
          <Button onClick={models.loadMore} disabled={models.loading}>
            Load more miniatures
          </Button>
        )}
        <Button
          variant="outlined"
          onClick={share}
          disabled={sharing || !list.totalCount}
          startIcon={<Share2 size={15} />}
          sx={{ ml: "auto", flexShrink: 0 }}
        >
          {sharing ? "Sharing list…" : "Share list"}
        </Button>
      </Box>
      {models.error && (
        <Alert severity="error" action={<Button onClick={models.retry}>Retry miniature search</Button>}>
          {models.error}
        </Alert>
      )}
      {list.error && (
        <Alert severity="error" action={<Button onClick={list.retry}>Retry wishlist</Button>}>
          {list.error}
        </Alert>
      )}
      {(list.loading || list.refreshing) && (
        <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1, my: 2 }}>
          <CircularProgress size={18} />
          {list.loading ? "Loading wishlist…" : "Updating wishlist…"}
        </Box>
      )}
      {groups.length ? (
        <WishlistPaintList
          groups={groups}
          renderRow={(row, position) => (
            <ProjectedShoppingRow
              key={row.paint.id}
              row={row}
              position={position}
              retained={retained.has(row.paint.id)}
              onRetain={() =>
                setRetained((current) =>
                  new Map(current).set(row.paint.id, { row, miniatureId: selectedMini?.id ?? null }),
                )
              }
              onRemoveRetained={() =>
                setRetained((current) => {
                  const next = new Map(current);
                  next.delete(row.paint.id);
                  return next;
                })
              }
              onOpenPaint={() => setOpenPaintId(row.paint.id)}
              onFix={() => setFixPaint(row.paint)}
              onProjects={() => setProjectsPaint(row.paint)}
            />
          )}
        />
      ) : (
        !list.loading &&
        !list.error && (
          <EmptyState
            icon={<PackageCheck size={26} />}
            title={selectedMini ? `Nothing listed for ${selectedMini.title}` : "Nothing to buy"}
            body={
              selectedMini
                ? "This miniature has no paints on your wishlist yet."
                : list.missingCount
                  ? "Review your project paint issues above, or browse the library for something new."
                  : "Your wishlist has no paints to buy or restock. Tap the heart on any paint to add it here."
            }
            action={
              onBrowsePaints && (
                <Button variant="outlined" onClick={onBrowsePaints}>
                  Browse paints
                </Button>
              )
            }
          />
        )
      )}
      {list.hasNextPage && (
        <Box sx={{ mt: 2 }}>
          <Button onClick={list.loadMore} disabled={list.loading || list.refreshing}>
            Load more paints ({list.rows.length} of {list.totalCount})
          </Button>
        </Box>
      )}
      {projectsPaint && (
        <RelatedProjects
          key={projectsPaint.id}
          paint={projectsPaint}
          read={list.relatedProjects}
          onClose={() => setProjectsPaint(null)}
        />
      )}
      {fixPaint && <SubstitutionDialog paint={fixPaint} onClose={() => setFixPaint(null)} />}
      <PaintDetailsOverlay paintId={openPaintId} onClose={() => setOpenPaintId(null)} />
    </div>
  );
}

type ShoppingRowProps = {
  row: WishlistProjection;
  position: { index: number; size: number };
  retained: boolean;
  onRetain(): void;
  onRemoveRetained(): void;
  onOpenPaint(): void;
  onFix(): void;
  onProjects(): void;
};
function ProjectedShoppingRow(props: ShoppingRowProps) {
  const scope = useVaultGraphQL();
  const fixture = useContext(WishlistFixtureContext);
  const row = fixture?.record ? { ...props.row, record: fixture.record(props.row.paint.id) } : props.row;
  return scope ? <CachedShoppingRow {...props} scope={scope} /> : <ShoppingRow {...props} row={row} />;
}
function CachedShoppingRow({ scope, ...props }: ShoppingRowProps & { scope: VaultGraphQLScope }) {
  const { data, complete } = useFragment({
    fragment: PaintStockFragmentDoc,
    from: { __typename: "Paint", id: props.row.paint.id },
    client: scope.client,
    optimistic: true,
  });
  return (
    <ShoppingRow
      {...props}
      row={{ ...props.row, record: complete ? libraryInventoryRecord(data.inventory) : props.row.record }}
    />
  );
}
function ShoppingRow({ row, position, retained, onRetain, onRemoveRetained, ...actions }: ShoppingRowProps) {
  const { setPaintState, toggleOwned } = usePaintStock();
  const notify = useVaultStore((s) => s.notify);
  return (
    <WishlistPaintRow
      paint={row.paint}
      listPosition={position}
      restock={row.restock}
      reasons={row.reasons}
      projectCount={row.projectCount}
      quantity={retained && owns(row.record) ? row.record?.quantity : undefined}
      onBought={() => {
        onRetain();
        toggleOwned(row.paint, row.record);
      }}
      onQuantityChange={(quantity) =>
        setPaintState(row.paint.id, quantity === 0 ? "WISHLIST" : "OWNED", "FULL", quantity)
      }
      onRemove={() => {
        onRemoveRetained();
        setPaintState(row.paint.id, null);
        notify(`${row.paint.name} removed from wishlist`, "ok", {
          label: "Undo",
          onClick: () => {
            if (row.record)
              setPaintState(row.paint.id, row.record.state, row.record.stockLevel, row.record.quantity);
          },
        });
      }}
      {...actions}
    />
  );
}

type ProjectReader = ReturnType<typeof useWishlist>["relatedProjects"];
function RelatedProjects({ paint, read, onClose }: { paint: Paint; read: ProjectReader; onClose(): void }) {
  const [page, setPage] = useState<Awaited<ReturnType<ProjectReader>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  // Read only when the user opens the panel; no all-project query at page startup.
  const reader = useRef(read);
  async function load(after?: string | null) {
    setLoading(true);
    setError("");
    try {
      const next = await reader.current(paint.id, after);
      if (alive.current)
        setPage((old) => ({ ...next, nodes: after && old ? [...old.nodes, ...next.nodes] : next.nodes }));
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : "Could not load projects");
    } finally {
      if (alive.current) setLoading(false);
    }
  }
  // The effect is kept with the modal lifetime so late reads cannot update a dismissed panel.
  const initialLoad = useRef(load);
  useEffect(() => {
    alive.current = true;
    void initialLoad.current();
    return () => {
      alive.current = false;
    };
  }, []);
  return (
    <Modal
      title={`Projects using ${paint.name}`}
      subtitle={page ? `${page.totalCount} associated projects` : "Associated projects"}
      onClose={onClose}
    >
      {loading && <Box role="status">Loading projects…</Box>}
      {error && (
        <Alert severity="error" action={<Button onClick={() => void load()}>Retry projects</Button>}>
          {error}
        </Alert>
      )}
      <Box component="ul" sx={{ pl: 2.5 }}>
        {page?.nodes.map((project) => (
          <li key={project.id}>{project.title}</li>
        ))}
      </Box>
      {page?.hasNextPage && (
        <Button disabled={loading} onClick={() => void load(page.endCursor)}>
          Load more projects
        </Button>
      )}
    </Modal>
  );
}
