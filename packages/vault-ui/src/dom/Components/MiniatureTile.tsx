import { Card, CardActionArea, LinearProgress } from "@mui/material";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { memo } from "react";
import { useTranslation } from "react-i18next";

import { dialogPreloadHandlers } from "../dialog-preload";
import { Check } from "../icons";
import type { Miniature, Paint } from "../types";
import { thumbnailImageProps } from "../image-thumbnails";

import { PaintGradientPlaceholder } from "./PaintGradientPlaceholder";

export const MiniatureTile = memo(function MiniatureTile({
  mini,
  paints,
  swatches,
  total,
  missing,
  onClick,
  onOpen,
  sx,
}: {
  mini: Pick<Miniature, "id" | "title" | "status" | "imageUrl"> & { thumbnailUrl?: string | null };
  paints?: Paint[];
  swatches?: { colorHex: string | null }[];
  total: number;
  missing: number;
  sx?: SxProps<Theme>;
} & ({ onClick: () => void; onOpen?: never } | { onOpen: (id: string) => void; onClick?: never })) {
  const { t } = useTranslation("components");
  const previewUrl = mini.thumbnailUrl ?? mini.imageUrl;
  const ready = total > 0 && missing === 0,
    pct = total ? ((total - missing) / total) * 100 : 0;
  return (
    <Card
      sx={[
        {
          boxSizing: "border-box",
          overflow: "hidden",
          transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
          "@media (hover: hover)": {
            "&:hover": {
              transform: "translateY(-2px)",
              borderColor: "var(--line-strong)",
              boxShadow: "0 12px 28px -12px rgb(var(--shadow-color) / 22%)",
            },
          },
          "&:active": {
            transform: "scale(0.985)",
          },
          "@media (prefers-reduced-motion: reduce)": {
            "&:hover": {
              transform: "none",
            },
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <CardActionArea
        {...dialogPreloadHandlers("project")}
        onClick={onOpen ? () => onOpen(mini.id) : onClick}
        sx={[
          {
            boxSizing: "border-box",
            display: "block",
          },
          { lineHeight: 1.5 },
        ]}
      >
        <Box
          component="div"
          sx={{
            position: "relative",
            aspectRatio: "4/5",
            bgcolor: "var(--sunken)",
          }}
        >
          {previewUrl ? (
            <Box
              component="img"
              {...thumbnailImageProps(previewUrl, "(max-width: 599px) 50vw, (max-width: 1199px) 33vw, 240px")}
              alt=""
              draggable={false}
              sx={{
                pointerEvents: "none",
                position: "absolute",
                inset: 0,
                height: "100%",
                width: "100%",
                objectFit: "cover",
                WebkitUserSelect: "none",
                userSelect: "none",
              }}
            />
          ) : (
            <PaintGradientPlaceholder paints={swatches ?? paints ?? []} />
          )}
          <Box
            component="div"
            sx={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(to top in oklab, color-mix(in oklab, var(--scrim) 75%, transparent) 0%, color-mix(in oklab, var(--scrim) 5%, transparent) 50%, transparent 100%)",
            }}
          />
          <Box
            component="span"
            sx={[
              {
                boxSizing: "border-box",
                position: "absolute",
                top: "0.5rem",
                left: "0.5rem",
                borderRadius: "calc(infinity * 1px)",
                px: 1,
                py: 0.25,
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                color: "var(--on-scrim)",
                textTransform: "uppercase",
                WebkitBackdropFilter: "blur(8px)",
                backdropFilter: "blur(8px)",
              },
              mini.status === "OWNED"
                ? {
                    bgcolor: "color-mix(in oklab, var(--brand) 85%, transparent)",
                  }
                : {
                    bgcolor: "color-mix(in oklab, var(--rust) 85%, transparent)",
                  },
            ]}
          >
            {mini.status === "OWNED" ? t("owned") : t("wishlist")}
          </Box>
          {ready && (
            <Box
              component="span"
              sx={{
                position: "absolute",
                top: "0.5rem",
                right: "0.5rem",
                display: "grid",
                height: "1.5rem",
                width: "1.5rem",
                placeItems: "center",
                borderRadius: "calc(infinity * 1px)",
                bgcolor: "var(--ok)",
                color: "var(--ok-soft)",
                boxShadow: "var(--shadow-sm)",
              }}
              title={t("allPaintsReady")}
            >
              <Check size={13} strokeWidth={3} />
            </Box>
          )}
          <Box
            component="div"
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
              {mini.title}
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
              {total === 0
                ? t("noRecipeYet")
                : ready
                  ? t("readyToPaint")
                  : t("miniaturePaintsMissing", { missing, total })}
            </Box>
          </Box>
        </Box>
        <LinearProgress
          variant="determinate"
          value={pct}
          aria-label={t("paintsOwned")}
          color={ready ? "success" : "secondary"}
          sx={{
            boxSizing: "border-box",
            height: "0.25rem",
            borderRadius: "0",
          }}
        />
      </CardActionArea>
    </Card>
  );
});
