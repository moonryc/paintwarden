import { Box, Button, LinearProgress, Paper, Typography } from "@mui/material";
import { useId } from "react";
import { useTranslation } from "react-i18next";

export interface PluginInstallProgressJob {
  id: string;
  stage:
    "READING" | "CHECKING" | "IMAGES" | "PREPARING" | "COMMITTING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  done: number;
  total: number;
  percent: number;
  cancellable: boolean;
  error?: string | null;
}

export interface PluginInstallProgressProps {
  job: PluginInstallProgressJob;
  cancelling?: boolean;
  onCancel: () => void;
  compact?: boolean;
}

const stageKeys = {
  READING: "sourcesJobReading",
  CHECKING: "sourcesJobChecking",
  IMAGES: "sourcesJobImages",
  PREPARING: "sourcesJobPreparing",
  COMMITTING: "sourcesJobCommitting",
  SUCCEEDED: "sourcesJobSucceeded",
  FAILED: "sourcesJobFailed",
  CANCELLED: "sourcesJobCancelled",
} as const;

/** Presentational, nonblocking progress; cancellation is owned by the caller. */
export function PluginInstallProgress({
  job,
  cancelling = false,
  onCancel,
  compact = false,
}: PluginInstallProgressProps) {
  const { t, i18n } = useTranslation("pages");
  const titleId = useId();
  const percent = Number.isFinite(job.percent) ? Math.min(100, Math.max(0, job.percent)) : 0;
  const format = new Intl.NumberFormat(i18n.resolvedLanguage || i18n.language, {
    maximumFractionDigits: 0,
  });
  const counts = t("sourcesJobCounts", {
    done: format.format(job.done),
    total: format.format(job.total),
  });
  const percentText = t("sourcesJobPercent", { percent: format.format(percent) });
  const indeterminate = (job.stage === "READING" || job.stage === "CHECKING") && job.total === 0;
  const terminal = ["SUCCEEDED", "FAILED", "CANCELLED"].includes(job.stage);
  const canCancel = job.cancellable && !terminal && job.stage !== "COMMITTING";

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={titleId}
      sx={{ p: compact ? 1.5 : 2, minWidth: 0, width: "100%", boxSizing: "border-box" }}
    >
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Typography
          id={titleId}
          component="h2"
          variant={compact ? "body2" : "subtitle1"}
          sx={{ flex: compact ? "1 1 8rem" : "1 1 12rem" }}
        >
          {t("sourcesJobTitle")}
        </Typography>
        {(canCancel || (cancelling && !terminal && job.stage !== "COMMITTING")) && (
          <Button onClick={onCancel} disabled={cancelling || !canCancel} size="small" variant="outlined">
            {t(cancelling ? "sourcesJobCancelling" : "sourcesJobCancel")}
          </Button>
        )}
      </Box>
      <Typography
        component="div"
        variant="body2"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        sx={{ mt: 1 }}
      >
        {t(stageKeys[job.stage])}
        {" · "}
        {counts}
        {compact && ` · ${percentText}`}
      </Typography>
      <LinearProgress
        variant={indeterminate ? "indeterminate" : "determinate"}
        value={percent}
        aria-label={t("sourcesJobTitle")}
        aria-valuetext={
          indeterminate ? t(stageKeys[job.stage]) : `${t(stageKeys[job.stage])} · ${counts} · ${percentText}`
        }
        sx={{ my: compact ? 0.75 : 1, height: compact ? 4 : 6, borderRadius: 1 }}
      />
      {!indeterminate && <Typography variant="body2">{percentText}</Typography>}
      {job.stage === "FAILED" && job.error && (
        <Typography
          variant="body2"
          color="error"
          sx={{ mt: 1, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}
        >
          {job.error}
        </Typography>
      )}
      {!compact && !terminal && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t("sourcesJobBackground")}
        </Typography>
      )}
    </Paper>
  );
}
