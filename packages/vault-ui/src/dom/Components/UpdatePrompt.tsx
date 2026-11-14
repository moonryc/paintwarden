import { useTranslation } from "react-i18next";
import { Alert, Button, Snackbar } from "@mui/material";
import { useState } from "react";

import { useDesktopUpdate } from "../utils/desktop-update";

// Offers to restart the desktop app once an update has downloaded. "Later" hides the prompt;
// the update still installs the next time the app quits.
export function UpdatePrompt() {
  const { t } = useTranslation("components");
  const { state, install } = useDesktopUpdate();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const ready = state?.status === "ready" && dismissed !== state.version;
  return (
    <Snackbar
      open={ready}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      sx={{ bottom: { xs: "calc(5.5rem + env(safe-area-inset-bottom))", lg: 24 } }}
    >
      <Alert
        severity="info"
        variant="filled"
        // A darker teal than the theme's info color, so the white text stays readable.
        sx={{
          width: "100%",
          alignItems: "center",
          borderRadius: 4,
          boxShadow: 6,
          bgcolor: "var(--sky-strong)",
          color: "#fff",
        }}
        action={
          <>
            <Button
              color="inherit"
              size="small"
              disabled={restarting}
              onClick={() => setDismissed(state?.version ?? null)}
            >
              {t("updateLater")}
            </Button>
            <Button
              color="inherit"
              size="small"
              disabled={restarting}
              sx={{ fontWeight: 700 }}
              onClick={() => {
                setRestarting(true);
                void install().finally(() => setRestarting(false));
              }}
            >
              {t("updateRestart")}
            </Button>
          </>
        }
      >
        {t("updateReady", { version: state?.version })}
      </Alert>
    </Snackbar>
  );
}
