import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Modal } from "./Modal";

/** A frozen, named selection; cancel receives focus before any destructive action. */
export function BulkDeleteDialog({
  items,
  kind,
  onDelete,
  onClose,
}: {
  items: { id: string; name: string }[];
  kind: "MINIATURE" | "TEMPLATE";
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation("pages");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const close = () => {
    if (!pending) onClose();
  };
  const remove = async () => {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      await onDelete();
      onClose();
    } catch {
      setFailed(true);
      setPending(false);
    }
  };
  const label = t(kind === "MINIATURE" ? "folders.deleteMiniatures" : "folders.deleteTemplates", {
    count: items.length,
  });
  return (
    <Modal
      title={label}
      subtitle=""
      onClose={close}
      footer={
        <>
          <Button autoFocus onClick={close} disabled={pending}>
            {t("folders.cancel")}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void remove()}
            disabled={pending || !items.length}
          >
            {label}
          </Button>
        </>
      }
    >
      <Stack spacing={2} aria-busy={pending}>
        {failed && <Alert severity="error">{t("folders.error")}</Alert>}
        <Typography>{t("folders.bulkDeleteWarning")}</Typography>
        <Box
          component="ul"
          aria-label={label}
          tabIndex={0}
          sx={{ m: 0, pl: 3, pr: 1, maxHeight: "40dvh", overflowY: "auto", overflowWrap: "anywhere" }}
        >
          {items.map((item) => (
            <li key={item.id}>{item.name}</li>
          ))}
        </Box>
      </Stack>
    </Modal>
  );
}
