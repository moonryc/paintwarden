import { useState } from "react";

import { usePaintCommands } from "../graphql/paint-actions";
import { useVaultGraphQL } from "../graphql/provider";
import { useVault, useVaultStore } from "../store/hooks";
import type { Paint } from "../types";
import { noop } from "../utils/constants";

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
  const commands = usePaintCommands();
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
            await commands.updatePaint(editingPaint.id, values).then(() => {
              setEditingPaint(null);
              notify("Custom paint updated");
            }, noop);
          }}
          onDelete={async () => {
            await commands.deletePaint(editingPaint.id).then(() => {
              setEditingPaint(null);
              notify("Custom paint deleted");
            }, noop);
          }}
        />
      )}
    </>
  );
}
