import { Alert, Button, IconButton, type AlertColor } from "@mui/material";
import { i18n } from "@paintwarden/i18n/runtime";
import { useState, type ReactNode } from "react";

import { X } from "../icons";

// Dismissal belongs to the notice, not to the connection: hiding a warning must
// never mark a transport healthy or discard the user's loaded work.
export function AppBanner({
  children,
  severity = "warning",
  onRetry,
  onClose,
}: {
  children: ReactNode;
  severity?: AlertColor;
  onRetry?: () => void;
  onClose?: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <Alert
      data-app-banner
      severity={severity}
      role={severity === "error" ? "alert" : "status"}
      sx={{
        mb: 2,
        minWidth: 0,
        overflowWrap: "anywhere",
        "& .MuiAlert-message": { minWidth: 0 },
        "& .MuiAlert-action": { alignItems: "flex-start", pl: 1 },
      }}
      action={
        <>
          {onRetry && (
            <Button color="inherit" size="small" onClick={onRetry}>
              {i18n.t("shell:retry")}
            </Button>
          )}
          <IconButton
            color="inherit"
            size="small"
            aria-label={i18n.t("common:close")}
            onClick={() => {
              setDismissed(true);
              onClose?.();
            }}
          >
            <X size={18} />
          </IconButton>
        </>
      }
    >
      {children}
    </Alert>
  );
}
