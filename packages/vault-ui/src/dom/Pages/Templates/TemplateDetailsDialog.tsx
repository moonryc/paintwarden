import { imageUrl } from "../../utils/image-cache";
import { Button } from "@mui/material";
import Box from "@mui/material/Box";

import { Modal } from "../../Components/Modal";
import { PluginChip } from "../../Components/PluginChip";
import type { MiniatureTemplate } from "../../types";

// A template's details: its picture and counts, with Add miniature, and for your own templates
// Edit and a Delete that asks for a second click.
export function TemplateDetailsDialog({
  template,
  confirmingDelete,
  onDelete,
  onEdit,
  onUse,
  onClose,
}: {
  template: MiniatureTemplate;
  // Delete was clicked once; the next click deletes.
  confirmingDelete: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onUse: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={template.name}
      subtitle={template.kind === "source" ? "Read-only template" : "Your template"}
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
                {confirmingDelete ? "Confirm delete" : "Delete"}
              </Button>
              <Button onClick={onEdit}>Edit</Button>
            </>
          )}
          <Button onClick={onClose}>Close</Button>
          <Button variant="contained" onClick={onUse}>
            Add miniature
          </Button>
        </Box>
      }
    >
      {template.imageUrl && (
        <Box
          component="img"
          src={imageUrl(template.imageUrl)}
          alt={`${template.name} template preview`}
          sx={{ mb: 1.5, width: "100%", maxHeight: "18rem", borderRadius: "16px", objectFit: "contain" }}
        />
      )}
      <Box component="p" sx={{ m: 0, fontSize: "0.875rem", lineHeight: 10 / 7, color: "var(--ink-soft)" }}>
        {template.schemeCount} schemes · {template.paintCount} paints
      </Box>
    </Modal>
  );
}
