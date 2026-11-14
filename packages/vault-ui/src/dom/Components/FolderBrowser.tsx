import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { FolderBrowserState } from "../graphql/folder-hooks";

import { FolderBreadcrumbs } from "./FolderBreadcrumbs";
import { FolderPicker } from "./FolderPicker";
import { FolderTile, type FolderView } from "./FolderTile";
import { Modal } from "./Modal";

type Dialog =
  { type: "add" } | { type: "create" } | { type: "rename" | "delete" | "move"; folder: FolderView };

export function FolderBrowser({
  browser,
  kind,
  onAddItem,
}: {
  browser: FolderBrowserState;
  kind: "project" | "template";
  onAddItem(): void;
}) {
  const { t } = useTranslation("pages");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [name, setName] = useState("");
  const [deleteMode, setDeleteMode] = useState<"DELETE_CONTENTS" | "MOVE_UP">("MOVE_UP");
  const [pending, setPending] = useState(false);
  const [operationError, setOperationError] = useState(false);
  const close = () => {
    if (!pending) setDialog(null);
  };
  const open = (next: Dialog) => {
    setOperationError(false);
    setDialog(next);
  };
  const run = async (operation: () => void | Promise<void>, dismiss = true) => {
    if (pending) return;
    setPending(true);
    setOperationError(false);
    try {
      await operation();
      if (dismiss) setDialog(null);
    } catch {
      setOperationError(true);
    } finally {
      setPending(false);
    }
  };
  const folderAction = (type: "rename" | "delete" | "move", id: string) => {
    const folder = browser.folders.find((entry) => entry.id === id);
    if (!folder) return;
    setName(folder.name);
    setDeleteMode("MOVE_UP");
    open({ type, folder });
  };
  const movingFolder = dialog?.type === "move" ? dialog.folder : null;
  const excludedIds = new Set<string>();
  if (movingFolder) {
    excludedIds.add(movingFolder.id);
    // Iterative traversal also terminates safely for a malformed cyclic hierarchy.
    let previousSize = -1;
    while (previousSize !== excludedIds.size) {
      previousSize = excludedIds.size;
      for (const folder of browser.folders) {
        if (folder.parentId && excludedIds.has(folder.parentId)) excludedIds.add(folder.id);
      }
    }
  }
  const error = <Alert severity="error">{t("folders.error")}</Alert>;
  const initialLoading = browser.loading && browser.folders.length === 0;
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}>
        <ToggleButtonGroup
          exclusive
          value={browser.flat ? "flat" : "folders"}
          onChange={(_event, value: string | null) => {
            if (value) browser.setFlat(value === "flat");
          }}
        >
          <ToggleButton value="folders">{t("folders.showFolders")}</ToggleButton>
          <ToggleButton value="flat">{t("folders.showFlat")}</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          aria-haspopup="dialog"
          disabled={pending}
          onClick={() => open({ type: "add" })}
        >
          {t("folders.add")}
        </Button>
      </Stack>
      {!browser.flat && (
        <FolderBreadcrumbs kind={kind} ancestors={browser.ancestors} onNavigate={browser.navigate} />
      )}
      {(browser.error || (operationError && !dialog)) && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              disabled={pending}
              onClick={() => void run(() => browser.refresh(), false)}
            >
              {t("folders.retry")}
            </Button>
          }
        >
          {t("folders.error")}
        </Alert>
      )}
      {(!browser.flat || browser.visibleFolders.length > 0) && (
        <Box
          role="region"
          aria-busy={browser.loading}
          aria-label={t(initialLoading ? "folders.loading" : "folders.showFolders")}
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 180px), 1fr))",
            gap: 2,
          }}
        >
          {initialLoading
            ? Array.from({ length: 3 }, (_, index) => (
                <Skeleton
                  key={index}
                  variant="rounded"
                  aria-hidden="true"
                  sx={{
                    height: 190,
                    "@media (prefers-reduced-motion: reduce)": {
                      animation: "none",
                      "&::after": { animation: "none" },
                    },
                  }}
                />
              ))
            : browser.visibleFolders.map((folder) => (
                <FolderTile
                  key={folder.id}
                  folder={folder}
                  onOpen={browser.navigate}
                  onRename={(id) => folderAction("rename", id)}
                  onMove={(id) => folderAction("move", id)}
                  onDelete={(id) => folderAction("delete", id)}
                />
              ))}
        </Box>
      )}
      {dialog?.type === "add" && (
        <Modal title={t("folders.add")} subtitle={t("folders.addChoice")} onClose={close}>
          <Stack spacing={2}>
            <Button
              variant="outlined"
              onClick={() => {
                setDialog(null);
                onAddItem();
              }}
            >
              {t(kind === "project" ? "folders.miniature" : "folders.template")}
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setName("");
                open({ type: "create" });
              }}
            >
              {t("folders.folder")}
            </Button>
          </Stack>
        </Modal>
      )}
      {(dialog?.type === "create" || dialog?.type === "rename") && (
        <Modal
          title={t(dialog.type === "create" ? "folders.createFolder" : "folders.rename")}
          subtitle=""
          onClose={close}
          footer={
            <>
              <Button onClick={close} disabled={pending}>
                {t("folders.cancel")}
              </Button>
              <Button
                type="submit"
                form="folder-name-form"
                variant="contained"
                disabled={pending || !name.trim()}
              >
                {t("folders.save")}
              </Button>
            </>
          }
        >
          <Stack
            component="form"
            id="folder-name-form"
            spacing={2}
            aria-busy={pending}
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) return;
              void run(() =>
                dialog.type === "create"
                  ? browser.create(name.trim())
                  : browser.rename(dialog.folder.id, name.trim()),
              );
            }}
          >
            {operationError && error}
            <TextField
              fullWidth
              label={t("folders.name")}
              value={name}
              disabled={pending}
              onChange={(event) => setName(event.target.value)}
            />
          </Stack>
        </Modal>
      )}
      {dialog?.type === "delete" && (
        <Modal
          title={t("folders.deleteFolder")}
          subtitle=""
          onClose={close}
          footer={
            <>
              <Button onClick={close} disabled={pending}>
                {t("folders.cancel")}
              </Button>
              <Button
                color="error"
                variant="contained"
                disabled={pending}
                onClick={() => void run(() => browser.remove(dialog.folder.id, deleteMode))}
              >
                {t("folders.delete")}
              </Button>
            </>
          }
        >
          <Stack spacing={2} aria-busy={pending}>
            {operationError && error}
            <Typography id="folder-delete-question">
              {t("folders.deleteQuestion", { name: dialog.folder.name })}
            </Typography>
            <RadioGroup
              aria-labelledby="folder-delete-question"
              value={deleteMode}
              onChange={(_event, value) =>
                setDeleteMode(value === "DELETE_CONTENTS" ? "DELETE_CONTENTS" : "MOVE_UP")
              }
            >
              <FormControlLabel
                disabled={pending}
                value="MOVE_UP"
                control={<Radio />}
                label={t("folders.moveContentsUp")}
              />
              <FormControlLabel
                disabled={pending}
                value="DELETE_CONTENTS"
                control={<Radio />}
                label={t("folders.deleteContents")}
              />
            </RadioGroup>
          </Stack>
        </Modal>
      )}
      {movingFolder && (
        <FolderPicker
          folders={browser.folders}
          excludedIds={[...excludedIds]}
          onClose={close}
          onMove={async (destination) => {
            if (destination !== null && excludedIds.has(destination)) return;
            await browser.move(movingFolder.id, destination);
            setDialog(null);
          }}
        />
      )}
    </Stack>
  );
}
