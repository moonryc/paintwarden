import { useTranslation } from "react-i18next";
import { useState } from "react";

import { usePaintCommands } from "../graphql/paint-actions";
import { useVaultStore } from "../store/hooks";
import type { Paint } from "../types";
import { noop } from "../utils/constants";

import { PaintDetailsModal } from "./PaintDetailsModal";
import { PaintForm } from "./PaintForm";

type OverlayProps = {
  paintId: string | null;
  onClose(): void;
  openMini?(id: string): void;
};

export function PaintDetailsOverlay({ paintId, onClose, openMini: openMiniOverride }: OverlayProps) {
  const { t } = useTranslation("components");
  const commands = usePaintCommands();
  const notify = useVaultStore((s) => s.notify);
  const storeOpenMini = useVaultStore((s) => s.openMini);
  const openMini = openMiniOverride ?? storeOpenMini;
  const [editingPaint, setEditingPaint] = useState<Paint | null>(null);
  const paint = paintId
    ? {
        id: paintId,
        name: t("paintDetails"),
        brand: "",
        range: "",
        colorHex: null,
        sourceUrl: null,
        isCustom: false,
      }
    : null;
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
              notify(t("customPaintUpdated"));
            }, noop);
          }}
          onDelete={async () => {
            await commands.deletePaint(editingPaint.id).then(() => {
              setEditingPaint(null);
              notify(t("customPaintDeleted"));
            }, noop);
          }}
        />
      )}
    </>
  );
}
