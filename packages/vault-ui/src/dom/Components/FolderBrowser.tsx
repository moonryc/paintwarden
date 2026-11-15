import FolderOutlined from "@mui/icons-material/FolderOutlined";
import ViewModule from "@mui/icons-material/ViewModuleOutlined";
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { FolderBrowserState } from "../graphql/folder-hooks";

import { FolderBreadcrumbs } from "./FolderBreadcrumbs";
import { FolderNameDialog } from "./FolderNameDialog";
import { FolderPicker } from "./FolderPicker";
import { FolderTile, type FolderView } from "./FolderTile";
import { Modal } from "./Modal";

type Dialog = { type: "rename" | "delete" | "move"; folder: FolderView };

export function FolderBrowser({
  browser,
  kind,
}: {
  browser: FolderBrowserState;
  kind: "project" | "template";
}) {
  const { t } = useTranslation("pages");
  const [dialog, setDialog] = useState<Dialog | null>(null);
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
          size="small"
          value={browser.flat ? "flat" : "folders"}
          onChange={(_event, value: string | null) => {
            if (value) browser.setFlat(value === "flat");
          }}
        >
          <ToggleButton value="folders" sx={{ gap: 0.75 }}>
            <FolderOutlined fontSize="small" aria-hidden />
            {t("folders.showFolders")}
          </ToggleButton>
          <ToggleButton value="flat" sx={{ gap: 0.75 }}>
            <ViewModule fontSize="small" aria-hidden />
            {t("folders.showFlat")}
          </ToggleButton>
        </ToggleButtonGroup>
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
      {dialog?.type === "rename" && (
        <FolderNameDialog
          title={t("folders.rename")}
          initialName={dialog.folder.name}
          onSave={(name) => browser.rename(dialog.folder.id, name)}
          onClose={() => setDialog(null)}
        />
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
