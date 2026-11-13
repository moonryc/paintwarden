import { Alert, Box, Button } from "@mui/material";

import { Modal } from "../../Components/Modal";
import { Trash2 } from "../../icons";

import { type SourceRemoval, KINDS } from "./sources.utils";

export function RemoveSourceDialog({
  removal,
  removing,
  onClose,
  onRemove,
}: {
  removal: SourceRemoval;
  removing: boolean;
  onClose(): void;
  onRemove(): void;
}) {
  const nothing = !removal.removes.paints && !removal.removes.schemes && !removal.removes.templates;
  return (
    <Modal
      title={`Remove ${removal.source.name}?`}
      subtitle={`Version ${removal.source.version}`}
      onClose={onClose}
    >
      <Box component="p" sx={{ m: 0, fontSize: 14, color: "var(--ink-soft)" }}>
        {nothing
          ? "Nothing will be deleted. Everything from this plugin is also provided by another plugin."
          : "These items will be deleted from your vault. Items also provided by another plugin are kept."}
      </Box>
      {!nothing && (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1, mt: 2 }}>
          {KINDS.map((kind) => (
            <Box
              key={kind}
              sx={{ p: 1.5, borderRadius: "12px", bgcolor: "var(--sunken)", textAlign: "center" }}
            >
              <Box sx={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {removal.removes[kind].toLocaleString()}
              </Box>
              <Box sx={{ fontSize: 12, color: "var(--ink-faint)", textTransform: "capitalize" }}>{kind}</Box>
            </Box>
          ))}
        </Box>
      )}
      {removal.blockers.length > 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Box sx={{ fontWeight: 650 }}>This plugin is still in use</Box>
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
            {removal.blockers.map((item) => (
              <li key={item.label}>
                {item.count.toLocaleString()} {item.label.charAt(0).toLowerCase() + item.label.slice(1)}
              </li>
            ))}
          </Box>
          <Box sx={{ mt: 0.5 }}>Remove or change those first, then try again.</Box>
        </Alert>
      )}
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2.5 }}>
        <Button onClick={onClose} disabled={removing}>
          {removal.canRemove ? "Cancel" : "Close"}
        </Button>
        <Button
          color="error"
          variant="contained"
          startIcon={<Trash2 size={16} />}
          loading={removing}
          disabled={!removal.canRemove}
          onClick={onRemove}
        >
          Remove plugin
        </Button>
      </Box>
    </Modal>
  );
}
