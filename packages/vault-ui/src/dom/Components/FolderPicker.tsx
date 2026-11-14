import ChevronRight from "@mui/icons-material/ChevronRight";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Folder from "@mui/icons-material/Folder";
import FolderOpen from "@mui/icons-material/FolderOpen";
import {
  Alert,
  Box,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { FolderView } from "./FolderTile";
import { Modal } from "./Modal";

export function FolderPicker({
  folders,
  excludedIds = [],
  onMove,
  onClose,
}: {
  folders: FolderView[];
  excludedIds?: readonly string[];
  onMove: (folderId: string | null) => void | Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation("pages");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const excluded = new Set(excludedIds);
  const children = new Map<string | null, FolderView[]>();
  for (const folder of folders) {
    const siblings = children.get(folder.parentId) ?? [];
    siblings.push(folder);
    children.set(folder.parentId, siblings);
  }
  const toggle = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const rows = (parentId: string | null, path: string[] = []) =>
    (children.get(parentId) ?? []).map((folder) => {
      // A malformed hierarchy must not recurse forever.
      if (path.includes(folder.id)) return null;
      const open = expanded.has(folder.id);
      const hasChildren = Boolean(children.get(folder.id)?.length);
      return (
        <Box component="li" key={folder.id} sx={{ listStyle: "none" }}>
          <Box sx={{ display: "flex", alignItems: "center", pl: path.length * 2 }}>
            {hasChildren ? (
              <IconButton
                aria-label={t(open ? "folders.collapse" : "folders.expand", { name: folder.name })}
                aria-expanded={open}
                onClick={() => toggle(folder.id)}
              >
                {open ? <ExpandMore /> : <ChevronRight />}
              </IconButton>
            ) : (
              <Box sx={{ width: 40, flexShrink: 0 }} />
            )}
            <ListItemButton
              selected={selected === folder.id}
              disabled={excluded.has(folder.id)}
              onClick={() => setSelected(folder.id)}
              aria-pressed={selected === folder.id}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{open ? <FolderOpen /> : <Folder />}</ListItemIcon>
              <ListItemText primary={folder.name} sx={{ overflowWrap: "anywhere" }} />
            </ListItemButton>
          </Box>
          {open && <List disablePadding>{rows(folder.id, [...path, folder.id])}</List>}
        </Box>
      );
    });
  return (
    <Modal
      title={t("folders.moveToFolder")}
      subtitle={t("folders.chooseDestination")}
      onClose={() => {
        if (!pending) onClose();
      }}
      footer={
        <>
          <Button variant="outlined" disabled={pending} onClick={onClose}>
            {t("folders.cancel")}
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="contained"
            disabled={
              pending ||
              (selected !== null &&
                (excluded.has(selected) || !folders.some((folder) => folder.id === selected)))
            }
            onClick={() => {
              if (pending) return;
              setPending(true);
              setFailed(false);
              void Promise.resolve()
                .then(() => onMove(selected))
                .catch(() => setFailed(true))
                .finally(() => setPending(false));
            }}
          >
            {t("folders.move")}
          </Button>
        </>
      }
    >
      {failed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("folders.error")}
        </Alert>
      )}
      <List disablePadding>
        <Box component="li" sx={{ listStyle: "none" }}>
          <ListItemButton
            selected={selected === null}
            aria-pressed={selected === null}
            onClick={() => setSelected(null)}
          >
            <ListItemText primary={t("folders.noFolder")} />
          </ListItemButton>
        </Box>
        {rows(null)}
      </List>
    </Modal>
  );
}
