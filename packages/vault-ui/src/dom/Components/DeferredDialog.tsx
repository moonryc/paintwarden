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
  return (
    <Suspense
      fallback={
        <Modal title={title} subtitle="Loading…" onClose={onClose}>
          <Box role="status" aria-busy="true" sx={{ color: "var(--ink-soft)" }}>
            Opening {title}…
          </Box>
        </Modal>
      }
    >
      {children}
    </Suspense>
  );
}
