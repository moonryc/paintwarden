import { Alert, Box, Button, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { reportBug } from "../utils/support";

// Reports contain only the allowlisted support summary, never the rendering error or vault data.
export function ReportBugButton({
  report = reportBug,
  showHint = true,
}: {
  report?: typeof reportBug;
  showHint?: boolean;
}) {
  const { t, i18n } = useTranslation("components");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function openReport() {
    setBusy(true);
    setFailed(false);
    try {
      await report(i18n.resolvedLanguage ?? i18n.language);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Box>
      <Button variant="outlined" loading={busy} onClick={() => void openReport()}>
        {t("reportBug")}
      </Button>
      {showHint && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t("reportBugHint")}
        </Typography>
      )}
      {failed && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {t("supportFailure")}
        </Alert>
      )}
    </Box>
  );
}
