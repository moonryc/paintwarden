import { Alert, Button, Chip, FormControlLabel, Radio, RadioGroup } from "@mui/material";
import Box from "@mui/material/Box";

import { Modal } from "../../Components/Modal";
import type { BackupSummary } from "../../utils/backup-summary";

export type PendingBackup = { file: File; summary: Extract<BackupSummary, { ok: true }> };

export type RestoreMode = "merge" | "replace";

const RESTORE_MODES: { value: RestoreMode; label: string; description: string }[] = [
  {
    value: "merge",
    label: "Merge into this vault",
    description: "Adds what this vault doesn't have yet. Anything already here stays as it is.",
  },
  {
    value: "replace",
    label: "Replace this vault",
    description: "Removes everything in this vault and restores the backup exactly. Your account is kept.",
  },
];

export function RestoreBackupDialog({
  pending,
  mode,
  busy,
  onModeChange,
  onRestore,
  onClose,
}: {
  pending: PendingBackup;
  mode: RestoreMode;
  busy: boolean;
  onModeChange(mode: RestoreMode): void;
  onRestore(): void;
  onClose(): void;
}) {
  const { summary } = pending;
  const replacing = mode === "replace";
  return (
    <Modal
      title="Restore backup"
      subtitle={pending.file.name}
      onClose={onClose}
      footer={
        <>
          <Box sx={{ flex: 1 }} />
          <Button variant="text" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={replacing ? "error" : "primary"}
            disabled={busy}
            onClick={onRestore}
          >
            {busy ? "Restoring…" : replacing ? "Replace vault" : "Merge into vault"}
          </Button>
        </>
      }
    >
      <Box sx={{ display: "grid", gap: 2 }}>
        <Box sx={{ display: "grid", gap: 1 }}>
          <Box sx={{ fontSize: 12, color: "var(--ink-soft)" }}>
            {summary.exportedAt
              ? `Exported ${summary.exportedAt.toLocaleDateString(undefined, { dateStyle: "medium" })}`
              : "Export date unknown"}
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {summary.counts.length ? (
              summary.counts.map(({ count, label }) => (
                <Chip
                  key={label}
                  size="small"
                  label={`${count.toLocaleString()} ${label}`}
                  sx={{ bgcolor: "var(--surface-raised)", fontWeight: 600 }}
                />
              ))
            ) : (
              <Chip size="small" label="No records" sx={{ bgcolor: "var(--surface-raised)" }} />
            )}
          </Box>
        </Box>
        {summary.legacy ? (
          <Alert severity="info">
            {
              "This backup is from an earlier version of Paint Vault. It doesn't include plugins or photos, so it can only be merged. Install the plugins it uses first."
            }
          </Alert>
        ) : (
          <RadioGroup
            aria-label="How to restore"
            value={mode}
            onChange={(event) => onModeChange(event.target.value as RestoreMode)}
            sx={{ display: "grid", gap: 1 }}
          >
            {RESTORE_MODES.map((option) => (
              <FormControlLabel
                key={option.value}
                value={option.value}
                disabled={busy}
                control={<Radio size="small" />}
                label={
                  <Box sx={{ py: 0.5 }}>
                    <Box sx={{ fontSize: 14, fontWeight: 650 }}>{option.label}</Box>
                    <Box sx={{ fontSize: 12, color: "var(--ink-soft)" }}>{option.description}</Box>
                  </Box>
                }
                sx={{
                  m: 0,
                  pr: 1.5,
                  alignItems: "flex-start",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: mode === option.value ? "var(--gold)" : "var(--line)",
                  bgcolor: mode === option.value ? "var(--sunken)" : "transparent",
                  "& .MuiRadio-root": { mt: 0.25 },
                }}
              />
            ))}
          </RadioGroup>
        )}
        {replacing && (
          <Alert severity="warning">
            {
              "Replacing can't be undone. Export a backup of this vault first if you might want its current contents."
            }
          </Alert>
        )}
      </Box>
    </Modal>
  );
}
