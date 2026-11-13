import { Button, MenuItem, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { useMemo, useState } from "react";

import { EmptyState } from "../Components/EmptyState";
import { MissingProjectPaints } from "../Components/MissingProjectPaints";
import { PageHeader } from "../Components/PageHeader";
import { WishlistPaintList } from "../Components/WishlistPaintList";
import { WishlistPaintRow } from "../Components/WishlistPaintRow";
import { PackageCheck, Share2 } from "../icons";
import { PaintDetailsOverlay } from "../Modals/PaintDetailsOverlay";
import { SubstitutionDialog } from "../Modals/SubstitutionDialog";
import { useVault, useVaultStore } from "../store/hooks";
import type { Paint } from "../types";
import {
  filterShoppingGroups,
  missingShoppingPaints,
  retainedShoppingRows,
  shoppingGroups,
  shoppingRows,
  type WishlistRow,
} from "../utils/semantic-contract";
import { owns } from "../utils/vault-data";

export function WishlistPage({ onBrowsePaints }: { onBrowsePaints?: () => void }) {
  const data = useVault();
  const notify = useVaultStore((s) => s.notify);
  const setPaintState = useVaultStore((s) => s.setPaintState);
  const toggleOwned = useVaultStore((s) => s.toggleOwned);
  const [openPaintId, setOpenPaintId] = useState<string | null>(null),
    [miniFilter, setMiniFilter] = useState("ALL"),
    [retainedBoughtRows, setRetainedBoughtRows] = useState<Map<string, WishlistRow>>(new Map());
  const [fixPaint, setFixPaint] = useState<Paint | null>(null);
  const rows = useMemo(() => shoppingRows(data), [data]);
  // Keep newly bought paints on this page so their bottle count can be adjusted before leaving.
  const displayRows = useMemo(
    () => retainedShoppingRows(rows, retainedBoughtRows, data.paintRecords, data),
    [rows, retainedBoughtRows, data],
  );
  // Grouped by brand so the list follows store shelves; project-heavy paints stay first within a brand.
  const groups = useMemo(() => shoppingGroups(displayRows), [displayRows]);
  // Share sheet on phones (handy in the store); clipboard everywhere else.
  async function share() {
    const title = selectedMini ? `Paint shopping list for ${selectedMini.title}` : "Paint shopping list";
    const text = [
      title,
      ...shareGroups.map(
        ([brand, items]) =>
          `\n${brand}\n${items.map(({ paint }) => `• ${paint.name} (${paint.range})`).join("\n")}`,
      ),
    ].join("\n");
    try {
      if (navigator.share) await navigator.share({ title, text });
      else {
        await navigator.clipboard.writeText(text);
        notify("Shopping list copied");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") notify("Couldn't share the list", "error");
    }
  }
  // Project paints that are neither owned nor listed, most-needed first.
  const missingItems = useMemo(() => missingShoppingPaints(data), [data]);
  // Depleted bottles are stored either as owned-but-empty or as a wishlist record marked EMPTY.
  const isRestock = (paint: Paint) => {
    const record = data.paintRecords[paint.id];
    return Boolean(record && (record.state === "OWNED" || record.stockLevel === "EMPTY") && !owns(record));
  };
  const workbenchMinis = [...data.miniatures].sort(
    (a, b) => b.createdAt - a.createdAt || a.title.localeCompare(b.title),
  );
  const activeMiniId = workbenchMinis.some((mini) => mini.id === miniFilter) ? miniFilter : "ALL";
  const selectedMini = workbenchMinis.find((mini) => mini.id === activeMiniId);
  const visibleGroups = filterShoppingGroups(groups, activeMiniId);
  const shareGroups = visibleGroups
    .map(
      ([brand, items]) => [brand, items.filter(({ paint }) => !owns(data.paintRecords[paint.id]))] as const,
    )
    .filter(([, items]) => items.length > 0);
  const projectCount = new Set(rows.flatMap((r) => r.projects.map((m) => m.id))).size;
  const removeFromWishlist = (paint: Paint) => {
    const previous = data.paintRecords[paint.id];
    if (!previous) return;
    setPaintState(paint.id, null);
    notify(`${paint.name} removed from wishlist`, "ok", {
      label: "Undo",
      onClick: () => setPaintState(paint.id, previous.state, previous.stockLevel, previous.quantity),
    });
  };
  const addToWishlist = (paints: Paint[]) => {
    for (const paint of paints) setPaintState(paint.id, "WISHLIST");
    notify(
      paints.length === 1
        ? `${paints[0].name} added to wishlist`
        : `${paints.length} paints added to wishlist`,
      "ok",
      {
        label: "Undo",
        onClick: () => {
          for (const paint of paints) setPaintState(paint.id, null);
        },
      },
    );
  };
  return (
    <div>
      <PageHeader
        eyebrow="Supply run"
        title="Wishlist"
        body={
          rows.length
            ? `${rows.length} paint${rows.length === 1 ? "" : "s"} to buy${projectCount ? ` for ${projectCount} project${projectCount === 1 ? "" : "s"}` : ""}. Tick one off when it’s on your shelf.`
            : retainedBoughtRows.size
              ? "All listed paints bought. Set bottle quantities before leaving this page."
              : "Wishlisted and depleted paints appear here."
        }
      />
      <MissingProjectPaints
        items={missingItems}
        listedCount={
          rows.filter((row) => row.projects.length > 0 && row.reasons?.includes("missingStock")).length
        }
        onAdd={(paint) => addToWishlist([paint])}
        onAddAll={addToWishlist}
        onFix={setFixPaint}
      />
      {displayRows.length > 0 && (
        <Box
          sx={{ mb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}
        >
          {workbenchMinis.length > 0 && (
            <TextField
              select
              size="small"
              label="Miniature"
              value={activeMiniId}
              onChange={(event) => setMiniFilter(event.target.value)}
              sx={{ flex: "0 1 340px", minWidth: 0 }}
            >
              <MenuItem value="ALL">All miniatures ({displayRows.length})</MenuItem>
              {workbenchMinis.map((mini) => (
                <MenuItem key={mini.id} value={mini.id}>
                  {mini.title} (
                  {displayRows.filter((row) => row.projects.some((project) => project.id === mini.id)).length}
                  )
                </MenuItem>
              ))}
            </TextField>
          )}
          <Button
            variant="outlined"
            onClick={share}
            disabled={!shareGroups.length}
            startIcon={<Share2 size={15} />}
            sx={{ ml: "auto", flexShrink: 0 }}
          >
            Share list
          </Button>
        </Box>
      )}
      {visibleGroups.length ? (
        <WishlistPaintList
          groups={visibleGroups}
          renderRow={(row, listPosition) => (
            <WishlistPaintRow
              key={row.paint.id}
              paint={row.paint}
              listPosition={listPosition}
              restock={isRestock(row.paint)}
              reasons={row.reasons}
              onFix={() => setFixPaint(row.paint)}
              quantity={
                retainedBoughtRows.has(row.paint.id) && owns(data.paintRecords[row.paint.id])
                  ? data.paintRecords[row.paint.id].quantity
                  : undefined
              }
              onBought={() => {
                setRetainedBoughtRows((current) => new Map(current).set(row.paint.id, row));
                toggleOwned(row.paint);
              }}
              onQuantityChange={(quantity) =>
                setPaintState(row.paint.id, quantity === 0 ? "WISHLIST" : "OWNED", "FULL", quantity)
              }
              onRemove={() => removeFromWishlist(row.paint)}
              onOpenPaint={() => setOpenPaintId(row.paint.id)}
            />
          )}
        />
      ) : (
        <EmptyState
          icon={<PackageCheck size={26} />}
          title={selectedMini ? `Nothing listed for ${selectedMini.title}` : "Nothing to buy"}
          body={
            selectedMini
              ? "This miniature has no paints on your wishlist yet."
              : missingItems.length
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
      )}
      {fixPaint && <SubstitutionDialog paint={fixPaint} onClose={() => setFixPaint(null)} />}
      <PaintDetailsOverlay paintId={openPaintId} onClose={() => setOpenPaintId(null)} />
    </div>
  );
}
