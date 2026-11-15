import Folder from "@mui/icons-material/Folder";
import { Box, Card, CardActionArea, IconButton, Menu, MenuItem } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Ellipsis } from "../icons";

import { tileControlSx } from "./tile-control";

export type FolderView = {
  id: string;
  name: string;
  parentId: string | null;
  directCount: number;
  recursiveCount: number;
  coverThumbnailUrl?: string | null;
};

/** A folder card shaped like a miniature tile, so folders sit in the same grid as items. */
export function FolderTile({
  folder,
  onOpen,
  onRename,
  onMove,
  onDelete,
  sx,
}: {
  folder: FolderView;
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
  onMove: (id: string) => void;
  onDelete: (id: string) => void;
  sx?: SxProps<Theme>;
}) {
  const { t } = useTranslation("pages");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const action = (callback: (id: string) => void) => {
    setAnchor(null);
    callback(folder.id);
  };
  const cover = folder.coverThumbnailUrl;
  return (
    <Card
      sx={[
        {
          boxSizing: "border-box",
          position: "relative",
          overflow: "hidden",
          aspectRatio: "4/5",
          transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
          "@media (hover: hover)": {
            "&:hover": {
              transform: "translateY(-2px)",
              borderColor: "var(--line-strong)",
              boxShadow: "0 12px 28px -12px rgb(var(--shadow-color) / 22%)",
            },
          },
          "&:active": { transform: "scale(0.985)" },
          "@media (prefers-reduced-motion: reduce)": { "&:hover": { transform: "none" } },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <CardActionArea
        onClick={() => onOpen(folder.id)}
        title={t("folders.open", { name: folder.name })}
        sx={{ display: "block", height: "100%", lineHeight: 1.5 }}
      >
        <Box sx={{ position: "relative", height: "100%", bgcolor: "var(--sunken)" }}>
          {cover && (
            <Box
              component="img"
              src={cover}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              sx={{
                pointerEvents: "none",
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          )}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              pb: cover ? 0 : 5,
            }}
          >
            <Folder
              sx={
                cover
                  ? {
                      position: "absolute",
                      top: "0.5rem",
                      left: "0.5rem",
                      fontSize: 28,
                      p: 0.5,
                      borderRadius: 1.5,
                      color: "var(--brand)",
                      bgcolor: "var(--surface)",
                      boxShadow: 2,
                    }
                  : { fontSize: 72, color: "var(--brand)" }
              }
            />
          </Box>
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(to top in oklab, color-mix(in oklab, var(--scrim) 75%, transparent) 0%, color-mix(in oklab, var(--scrim) 5%, transparent) 50%, transparent 100%)",
            }}
          />
          <Box
            sx={{
              boxSizing: "border-box",
              position: "absolute",
              insetInline: 0,
              bottom: 0,
              p: 1.5,
              color: "var(--on-scrim)",
            }}
          >
            <Box
              component="h3"
              sx={{
                m: 0,
                overflow: "hidden",
                overflowWrap: "anywhere",
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: "2",
                fontFamily: "var(--font-serif)",
                letterSpacing: "-0.02em",
                fontOpticalSizing: "auto",
                fontSize: "1.02rem",
                lineHeight: 1.25,
                fontWeight: 600,
              }}
            >
              {folder.name}
            </Box>
            <Box
              component="p"
              sx={{
                m: 0,
                mt: 0.5,
                fontSize: "11px",
                fontWeight: 500,
                color: "color-mix(in oklab, var(--on-scrim) 75%, transparent)",
              }}
            >
              {t("folders.itemCount", { count: folder.recursiveCount })}
            </Box>
          </Box>
        </Box>
      </CardActionArea>
      <IconButton
        aria-label={t("folders.actions", { name: folder.name })}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ position: "absolute", top: 4, right: 4, ...tileControlSx }}
      >
        <Ellipsis size={18} />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => action(onRename)}>{t("folders.rename")}</MenuItem>
        <MenuItem onClick={() => action(onMove)}>{t("folders.move")}</MenuItem>
        <MenuItem onClick={() => action(onDelete)}>{t("folders.delete")}</MenuItem>
      </Menu>
    </Card>
  );
}
