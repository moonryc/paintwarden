import { Alert, Box, Button, Skeleton } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Modal } from "./Modal";

// Vite emits a local chunk containing the complete text. Load it only when
// opened: notices can be large, and must not require an external service.
export function OpenSourceLicensesModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("components");
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setFailed(false);
    void import("../../../../../THIRD_PARTY_NOTICES.txt?raw").then(
      (module) => {
        if (current) setText(module.default);
      },
      () => {
        if (current) setFailed(true);
      },
    );
    return () => {
      current = false;
    };
  }, [attempt]);
  return (
    <Modal title={t("noticesTitle")} subtitle={t("noticesSummary")} onClose={onClose} fillBody>
      {failed ? (
        <Alert
          severity="error"
          action={<Button onClick={() => setAttempt(attempt + 1)}>{t("noticesRetry")}</Button>}
        >
          {t("noticesFailure")}
        </Alert>
      ) : text === null ? (
        <Box role="status" aria-label={t("noticesLoading")}>
          <Skeleton />
          <Skeleton />
          <Skeleton width="65%" />
        </Box>
      ) : (
        <Box
          component="pre"
          role="region"
          aria-label={t("noticesTitle")}
          tabIndex={0}
          lang="en"
          sx={{
            m: 0,
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            fontSize: 13,
            "&:focus-visible": { outline: "2px solid var(--brand-text)", outlineOffset: -2 },
          }}
        >
          {text}
        </Box>
      )}
    </Modal>
  );
}
