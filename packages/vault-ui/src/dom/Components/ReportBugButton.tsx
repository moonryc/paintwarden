import { Box, Button, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { reportBug } from "../utils/support";

import { ReportBugModal } from "./HelpAbout";

// Recovery screens and Settings use the same report and support-bundle dialogs.
export function ReportBugButton({
  report = reportBug,
  showHint = true,
}: {
  report?: typeof reportBug;
  showHint?: boolean;
}) {
  const { t } = useTranslation("components");
  const [open, setOpen] = useState(false);
  return (
    <Box>
      <Button variant="outlined" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {t("reportBug")}
      </Button>
      {showHint && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t("reportBugHint")}
        </Typography>
      )}
      {open && <ReportBugModal report={report} onClose={() => setOpen(false)} />}
    </Box>
  );
}
