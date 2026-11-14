import { Card, CardActionArea } from "@mui/material";
import Box from "@mui/material/Box";
import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import type { MiniatureTemplate } from "../../types";
import { thumbnailImageProps } from "../../image-thumbnails";
import { liftCardSx } from "../../utils/lift-card";

// One template in the templates grid: its picture, name, source and counts. It opens the
// template's details.
export function TemplateCard({
  template,
  index,
  onOpen,
  onKeyDown,
}: {
  template: MiniatureTemplate;
  // Position in the whole filtered list, for keyboard paging through the windowed grid.
  index: number;
  onOpen: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const { t, i18n } = useTranslation("pages");
  const previewUrl = template.thumbnailUrl ?? template.imageUrl;
  return (
    <Card sx={liftCardSx}>
      <CardActionArea
        onClick={onOpen}
        onKeyDown={onKeyDown}
        data-template-index={index}
        sx={{ display: "block", lineHeight: 1.5 }}
      >
        <Box sx={{ position: "relative", aspectRatio: "4 / 5", bgcolor: "var(--sunken)" }}>
          {previewUrl && (
            <Box
              component="img"
              {...thumbnailImageProps(previewUrl, "(max-width: 599px) 50vw, (max-width: 1199px) 33vw, 240px")}
              alt={t("templatesImageAlt", { name: template.name })}
              sx={{
                position: "absolute",
                inset: 0,
                height: "100%",
                width: "100%",
                objectFit: "cover",
              }}
            />
          )}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(to top in oklab, color-mix(in oklab, var(--scrim) 75%, transparent) 0%, color-mix(in oklab, var(--scrim) 5%, transparent) 50%, transparent 100%)",
            }}
          />
          <Box
            component="span"
            sx={{
              boxSizing: "border-box",
              position: "absolute",
              top: "0.5rem",
              left: "0.5rem",
              borderRadius: "calc(infinity * 1px)",
              bgcolor: "color-mix(in oklab, var(--brand) 85%, transparent)",
              px: 1,
              py: 0.25,
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "var(--on-scrim)",
              textTransform: "uppercase",
              WebkitBackdropFilter: "blur(8px)",
              backdropFilter: "blur(8px)",
            }}
          >
            {template.kind === "user" ? t("templatesMine") : t("templatesReadOnly")}
          </Box>
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
              {template.name}
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
              {t("templatesSchemeCount", {
                count: template.schemeCount,
                formattedCount: new Intl.NumberFormat(i18n.language).format(template.schemeCount),
              })}{" "}
              ·{" "}
              {t("templatesPaintCount", {
                count: template.paintCount,
                formattedCount: new Intl.NumberFormat(i18n.language).format(template.paintCount),
              })}
            </Box>
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
}
