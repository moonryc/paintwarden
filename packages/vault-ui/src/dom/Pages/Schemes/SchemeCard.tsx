import { Card, CardActionArea, Chip } from "@mui/material";
import Box from "@mui/material/Box";
import { COLOR_CATEGORY_LABELS } from "@paint-vault/core/color-categories";
import { memo, type KeyboardEvent } from "react";

import { SchemeProgressChip } from "../../Components/SchemeProgressChip";
import { Check, Layers } from "../../icons";
import type { SchemeSummaryModel } from "../../graphql/miniature-scheme-model";
import { imageUrl } from "../../utils/image-cache";
import { liftCardSx } from "../../utils/lift-card";

// One color scheme in the schemes grid: its finished example or paint blend, readiness, name,
// category, source and paints. It opens the scheme.
export const SchemeCard = memo(function SchemeCard({
  scheme,
  summary,
  index,
  available,
  total,
  onOpen,
  onKeyDown,
}: {
  scheme: SchemeSummaryModel;
  summary: {
    gradient?: string | null;
    previewUrl?: string | null;
    uses: number;
    paintNames: string;
    previewMoreCount?: number;
  };
  // Position in the whole filtered list, for keyboard paging through the windowed grid.
  index: number;
  available: number;
  total: number;
  onOpen: (id: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
}) {
  const { gradient, previewUrl, uses, paintNames } = summary;
  const ready = total > 0 && available === total;
  return (
    <Card sx={{ ...liftCardSx, height: "18rem" }}>
      <CardActionArea
        onClick={() => onOpen(scheme.id)}
        onKeyDown={(event) => onKeyDown(event, index)}
        data-scheme-index={index}
        sx={{
          boxSizing: "border-box",
          display: "grid",
          height: "100%",
          width: "100%",
          gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
          gridTemplateRows: "repeat(2, minmax(0, 1fr))",
          textAlign: "left",
        }}
        className="group"
      >
        <Box
          component="div"
          sx={{
            position: "relative",
            height: "100%",
            minHeight: 0,
            width: "100%",
            overflow: "hidden",
            bgcolor: "var(--surface)",
          }}
          // The gradient also fills the frame while a remote preview image loads.
          style={gradient ? { background: gradient } : undefined}
        >
          {previewUrl ? (
            <>
              <Box
                component="img"
                src={imageUrl(previewUrl ?? "")}
                alt=""
                aria-hidden="true"
                loading="lazy"
                sx={{
                  position: "absolute",
                  inset: 0,
                  height: "100%",
                  width: "100%",
                  scale: "125% 125%",
                  objectFit: "cover",
                  opacity: 0.55,
                  filter: "blur(24px) saturate(125%)",
                }}
              />
              <Box
                component="span"
                sx={{
                  position: "absolute",
                  inset: 0,
                  bgcolor: "color-mix(in oklab, var(--scrim) 10%, transparent)",
                }}
                aria-hidden="true"
              />
              <Box
                component="img"
                src={imageUrl(previewUrl ?? "")}
                alt={`${scheme.name} finished example`}
                loading="lazy"
                sx={{
                  position: "absolute",
                  top: "0.5rem",
                  left: "50%",
                  display: "block",
                  aspectRatio: "1 / 1",
                  height: "calc(100% - 1rem)",
                  translate: "calc(calc(1 / 2 * 100%) * -1) 0",
                  objectFit: "cover",
                  boxShadow: "0 0 18px rgb(var(--shadow-color) / 35%)",
                  transition: "scale 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                  ".group:hover &": {
                    "@media (hover: hover)": {
                      scale: "1.03",
                    },
                  },
                }}
              />
            </>
          ) : (
            <Box
              component="div"
              sx={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                bgcolor: "color-mix(in oklab, var(--scrim) 10%, transparent)",
                color: "color-mix(in oklab, var(--on-scrim) 85%, transparent)",
              }}
            >
              <Box
                component="span"
                sx={{
                  transition: "scale 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                  ".group:hover &": {
                    "@media (hover: hover)": {
                      scale: "110% 110%",
                    },
                  },
                }}
              >
                <Layers size={30} strokeWidth={1.4} />
              </Box>
            </Box>
          )}
          <Box component="span" sx={{ position: "absolute", top: 12, left: 12, zIndex: 1, display: "flex" }}>
            <SchemeProgressChip available={available} total={total} size="sm" />
          </Box>
          {!!summary.previewMoreCount && (
            <Chip
              size="small"
              label={`+${summary.previewMoreCount} more`}
              aria-label={`+${summary.previewMoreCount} more paint entries in the full scheme`}
              sx={{ position: "absolute", bottom: 12, right: 12, zIndex: 1, bgcolor: "background.paper" }}
            />
          )}
        </Box>
        <Box
          component="div"
          sx={{
            boxSizing: "border-box",
            minHeight: 0,
            width: "100%",
            overflow: "hidden",
            p: 2.5,
          }}
        >
          <Box
            component="div"
            sx={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 1.5,
            }}
          >
            <Box
              component="h3"
              sx={{
                m: 0,
                fontFamily: "var(--font-serif)",
                letterSpacing: "-0.02em",
                fontOpticalSizing: "auto",
                fontSize: "1.25rem",
                lineHeight: 1.4,
                fontWeight: 600,
              }}
            >
              {scheme.name}
            </Box>
            <Box
              component="div"
              sx={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "flex-end",
                gap: 0.5,
              }}
            >
              <Chip
                size="small"
                variant="outlined"
                label={scheme.category ? COLOR_CATEGORY_LABELS[scheme.category] : "Uncategorized"}
              />
              {scheme.isSystem && (
                <Chip
                  color="secondary"
                  size="small"
                  label={scheme.sourceName || "Catalog source"}
                  sx={{
                    boxSizing: "border-box",
                  }}
                />
              )}
            </Box>
          </Box>
          <Box
            component="p"
            sx={[
              {
                boxSizing: "border-box",
                m: 0,
                mt: 0.5,
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                fontSize: "0.75rem",
                lineHeight: 4 / 3,
                color: "var(--ink-faint)",
              },
              ready ? { color: "var(--ok)", fontWeight: 600 } : {},
            ]}
          >
            {ready && <Check size={14} />}
            {total === 0
              ? "No paints yet"
              : ready
                ? "Every paint available"
                : `${available} of ${total} paints available`}
            {uses > 0 && (
              <Box component="span" sx={{ color: "var(--ink-faint)", fontWeight: 400 }}>
                · Used by {uses} miniature{uses === 1 ? "" : "s"}
              </Box>
            )}
          </Box>
          <Box
            component="p"
            sx={{
              m: 0,
              mt: 1.5,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: "2",
              fontSize: "0.875rem",
              lineHeight: 10 / 7,
              color: "var(--ink-soft)",
            }}
          >
            {paintNames}
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
});
