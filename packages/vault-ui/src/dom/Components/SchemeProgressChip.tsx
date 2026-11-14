import { useTranslation } from "react-i18next";
import { CircularProgress } from "@mui/material";
import Box from "@mui/material/Box";

import { Check } from "../icons";
import { schemeCardChipSize, schemePreviewChipSize } from "../utils/chip-sizes";

export function SchemeProgressChip({
  available,
  total,
  size = "md",
}: {
  available: number;
  total: number;
  // sm fits over a scheme card's image; md lines up with the scheme preview's other chips.
  size?: "sm" | "md";
}) {
  const { t } = useTranslation("components");
  const needed = Math.max(0, total - available);
  const ready = total > 0 && needed === 0;
  const progress = total > 0 ? (available / total) * 100 : 0;

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.75,
        boxSizing: "border-box",
        px: 1,
        py: 0.625,
        minWidth: (size === "md" ? schemePreviewChipSize : schemeCardChipSize).width,
        minHeight: (size === "md" ? schemePreviewChipSize : schemeCardChipSize).height,
        maxWidth: "100%",
        borderRadius: 999,
        bgcolor: "color-mix(in oklab, var(--scrim) 55%, transparent)",
        color: "var(--on-scrim)",
        backdropFilter: "blur(8px)",
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: "normal",
      }}
    >
      <Box
        component="span"
        sx={{ position: "relative", display: "inline-flex", flexShrink: 0, width: 18, height: 18 }}
      >
        {ready ? (
          <Box
            component="span"
            sx={{
              display: "grid",
              placeItems: "center",
              width: 18,
              height: 18,
              borderRadius: "50%",
              bgcolor: "var(--ok)",
              color: "var(--bg)",
            }}
          >
            <Check size={14} aria-hidden="true" />
          </Box>
        ) : (
          <>
            <CircularProgress
              variant="determinate"
              value={100}
              size={18}
              thickness={5}
              aria-hidden="true"
              sx={{ color: "rgb(var(--highlight-color) / 30%)" }}
            />
            <CircularProgress
              variant="determinate"
              value={progress}
              size={18}
              thickness={5}
              aria-hidden="true"
              sx={{
                position: "absolute",
                left: 0,
                color: "var(--gold)",
                "& circle": { strokeLinecap: "round" },
              }}
            />
          </>
        )}
      </Box>
      {total === 0 ? t("noPaints") : needed === 0 ? t("ready") : t("paintsNeeded", { count: needed })}
    </Box>
  );
}
