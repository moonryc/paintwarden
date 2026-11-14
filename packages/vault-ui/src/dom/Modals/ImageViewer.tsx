import { formatNumber } from "../i18n";
import { useTranslation } from "react-i18next";
import { imageUrl } from "../utils/image-cache";
import { Dialog, IconButton } from "@mui/material";
import Box from "@mui/material/Box";
import type { PointerEvent } from "react";
import { useRef, useState } from "react";

import { RotateCw, X, ZoomIn, ZoomOut } from "../icons";
import { up } from "../theme-tokens";
import { truncateSx } from "../utils/truncate";

export function ImageViewer({ src, alt, onClose }: { src: string; alt: string; onClose(): void }) {
  const { t } = useTranslation("components");
  const MIN_SCALE = 1,
    MAX_SCALE = 5,
    SCALE_STEP = 0.5;
  const [scale, setScale] = useState(MIN_SCALE),
    [offset, setOffset] = useState({ x: 0, y: 0 }),
    [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null>(
    null,
  );
  const setZoom = (next: number) => {
    const zoom = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    setScale(zoom);
    if (zoom === MIN_SCALE) setOffset({ x: 0, y: 0 });
  };
  const reset = () => {
    setScale(MIN_SCALE);
    setOffset({ x: 0, y: 0 });
  };
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (scale <= MIN_SCALE) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    setDragging(true);
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    setOffset({
      x: drag.current.offsetX + event.clientX - drag.current.x,
      y: drag.current.offsetY + event.clientY - drag.current.y,
    });
  };
  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
  };
  return (
    <Dialog
      open
      fullScreen
      onClose={(_, reason) => reason !== "backdropClick" && onClose()}
      slotProps={{
        paper: {
          sx: {
            boxSizing: "border-box",
            bgcolor: "var(--scrim)",
            color: "var(--on-scrim)",
          },
        },
      }}
    >
      <Box
        component="div"
        sx={{
          position: "relative",
          display: "flex",
          height: "100%",
          minHeight: 0,
          flexDirection: "column",
          overflow: "hidden",
          bgcolor: "var(--scrim)",
        }}
      >
        <Box
          component="div"
          sx={{
            position: "absolute",
            top: "max(4rem, calc(env(safe-area-inset-top) + 0.75rem))",
            right: "0.75rem",
            left: "0.75rem",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
            [up.md]: {
              top: "1.25rem",
              right: "1.25rem",
              left: "1.25rem",
            },
          }}
        >
          <Box
            component="div"
            sx={{
              boxSizing: "border-box",
              minWidth: 0,
              borderRadius: "calc(infinity * 1px)",
              bgcolor: "color-mix(in oklab, var(--scrim) 65%, transparent)",
              px: 2,
              py: 1,
              WebkitBackdropFilter: "blur(8px)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Box
              component="p"
              sx={{
                m: 0,
                ...truncateSx,
                fontSize: "0.875rem",
                lineHeight: 10 / 7,
                fontWeight: 600,
              }}
            >
              {alt}
            </Box>
            <Box
              component="p"
              sx={{
                m: 0,
                fontSize: "11px",
                color: "color-mix(in oklab, var(--on-scrim) 65%, transparent)",
              }}
            >
              {t("scrollOrUseControlsToZoomDragToPan")}
            </Box>
          </Box>
          <IconButton
            color="overlay"
            onClick={onClose}
            aria-label={t("closeImageViewer")}
            sx={{
              boxSizing: "border-box",
              flexShrink: "0",
              bgcolor: "color-mix(in oklab, var(--scrim) 65%, transparent)",
              WebkitBackdropFilter: "blur(8px)",
              backdropFilter: "blur(8px)",
              // Keeps the dark backing on touch, where MUI's hover would clear it.
              "&:hover": {
                bgcolor: "color-mix(in oklab, var(--scrim) 65%, transparent)",
                "@media (hover: hover)": {
                  bgcolor: "color-mix(in oklab, var(--on-scrim) 15%, transparent)",
                },
              },
            }}
          >
            <X size={20} />
          </IconButton>
        </Box>
        <Box
          component="div"
          sx={[
            {
              position: "relative",
              minHeight: 0,
              flex: "1",
              overflow: "hidden",
            },
            scale > MIN_SCALE
              ? dragging
                ? {
                    cursor: "grabbing",
                  }
                : {
                    cursor: "grab",
                  }
              : {
                  cursor: "zoom-in",
                },
          ]}
          style={{ touchAction: "none" }}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onDoubleClick={() => (scale === MIN_SCALE ? setZoom(2) : reset())}
          onWheel={(event) => {
            event.preventDefault();
            setZoom(scale + (event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP));
          }}
        >
          <Box
            component="img"
            src={imageUrl(src)}
            alt={alt}
            draggable={false}
            sx={{
              pointerEvents: "none",
              position: "absolute",
              inset: 0,
              height: "100%",
              width: "100%",
              objectFit: "contain",
              willChange: "transform",
              WebkitUserSelect: "none",
              userSelect: "none",
            }}
            style={{
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
              transition: dragging ? "none" : "transform 120ms ease-out",
            }}
          />
        </Box>
        <Box
          component="div"
          sx={{
            boxSizing: "border-box",
            position: "absolute",
            right: "0.75rem",
            bottom: "calc(1rem + env(safe-area-inset-bottom))",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            borderRadius: "calc(infinity * 1px)",
            bgcolor: "color-mix(in oklab, var(--scrim) 70%, transparent)",
            p: 0.75,
            boxShadow: "var(--shadow-xl)",
            WebkitBackdropFilter: "blur(8px)",
            backdropFilter: "blur(8px)",
            [up.md]: {
              right: "1.25rem",
            },
          }}
        >
          <IconButton
            color="overlay"
            onClick={() => setZoom(scale - SCALE_STEP)}
            disabled={scale <= MIN_SCALE}
            aria-label={t("zoomOut")}
            sx={{
              boxSizing: "border-box",
            }}
          >
            <ZoomOut size={20} />
          </IconButton>
          <Box
            component="span"
            sx={{
              width: "3.5rem",
              textAlign: "center",
              fontSize: "0.75rem",
              lineHeight: 4 / 3,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatNumber(scale, { style: "percent", maximumFractionDigits: 0 })}
          </Box>
          <IconButton
            color="overlay"
            onClick={() => setZoom(scale + SCALE_STEP)}
            disabled={scale >= MAX_SCALE}
            aria-label={t("zoomIn")}
            sx={{
              boxSizing: "border-box",
            }}
          >
            <ZoomIn size={20} />
          </IconButton>
          <Box
            component="span"
            sx={{
              mx: 0.5,
              height: "1.5rem",
              width: "1px",
              bgcolor: "color-mix(in oklab, var(--on-scrim) 20%, transparent)",
            }}
          />
          <IconButton
            color="overlay"
            onClick={reset}
            disabled={scale === MIN_SCALE && offset.x === 0 && offset.y === 0}
            aria-label={t("resetImageView")}
            sx={{
              boxSizing: "border-box",
            }}
          >
            <RotateCw size={18} />
          </IconButton>
          <Box
            component="span"
            sx={{
              mx: 0.5,
              height: "1.5rem",
              width: "1px",
              bgcolor: "color-mix(in oklab, var(--on-scrim) 20%, transparent)",
              [up.md]: {
                display: "none",
              },
            }}
          />
          <IconButton
            color="overlay"
            onClick={onClose}
            aria-label={t("closeImageViewer")}
            sx={{
              boxSizing: "border-box",
              [up.md]: {
                display: "none",
              },
            }}
          >
            <X size={20} />
          </IconButton>
        </Box>
      </Box>
    </Dialog>
  );
}
