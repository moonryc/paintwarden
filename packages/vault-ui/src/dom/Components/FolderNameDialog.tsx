import { Alert, Button, Stack, TextField } from "@mui/material";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { Modal } from "./Modal";

/** Names a new folder or renames one; stays open with an error when saving fails. */
export function FolderNameDialog({
  title,
  initialName = "",
  onSave,
  onClose,
}: {
  title: string;
  initialName?: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation("pages");
  const formId = useId();
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const close = () => {
    if (!pending) onClose();
  };
  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setFailed(false);
    try {
      await onSave(trimmed);
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal
      title={title}
      subtitle=""
      onClose={close}
      footer={
        <>
          <Button onClick={close} disabled={pending}>
            {t("folders.cancel")}
          </Button>
          <Button type="submit" form={formId} variant="contained" disabled={pending || !name.trim()}>
            {t("folders.save")}
          </Button>
        </>
      }
    >
      <Stack
        component="form"
        id={formId}
        spacing={2}
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {failed && <Alert severity="error">{t("folders.error")}</Alert>}
        <TextField
          fullWidth
          label={t("folders.name")}
          value={name}
          disabled={pending}
          onChange={(event) => setName(event.target.value)}
        />
      </Stack>
    </Modal>
  );
}
