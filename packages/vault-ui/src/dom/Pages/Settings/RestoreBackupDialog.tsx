import { Alert, Button, Chip, FormControlLabel, Radio, RadioGroup } from "@mui/material";
import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";

import { Modal } from "../../Components/Modal";
import type { BackupSummary } from "../../utils/backup-summary";

export type PendingBackup = { file: File; summary: Extract<BackupSummary, { ok: true }> };

export type RestoreMode = "merge" | "replace";

const RESTORE_MODES: {
  value: RestoreMode;
  label: "settingsMergeLabel" | "settingsReplaceLabel";
  description: "settingsMergeDescription" | "settingsReplaceDescription";
}[] = [
  {
    value: "merge",
    label: "settingsMergeLabel",
    description: "settingsMergeDescription",
  },
  {
    value: "replace",
    label: "settingsReplaceLabel",
    description: "settingsReplaceDescription",
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
  const { t, i18n } = useTranslation("pages");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { summary } = pending;
  const replacing = mode === "replace";
  return (
    <Modal
      title={t("settingsRestoreDialogTitle")}
      subtitle={pending.file.name}
      onClose={onClose}
      footer={
        <>
          <Box sx={{ flex: 1 }} />
          <Button variant="text" disabled={busy} onClick={onClose}>
            {t("settingsCancel")}
          </Button>
          <Button
            variant="contained"
            color={replacing ? "error" : "primary"}
            disabled={busy}
            onClick={onRestore}
          >
            {busy ? t("settingsRestoring") : replacing ? t("settingsReplaceVault") : t("settingsMergeVault")}
          </Button>
        </>
      }
    >
      <Box sx={{ display: "grid", gap: 2 }}>
        <Box sx={{ display: "grid", gap: 1 }}>
          <Box sx={{ fontSize: 12, color: "var(--ink-soft)" }}>
            {summary.exportedAt
              ? t("settingsExportedAt", {
                  date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(summary.exportedAt),
                })
              : t("settingsExportDateUnknown")}
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {summary.counts.length ? (
              summary.counts.map(({ count, label, key }) => (
                <Chip
                  key={label}
                  size="small"
                  label={`${new Intl.NumberFormat(locale).format(count)} ${key ? i18n.t(`shell:${key}`, { count }) : label}`}
                  sx={{ bgcolor: "var(--surface-raised)", fontWeight: 600 }}
                />
              ))
            ) : (
              <Chip size="small" label={t("settingsNoRecords")} sx={{ bgcolor: "var(--surface-raised)" }} />
            )}
          </Box>
        </Box>
        {summary.legacy ? (
          <Alert severity="info">{t("settingsLegacyBackup")}</Alert>
        ) : (
          <RadioGroup
            aria-label={t("settingsHowToRestore")}
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
                    <Box sx={{ fontSize: 14, fontWeight: 650 }}>{t(option.label)}</Box>
                    <Box sx={{ fontSize: 12, color: "var(--ink-soft)" }}>{t(option.description)}</Box>
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
        {replacing && <Alert severity="warning">{t("settingsReplacingWarning")}</Alert>}
      </Box>
    </Modal>
  );
}
