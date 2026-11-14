import { useTranslation } from "react-i18next";
import { imageUrl } from "../utils/image-cache";
import { ButtonBase } from "@mui/material";
import Box from "@mui/material/Box";

import { PaintGradientPlaceholder } from "../Components/PaintGradientPlaceholder";
import { Fullscreen } from "../icons";
import { up } from "../theme-tokens";
import type { Miniature, Paint } from "../types";
import { getStages } from "../utils/constants";

// The top of a project: its photo, or a blend of its paints when it has none, with the title and
// painting stage over a dark gradient. Clicking a photo opens it full screen.
export function ProjectHero({
  miniature,
  paints,
  onOpenImage,
}: {
  miniature: Miniature;
  // The project's paints, blended when there is no photo.
  paints: Paint[];
  onOpenImage(): void;
}) {
  const { t } = useTranslation("components");
  return (
    <ButtonBase
      component="div"
      role={miniature.imageUrl ? "button" : undefined}
      tabIndex={miniature.imageUrl ? 0 : -1}
      disabled={!miniature.imageUrl}
      onClick={() => miniature.imageUrl && onOpenImage()}
      aria-label={miniature.imageUrl ? t("viewMiniatureFullScreen", { name: miniature.title }) : undefined}
      sx={[
        {
          boxSizing: "border-box",
          position: "relative",
          display: "block",
          width: "100%",
          flexShrink: "0",
          overflow: "hidden",
          bgcolor: "var(--sunken)",
          textAlign: "left",
        },
        miniature.imageUrl
          ? { height: "15rem", [up.md]: { height: "18rem" } }
          : { height: "10rem", [up.md]: { height: "11rem" } },
      ]}
    >
      {miniature.imageUrl ? (
        <>
          <Box
            component="img"
            src={imageUrl(miniature.imageUrl)}
            alt=""
            aria-hidden="true"
            draggable={false}
            sx={{
              pointerEvents: "none",
              position: "absolute",
              inset: 0,
              height: "100%",
              width: "100%",
              scale: "110% 110%",
              objectFit: "cover",
              opacity: 0.25,
              filter: "blur(24px)",
              WebkitUserSelect: "none",
              userSelect: "none",
            }}
          />
          <Box
            component="img"
            src={imageUrl(miniature.imageUrl)}
            alt={miniature.title}
            draggable={false}
            sx={{
              pointerEvents: "none",
              position: "relative",
              height: "100%",
              width: "100%",
              objectFit: "contain",
              WebkitUserSelect: "none",
              userSelect: "none",
            }}
          />
        </>
      ) : (
        <PaintGradientPlaceholder paints={paints} showIcon={false} />
      )}
      <Box
        component="div"
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(to top in oklab, color-mix(in oklab, var(--scrim) 70%, transparent) 0%, color-mix(in oklab, var(--scrim) 10%, transparent) 50%, transparent 100%)",
        }}
      />
      {miniature.imageUrl && (
        <Box
          component="span"
          sx={{
            position: "absolute",
            top: "1rem",
            left: "1rem",
            display: "grid",
            height: "2.25rem",
            width: "2.25rem",
            placeItems: "center",
            borderRadius: "calc(infinity * 1px)",
            bgcolor: "color-mix(in oklab, var(--scrim) 50%, transparent)",
            color: "var(--on-scrim)",
            WebkitBackdropFilter: "blur(8px)",
            backdropFilter: "blur(8px)",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1)",
            ".MuiButtonBase-root:hover &": {
              "@media (hover: hover)": {
                bgcolor: "color-mix(in oklab, var(--scrim) 70%, transparent)",
              },
            },
          }}
        >
          <Fullscreen size={20} />
        </Box>
      )}
      <Box
        component="div"
        sx={{
          position: "absolute",
          right: "9rem",
          bottom: "1rem",
          left: "1.25rem",
          color: "var(--on-scrim)",
          [up.md]: {
            left: "1.75rem",
          },
        }}
      >
        <Box
          component="span"
          sx={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: ".16em",
            color: "color-mix(in oklab, var(--on-scrim) 75%, transparent)",
            textTransform: "uppercase",
          }}
        >
          {miniature.status === "OWNED" ? t("inCollection") : t("wishlistProject")} ·{" "}
          {getStages().find(([stage]) => stage === miniature.paintingStatus)?.[1]}
        </Box>
        <Box
          component="h2"
          sx={{
            m: 0,
            fontFamily: "var(--font-serif)",
            letterSpacing: "-0.02em",
            fontOpticalSizing: "auto",
            fontSize: "1.5rem",
            lineHeight: 1.25,
            fontWeight: 600,
            [up.md]: {
              fontSize: "1.875rem",
              lineHeight: 1.25,
            },
          }}
        >
          {miniature.title}
        </Box>
      </Box>
    </ButtonBase>
  );
}
