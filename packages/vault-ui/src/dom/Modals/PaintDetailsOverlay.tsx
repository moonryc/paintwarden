import { useState } from "react";

import { useVaultGraphQL } from "../graphql/provider";
import { useVault, useVaultStore } from "../store/hooks";
import type { Paint } from "../types";

import { PaintDetailsModal } from "./PaintDetailsModal";
import { PaintForm } from "./PaintForm";

type OverlayProps = {
  paintId: string | null;
  onClose(): void;
  openMini?(id: string): void;
};

export function PaintDetailsOverlay(props: OverlayProps) {
  const graphql = useVaultGraphQL();
  return graphql ? <PaintDetailsOverlayView {...props} apollo /> : <LegacyPaintDetailsOverlay {...props} />;
}

function LegacyPaintDetailsOverlay(props: OverlayProps) {
  const paint = useVault((data) => data.catalog.find((item) => item.id === props.paintId) ?? null);
  return <PaintDetailsOverlayView {...props} legacyPaint={paint} />;
}

function PaintDetailsOverlayView({
  paintId,
  onClose,
  openMini: openMiniOverride,
  apollo,
  legacyPaint,
}: OverlayProps & { apollo?: boolean; legacyPaint?: Paint | null }) {
  const api = useVaultStore((s) => s.api);
  const notify = useVaultStore((s) => s.notify);
  const storeOpenMini = useVaultStore((s) => s.openMini);
  const openMini = openMiniOverride ?? storeOpenMini;
  const [editingPaint, setEditingPaint] = useState<Paint | null>(null);
  const paint =
    apollo && paintId
      ? {
          id: paintId,
          name: "Paint details",
          brand: "",
          range: "",
          colorHex: null,
          sourceUrl: null,
          isCustom: false,
        }
      : legacyPaint;
  return (
    <>
      {paint && (
        <PaintDetailsModal
          paint={paint}
          onClose={onClose}
          openMini={(id) => {
            onClose();
            openMini(id);
          }}
          onEdit={(currentPaint) => {
            onClose();
            setEditingPaint(currentPaint);
          }}
        />
      )}
      {editingPaint && (
        <PaintForm
          paint={editingPaint}
          onClose={() => setEditingPaint(null)}
          onSave={async (values) => {
            await api(`/api/catalog/${editingPaint.id}`, { method: "PUT", body: JSON.stringify(values) });
            setEditingPaint(null);
            notify("Custom paint updated");
          }}
          onDelete={async () => {
            await api(`/api/catalog/${editingPaint.id}`, { method: "DELETE" });
            setEditingPaint(null);
            notify("Custom paint deleted");
          }}
        />
      )}
    </>
  );
}
