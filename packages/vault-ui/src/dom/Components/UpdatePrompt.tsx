import { Alert, Button, Snackbar, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDesktopUpdate } from "../utils/desktop-update";

import { Modal } from "./Modal";

function ReleaseNotes({ notes }: { notes?: string }) {
  const { t } = useTranslation("components");
  if (!notes) return null;
  return (
    <Stack spacing={0.5} sx={{ mt: 1 }}>
      <Typography component="p" variant="subtitle2">
        {t("updateReleaseNotes")}
      </Typography>
      <Typography
        component="div"
        variant="body2"
        sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 200, overflowY: "auto" }}
      >
        {notes}
      </Typography>
    </Stack>
  );
}

type ConsentInput = { version: string; consentId: string; action: "download" | "defer" };

function RemoteUpdateConsent({
  version,
  serverVersion,
  releaseNotes,
  consentId,
  respond,
}: {
  version: string;
  serverVersion?: string | null;
  releaseNotes?: string;
  consentId: string;
  respond: (input: ConsentInput) => Promise<void>;
}) {
  const { t } = useTranslation("components");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const answer = async (action: ConsentInput["action"]) => {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      await respond({ version, consentId, action });
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };
  const versions = { version, serverVersion: serverVersion ?? t("updateUnknownServerVersion") };
  return (
    <Modal
      title={t("updateRemoteTitle")}
      subtitle={t("updateRemoteVersions", versions)}
      onClose={() => void answer("defer")}
      footer={
        <>
          <Button variant="outlined" disabled={pending} onClick={() => void answer("defer")}>
            {t("updateNotNow")}
          </Button>
          <Button variant="contained" disabled={pending} onClick={() => void answer("download")}>
            {t("updateAnyway")}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <Alert severity="warning">{t("updateRemoteWarning", versions)}</Alert>
        <Typography variant="body2">{t("updateRemindNextCheck")}</Typography>
        <ReleaseNotes notes={releaseNotes} />
        {failed && <Alert severity="error">{t("updateConsentFailed")}</Alert>}
      </Stack>
    </Modal>
  );
}

// Offers to restart the desktop app once an update has downloaded. "Later" hides the prompt;
// the update still installs the next time the app quits.
export function UpdatePrompt() {
  const { t } = useTranslation("components");
  const { state, install, respond } = useDesktopUpdate();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const ready = state?.status === "ready" && dismissed !== state.version;
  if (state?.status === "consent-required" && state.version && state.consentId)
    return (
      <RemoteUpdateConsent
        key={state.consentId}
        version={state.version}
        serverVersion={state.serverVersion}
        releaseNotes={state.releaseNotes}
        consentId={state.consentId}
        respond={respond}
      />
    );
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
        <ReleaseNotes notes={state?.releaseNotes} />
      </Alert>
    </Snackbar>
  );
}
