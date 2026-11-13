import { ButtonBase, Card, CircularProgress, Collapse } from "@mui/material";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import { useId, useState } from "react";

import { ChevronDown } from "../icons";
import { listResetSx } from "../utils/element-resets";

// A card that keeps a progress summary visible and expands into a checklist of paints, with a
// hint and a bulk action above the list. A complete card can't expand.
export function ProgressSummaryCard({
  title,
  subtitle,
  progress,
  progressLabel,
  hint,
  action,
  complete = false,
  sx,
  children,
  checklist,
}: {
  title: string;
  subtitle: string;
  progress: number;
  progressLabel: string;
  hint: string;
  action: ReactNode;
  complete?: boolean;
  sx?: SxProps<Theme>;
  // PaintChecklistItem elements, or a replacement list that manages its own viewport.
  children?: ReactNode;
  checklist?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const listId = `${id}-list`;
  return (
    <Card
      component="section"
      aria-labelledby={id}
      sx={[
        {
          overflow: "hidden",
          borderColor: complete
            ? "color-mix(in oklab, var(--ok) 40%, var(--line))"
            : "color-mix(in oklab, var(--gold) 35%, var(--line))",
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <ButtonBase
        component="div"
        disabled={complete}
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={complete ? undefined : expanded}
        aria-controls={complete ? undefined : listId}
        sx={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          gap: 1.5,
          p: 2,
          textAlign: "left",
          color: "inherit",
          "&.Mui-disabled": { color: "inherit" },
          "&:focus-visible": { outline: "2px solid var(--brand)", outlineOffset: -2 },
        }}
      >
        <Box
          sx={{
            position: "relative",
            display: "grid",
            placeItems: "center",
            width: 56,
            height: 56,
            flexShrink: 0,
          }}
        >
          <CircularProgress
            variant="determinate"
            value={100}
            size={56}
            thickness={4.5}
            aria-hidden="true"
            sx={{ position: "absolute", color: "var(--sunken)" }}
          />
          <CircularProgress
            variant="determinate"
            value={progress}
            size={56}
            thickness={4.5}
            color={complete ? "success" : "secondary"}
            aria-label={progressLabel}
            sx={{ position: "absolute", "& circle": { strokeLinecap: "round" } }}
          />
          <Box component="span" sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {Math.round(progress)}%
          </Box>
        </Box>
        <Box sx={{ minWidth: 0, flex: "1 1 auto" }}>
          <Box component="h3" id={id} sx={{ m: 0, fontSize: 14, fontWeight: 700 }}>
            {title}
          </Box>
          <Box component="p" sx={{ m: 0, mt: 0.25, fontSize: 12, color: "var(--ink-faint)" }}>
            {subtitle}
          </Box>
        </Box>
        {!complete && (
          <ChevronDown
            size={18}
            aria-hidden="true"
            style={{
              flexShrink: 0,
              transform: expanded ? "rotate(180deg)" : undefined,
              transition: "transform .2s",
            }}
          />
        )}
      </ButtonBase>
      {!complete && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box id={listId} sx={{ borderTop: "1px solid var(--line)" }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: 1,
                px: 2,
                py: 1.5,
              }}
            >
              <Box component="p" sx={{ m: 0, fontSize: 12, color: "var(--ink-faint)" }}>
                {hint}
              </Box>
              {action}
            </Box>
            {checklist ?? (
              <Box
                component="ul"
                sx={{
                  ...listResetSx,
                  p: 1,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 230px), 1fr))",
                  gap: 0.5,
                  maxHeight: 360,
                  overflowY: "auto",
                  overscrollBehavior: "contain",
                }}
              >
                {children}
              </Box>
            )}
          </Box>
        </Collapse>
      )}
    </Card>
  );
}
