import { Button } from "@mui/material";
import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";

import { Modal } from "../../Components/Modal";
import { PluginChip } from "../../Components/PluginChip";
import { dialogPreloadHandlers } from "../../dialog-preload";
import type { MiniatureTemplate } from "../../types";
import { imageUrl } from "../../utils/image-cache";

// A template's details: its picture and counts, with Add miniature, and for your own templates
// Edit and a Delete that asks for a second click.
export function TemplateDetailsDialog({
  template,
  confirmingDelete,
  onDelete,
  onEdit,
  onUse,
  onClose,
  onMove,
}: {
  template: MiniatureTemplate;
  // Delete was clicked once; the next click deletes.
  confirmingDelete: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onUse: () => void;
  onClose: () => void;
  onMove?: () => void;
}) {
  const { t, i18n } = useTranslation("pages");
  return (
    <Modal
      title={template.name}
      subtitle={template.kind === "source" ? t("templatesReadOnlyTemplate") : t("templatesYourTemplate")}
      badge={
        template.kind === "source" ? (
          <PluginChip name={template.sourceName} logoUrl={template.sourceLogoUrl} />
        ) : undefined
      }
      onClose={onClose}
      footer={
        <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 1, width: "100%" }}>
          {template.kind === "user" && (
            <>
              <Button color="error" variant={confirmingDelete ? "contained" : "text"} onClick={onDelete}>
                {confirmingDelete ? t("templatesConfirmDelete") : t("templatesDelete")}
              </Button>
              <Button onClick={onEdit}>{t("templatesEdit")}</Button>
            </>
          )}
          {onMove && <Button onClick={onMove}>{t("folders.move")}</Button>}
          <Button onClick={onClose}>{t("templatesClose")}</Button>
          <Button variant="contained" {...dialogPreloadHandlers("miniature")} onClick={onUse}>
            {t("templatesAddMiniature")}
          </Button>
        </Box>
      }
    >
      {template.imageUrl && (
        <Box
          component="img"
          src={imageUrl(template.imageUrl)}
          alt={t("templatesPreviewAlt", { name: template.name })}
          sx={{ mb: 1.5, width: "100%", maxHeight: "18rem", borderRadius: "16px", objectFit: "contain" }}
        />
      )}
      <Box component="p" sx={{ m: 0, fontSize: "0.875rem", lineHeight: 10 / 7, color: "var(--ink-soft)" }}>
        {t("templatesSchemeCount", {
          count: template.schemeCount,
          formattedCount: new Intl.NumberFormat(i18n.language).format(template.schemeCount),
        })}{" "}
        ·{" "}
        {t("templatesPaintCount", {
          count: template.paintCount,
          formattedCount: new Intl.NumberFormat(i18n.language).format(template.paintCount),
        })}
      </Box>
    </Modal>
  );
}
