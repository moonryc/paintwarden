import Folder from "@mui/icons-material/Folder";
import MoreVert from "@mui/icons-material/MoreVert";
import { Box, Card, CardActionArea, IconButton, Menu, MenuItem, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export type FolderView = {
  id: string;
  name: string;
  parentId: string | null;
  directCount: number;
  recursiveCount: number;
  coverThumbnailUrl?: string | null;
};

export function FolderTile({
  folder,
  onOpen,
  onRename,
  onMove,
  onDelete,
}: {
  folder: FolderView;
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
  onMove: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation("pages");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const action = (callback: (id: string) => void) => {
    setAnchor(null);
    callback(folder.id);
  };
  return (
    <Card sx={{ position: "relative", overflow: "hidden", bgcolor: "var(--surface)" }}>
      <CardActionArea onClick={() => onOpen(folder.id)} title={t("folders.open", { name: folder.name })}>
        <Box
          sx={{
            aspectRatio: "4/3",
            bgcolor: "var(--sunken)",
            display: "grid",
            placeItems: "center",
            position: "relative",
          }}
        >
          {folder.coverThumbnailUrl && (
            <Box
              component="img"
              src={folder.coverThumbnailUrl}
              alt=""
              loading="lazy"
              decoding="async"
              sx={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
          <Folder
            sx={{
              position: "relative",
              fontSize: 64,
              color: "var(--brand)",
              bgcolor: "var(--surface)",
              borderRadius: 2,
              p: 1,
            }}
          />
        </Box>
        <Box sx={{ p: 2, pr: 6 }}>
          <Typography
            component="h3"
            sx={{ fontFamily: "var(--font-serif)", fontWeight: 600, overflowWrap: "anywhere" }}
          >
            {folder.name}
          </Typography>
          <Typography variant="body2" sx={{ color: "var(--ink-faint)" }}>
            {t("folders.itemCount", { count: folder.recursiveCount })}
          </Typography>
        </Box>
      </CardActionArea>
      <IconButton
        aria-label={t("folders.actions", { name: folder.name })}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ position: "absolute", bottom: 16, right: 8 }}
      >
        <MoreVert />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => action(onRename)}>{t("folders.rename")}</MenuItem>
        <MenuItem onClick={() => action(onMove)}>{t("folders.move")}</MenuItem>
        <MenuItem onClick={() => action(onDelete)}>{t("folders.delete")}</MenuItem>
      </Menu>
    </Card>
  );
}
