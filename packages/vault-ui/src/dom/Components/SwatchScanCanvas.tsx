import CenterFocusStrong from "@mui/icons-material/CenterFocusStrong";
import Colorize from "@mui/icons-material/Colorize";
import ZoomIn from "@mui/icons-material/ZoomIn";
import ZoomOut from "@mui/icons-material/ZoomOut";
import { Alert, Box, Button, Collapse, IconButton, Paper, Skeleton, Stack, Tooltip } from "@mui/material";
import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";

import { imageUrl } from "../utils/image-cache";

import { canSampleImage, imagePoint, sampleImage, type ImagePoint } from "./swatch-sampling";

export type ScanPin = ImagePoint & { id: number; hex: string };
type View = { zoom: number; x: number; y: number };
const clampZoom = (zoom: number) => Math.max(1, Math.min(8, zoom));

function ScanCanvas({
  src,
  alt,
  pins,
  selected,
  onSample,
  onSelect,
}: {
  src: string;
  alt: string;
  pins: ScanPin[];
  selected: number | null;
  onSample(point: ImagePoint, hex: string): void;
  onSelect(id: number): void;
}) {
  const { t } = useTranslation("components");
  const stage = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLImageElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [frame, setFrame] = useState({ width: 1, height: 1 });
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [cursor, setCursor] = useState<ImagePoint>({ x: 0.5, y: 0.5 });
  const [loupe, setLoupe] = useState<(ImagePoint & { hex: string }) | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpId = useId();
  const pointers = useRef(new Map<number, ImagePoint>());
  const gesture = useRef<{ point: ImagePoint; view: View; distance: number; moved: boolean } | null>(null);
  const eligible = canSampleImage(src, location.href);
  const usable = eligible && loaded && !failed;
  const fit = Math.min(frame.width / size.width, frame.height / size.height);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setFrame({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      setView((old) => ({ ...old, zoom: clampZoom(old.zoom * Math.exp(-event.deltaY * 0.002)) }));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  const at = (client: ImagePoint) =>
    photo.current ? imagePoint(client, photo.current.getBoundingClientRect(), size) : null;
  const sample = (point: ImagePoint, commit: boolean) => {
    if (!photo.current || !usable) return;
    try {
      const hex = sampleImage(photo.current, point);
      if (hex) {
        setLoupe({ ...point, hex });
        if (commit) onSample(point, hex);
      }
    } catch {
      setFailed(true);
    }
  };
  const pointerGeometry = () => {
    const values = [...pointers.current.values()];
    const a = values[0],
      b = values[1] ?? a;
    return {
      point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      distance: values.length > 1 ? Math.hypot(a.x - b.x, a.y - b.y) : 0,
    };
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const geometry = pointerGeometry();
    gesture.current = { ...geometry, view: viewRef.current, moved: pointers.current.size > 1 };
    const point = at({ x: event.clientX, y: event.clientY });
    if (point) sample(point, false);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const geometry = pointerGeometry(),
      initial = gesture.current;
    const dx = geometry.point.x - initial.point.x,
      dy = geometry.point.y - initial.point.y;
    if (Math.hypot(dx, dy) > 5 || pointers.current.size > 1) initial.moved = true;
    if (initial.moved) {
      setLoupe(null);
      setView({
        zoom:
          initial.distance > 0
            ? clampZoom((initial.view.zoom * geometry.distance) / initial.distance)
            : initial.view.zoom,
        x: initial.view.x + dx,
        y: initial.view.y + dy,
      });
    }
  };
  const up = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    if (!pointers.current.has(event.pointerId)) return;
    if (!cancelled && !gesture.current?.moved && pointers.current.size === 1) {
      const point = at({ x: event.clientX, y: event.clientY });
      if (point) sample(point, true);
    }
    pointers.current.delete(event.pointerId);
    if (pointers.current.size) gesture.current = { ...pointerGeometry(), view: viewRef.current, moved: true };
    else gesture.current = null;
    setLoupe(null);
  };
  const keySample = () =>
    sample({ x: Math.round(cursor.x * (size.width - 1)), y: Math.round(cursor.y * (size.height - 1)) }, true);
  return (
    <Stack spacing={1}>
      {!eligible && <Alert severity="info">{t("scanExternal")}</Alert>}
      {failed && <Alert severity="error">{t("scanSampleFailed")}</Alert>}
      <Box sx={{ position: "relative" }}>
        <Box
          ref={stage}
          role="group"
          aria-label={t("scanImageControls")}
          aria-busy={!loaded && !failed}
          tabIndex={0}
          onKeyDown={(event) => {
            const delta = event.shiftKey ? 0.001 : 0.01;
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
              event.preventDefault();
              setCursor((old) => ({
                x: Math.max(
                  0,
                  Math.min(
                    1,
                    old.x + (event.key === "ArrowLeft" ? -delta : event.key === "ArrowRight" ? delta : 0),
                  ),
                ),
                y: Math.max(
                  0,
                  Math.min(
                    1,
                    old.y + (event.key === "ArrowUp" ? -delta : event.key === "ArrowDown" ? delta : 0),
                  ),
                ),
              }));
            } else if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              keySample();
            } else if (event.key === "+" || event.key === "=")
              setView((old) => ({ ...old, zoom: clampZoom(old.zoom + 0.5) }));
            else if (event.key === "-") setView((old) => ({ ...old, zoom: clampZoom(old.zoom - 0.5) }));
            else if (event.key === "Home") setView({ zoom: 1, x: 0, y: 0 });
          }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={(event) => up(event)}
          onPointerCancel={(event) => up(event, true)}
          sx={{
            height: { xs: "42dvh", md: "min(68dvh, 760px)" },
            minHeight: 230,
            position: "relative",
            overflow: "hidden",
            bgcolor: "var(--sunken)",
            touchAction: "none",
            cursor: "crosshair",
            userSelect: "none",
            borderRadius: 1,
            "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
          }}
        >
          {!loaded && !failed && (
            <Skeleton aria-hidden animation={false} variant="rectangular" width="100%" height="100%" />
          )}
          <Box
            sx={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: size.width * fit,
              height: size.height * fit,
              transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px)) scale(${view.zoom})`,
              transformOrigin: "center",
            }}
          >
            <Box
              component="img"
              ref={photo}
              src={imageUrl(src)}
              alt={alt}
              draggable={false}
              onLoad={(event) => {
                setSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
                setLoaded(true);
              }}
              onError={() => setFailed(true)}
              sx={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
            />
            {loaded && (
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  left: `${cursor.x * 100}%`,
                  top: `${cursor.y * 100}%`,
                  width: 16,
                  height: 16,
                  border: "2px solid white",
                  boxShadow: "0 0 0 1px black",
                  borderRadius: "50%",
                  pointerEvents: "none",
                  transform: `translate(-50%, -50%) scale(${1 / view.zoom})`,
                }}
              />
            )}
            {pins.map((pin, index) => (
              <Button
                key={pin.id}
                aria-label={t("scanPin", { number: index + 1, hex: pin.hex })}
                aria-pressed={selected === pin.id}
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                onClick={() => onSelect(pin.id)}
                sx={{
                  position: "absolute",
                  left: `${(pin.x / size.width) * 100}%`,
                  top: `${(pin.y / size.height) * 100}%`,
                  minWidth: 30,
                  minHeight: 30,
                  width: 30,
                  height: 30,
                  p: 0,
                  borderRadius: "50%",
                  bgcolor: pin.hex,
                  border: selected === pin.id ? "3px solid white" : "2px solid white",
                  boxShadow: "0 0 0 2px black",
                  transform: `translate(-50%, -50%) scale(${1 / view.zoom})`,
                  "&:hover": { bgcolor: pin.hex },
                }}
              />
            ))}
            {loupe && (
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  left: `${(loupe.x / size.width) * 100}%`,
                  top: `${(loupe.y / size.height) * 100}%`,
                  width: 52,
                  height: 52,
                  border: "3px solid white",
                  boxShadow: "0 0 0 2px black",
                  borderRadius: "50%",
                  bgcolor: loupe.hex,
                  backgroundImage: `url(${JSON.stringify(imageUrl(src))})`,
                  backgroundRepeat: "no-repeat",
                  backgroundSize: `${size.width * 4}px ${size.height * 4}px`,
                  backgroundPosition: `${26 - loupe.x * 4}px ${26 - loupe.y * 4}px`,
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: 4,
                    height: 4,
                    border: "1px solid white",
                    boxShadow: "0 0 0 1px black",
                    transform: "translate(-50%, -50%)",
                  },
                  pointerEvents: "none",
                  transformOrigin: "bottom center",
                  transform: `translate(-50%, -130%) scale(${1 / view.zoom})`,
                }}
              />
            )}
          </Box>
        </Box>
        <Paper
          elevation={2}
          sx={{
            position: "absolute",
            right: 8,
            bottom: 8,
            display: "flex",
            borderRadius: 2,
            bgcolor: "var(--surface)",
          }}
        >
          <Tooltip title={t("scanZoomOut")}>
            <span>
              <IconButton
                aria-label={t("scanZoomOut")}
                onClick={() => setView((old) => ({ ...old, zoom: clampZoom(old.zoom - 0.5) }))}
                disabled={view.zoom <= 1}
              >
                <ZoomOut />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t("scanZoomIn")}>
            <span>
              <IconButton
                aria-label={t("scanZoomIn")}
                onClick={() => setView((old) => ({ ...old, zoom: clampZoom(old.zoom + 0.5) }))}
                disabled={view.zoom >= 8}
              >
                <ZoomIn />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t("scanReset")}>
            <IconButton aria-label={t("scanReset")} onClick={() => setView({ zoom: 1, x: 0, y: 0 })}>
              <CenterFocusStrong />
            </IconButton>
          </Tooltip>
        </Paper>
      </Box>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}>
        <Button variant="outlined" startIcon={<Colorize />} onClick={keySample} disabled={!usable}>
          {t("scanSampleCursor")}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          aria-expanded={helpOpen}
          aria-controls={helpId}
          onClick={() => setHelpOpen((open) => !open)}
        >
          {t("scanControlsHelp")}
        </Button>
      </Stack>
      <Collapse in={helpOpen}>
        <Box id={helpId} sx={{ typography: "caption", color: "text.secondary" }}>
          {t("scanKeyboardHint")}
        </Box>
      </Collapse>
    </Stack>
  );
}

// A different original must not inherit loading, gesture or image geometry state.
export function SwatchScanCanvas(props: Parameters<typeof ScanCanvas>[0]) {
  return <ScanCanvas key={props.src} {...props} />;
}
