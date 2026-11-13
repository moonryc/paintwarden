import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useState } from "react";

import { PageHeader } from "../../Components/PageHeader";
import { ArrowLeftRight, Layers } from "../../icons";
import { PaintDetailsOverlay } from "../../Modals/PaintDetailsOverlay";

import { PaintComparison } from "./PaintComparison";
import { RecipeConverter } from "./RecipeConverter";

export function PaintToolsPage() {
  const [tool, setTool] = useState<"compare" | "convert">("compare");
  const [openPaintId, setOpenPaintId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Color tools"
        title="Paint Tools"
        body="Compare colors and adapt recipes to the paints you own."
      />
      <ToggleButtonGroup
        exclusive
        fullWidth
        value={tool}
        onChange={(_, value: "compare" | "convert" | null) => {
          if (value) setTool(value);
        }}
        aria-label="Choose a paint tool"
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
          Paint compare
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
          Recipe converter
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
