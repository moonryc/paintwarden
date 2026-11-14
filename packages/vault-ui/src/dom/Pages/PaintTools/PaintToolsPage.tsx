import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "../../Components/PageHeader";
import { ArrowLeftRight, Layers } from "../../icons";
import { PaintDetailsOverlay } from "../../Modals/PaintDetailsOverlay";

import { PaintComparison } from "./PaintComparison";
import { RecipeConverter } from "./RecipeConverter";

export function PaintToolsPage() {
  const { t } = useTranslation("pages");
  const [tool, setTool] = useState<"compare" | "convert">("compare");
  const [openPaintId, setOpenPaintId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader eyebrow={t("toolsEyebrow")} title={t("toolsTitle")} body={t("toolsDescription")} />
      <ToggleButtonGroup
        exclusive
        fullWidth
        value={tool}
        onChange={(_, value: "compare" | "convert" | null) => {
          if (value) setTool(value);
        }}
        aria-label={t("toolsChooseTool")}
        sx={{ mb: 2.5 }}
      >
        <ToggleButton
          id="paint-tool-compare"
          value="compare"
          aria-controls="paint-tool-compare-panel"
          sx={[
            {
              boxSizing: "border-box",
              flexDirection: "column",
              gap: "0.25rem",
              fontSize: "0.75rem",
              lineHeight: "calc(4 / 3)",
            },
            {
              "&.Mui-selected, &.Mui-selected:hover": {
                bgcolor: "var(--brand-soft)",
                color: "var(--brand-text)",
              },
            },
          ]}
        >
          <ArrowLeftRight size={18} />
          {t("toolsCompare")}
        </ToggleButton>
        <ToggleButton
          id="paint-tool-convert"
          value="convert"
          aria-controls="paint-tool-convert-panel"
          sx={[
            {
              boxSizing: "border-box",
              flexDirection: "column",
              gap: "0.25rem",
              fontSize: "0.75rem",
              lineHeight: "calc(4 / 3)",
            },
            {
              "&.Mui-selected, &.Mui-selected:hover": {
                bgcolor: "var(--brand-soft)",
                color: "var(--brand-text)",
              },
            },
          ]}
        >
          <Layers size={18} />
          {t("toolsConverter")}
        </ToggleButton>
      </ToggleButtonGroup>
      <Box
        role="tabpanel"
        id="paint-tool-compare-panel"
        aria-labelledby="paint-tool-compare"
        hidden={tool !== "compare"}
      >
        <PaintComparison onOpenPaint={setOpenPaintId} />
      </Box>
      <Box
        role="tabpanel"
        id="paint-tool-convert-panel"
        aria-labelledby="paint-tool-convert"
        hidden={tool !== "convert"}
      >
        <RecipeConverter onOpenPaint={setOpenPaintId} />
      </Box>
      <PaintDetailsOverlay paintId={openPaintId} onClose={() => setOpenPaintId(null)} />
    </div>
  );
}
