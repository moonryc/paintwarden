import { useState } from "react";

import { useVault, useVaultStore } from "../store/hooks";
import type { Paint } from "../types";

import { PaintDetailsModal } from "./PaintDetailsModal";
import { PaintForm } from "./PaintForm";

export function PaintDetailsOverlay({
  paintId,
  onClose,
  openMini: openMiniOverride,
}: {
  paintId: string | null;
  onClose(): void;
  // Opens a miniature after the overlay closes; defaults to opening it in the project drawer.
  openMini?(id: string): void;
}) {
  const data = useVault();
  const api = useVaultStore((s) => s.api);
  const notify = useVaultStore((s) => s.notify);
  const storeOpenMini = useVaultStore((s) => s.openMini);
  const openMini = openMiniOverride ?? storeOpenMini;
  const [editingPaint, setEditingPaint] = useState<Paint | null>(null);
  const paint = data.catalog.find((item) => item.id === paintId) ?? null;
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
          onEdit={() => {
            onClose();
            setEditingPaint(paint);
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
