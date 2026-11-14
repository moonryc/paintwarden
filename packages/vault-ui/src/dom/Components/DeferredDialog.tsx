import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import { Suspense, type ReactNode } from "react";

import { Modal } from "./Modal";

// Keep the overlay named, keyboard-dismissible and modal while its code is loading.
// Rejected imports propagate to the app's existing recovery/error boundary.
export function DeferredDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation("components");
  return (
    <Suspense
      fallback={
        <Modal title={title} subtitle={t("loading")} onClose={onClose}>
          <Box role="status" aria-busy="true" sx={{ color: "var(--ink-soft)" }}>
            {t("openingDialog", { title })}
          </Box>
        </Modal>
      }
    >
      {children}
    </Suspense>
  );
}
