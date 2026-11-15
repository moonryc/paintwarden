import EditOutlined from "@mui/icons-material/EditOutlined";
import FolderOutlined from "@mui/icons-material/FolderOutlined";
import ViewModule from "@mui/icons-material/ViewModuleOutlined";
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { FolderBrowserState } from "../graphql/folder-hooks";

import { FolderBreadcrumbs } from "./FolderBreadcrumbs";
import { FolderNameDialog } from "./FolderNameDialog";
import { FolderPicker } from "./FolderPicker";
import { FolderTile, type FolderView } from "./FolderTile";
import { Modal } from "./Modal";

// Header toggles fill with the brand color when on, so the current mode is obvious.
const selectedFillSx = {
  "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "var(--brand)", color: "var(--brand-fg)" },
} as const;

type Dialog = { type: "rename" | "delete" | "move"; folder: FolderView };

/** Renders one folder as a grid tile; pages put these first in their item grid. */
export type RenderFolder = (folder: FolderView, sx?: SxProps<Theme>) => ReactNode;

/**
 * Folder navigation header (breadcrumbs and view toggle) plus the folder dialogs. The page's
 * item grid is `children`, which gets `renderFolder` so folders share that grid.
 */
export function FolderBrowser({
  browser,
  kind,
  children,
  editing = false,
  onEditingChange,
}: {
  browser: FolderBrowserState;
  kind: "project" | "template";
  /** Edit mode: items show select checkboxes for moving several at once. */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  children: (renderFolder: RenderFolder) => ReactNode;
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
  const renderFolder: RenderFolder = (folder, sx) => (
    <FolderTile
      key={folder.id}
      folder={folder}
      sx={sx}
      onOpen={browser.navigate}
      onRename={(id) => folderAction("rename", id)}
      onMove={(id) => folderAction("move", id)}
      onDelete={(id) => folderAction("delete", id)}
    />
  );
  return (
    <>
      <Stack spacing={2} sx={{ mb: 2 }}>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            columnGap: 2,
            rowGap: 1,
            minHeight: 40,
          }}
        >
          <Box sx={{ flex: "1 1 auto", minWidth: 0 }}>
            {browser.flat ? (
              <Typography sx={{ fontWeight: 700 }}>
                {t(kind === "project" ? "folders.projects" : "folders.templateFolders")}
              </Typography>
            ) : (
              <FolderBreadcrumbs kind={kind} ancestors={browser.ancestors} onNavigate={browser.navigate} />
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            {onEditingChange && (
              <ToggleButtonGroup
                size="small"
                value={editing ? ["edit"] : []}
                onChange={() => onEditingChange(!editing)}
              >
                <Tooltip title={t("folders.selectItems")}>
                  <ToggleButton value="edit" aria-label={t("folders.selectItems")} sx={selectedFillSx}>
                    <EditOutlined fontSize="small" aria-hidden />
                  </ToggleButton>
                </Tooltip>
              </ToggleButtonGroup>
            )}
            <ToggleButtonGroup
              exclusive
              size="small"
              value={browser.flat ? "flat" : "folders"}
              onChange={(_event, value: string | null) => {
                if (value) browser.setFlat(value === "flat");
              }}
            >
              <Tooltip title={t("folders.showFolders")}>
                <ToggleButton value="folders" sx={selectedFillSx} aria-label={t("folders.showFolders")}>
                  <FolderOutlined fontSize="small" aria-hidden />
                </ToggleButton>
              </Tooltip>
              <Tooltip title={t("folders.showFlat")}>
                <ToggleButton value="flat" sx={selectedFillSx} aria-label={t("folders.showFlat")}>
                  <ViewModule fontSize="small" aria-hidden />
                </ToggleButton>
              </Tooltip>
            </ToggleButtonGroup>
          </Box>
        </Box>
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
      </Stack>
      {children(renderFolder)}
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
    </>
  );
}
