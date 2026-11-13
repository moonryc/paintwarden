import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import { Chip } from "@mui/material";

import { truncateSx } from "../utils/truncate";

export function PaintSubstitutionChip({ name }: { name: string }) {
  return (
    <Chip
      size="small"
      icon={<ScienceOutlinedIcon sx={{ fontSize: 15 }} />}
      label={name}
      title={`Using ${name} as a substitution`}
      sx={{
        height: 24,
        maxWidth: "55%",
        flexShrink: 0,
        bgcolor: "var(--brand-soft)",
        color: "var(--brand-text)",
        "& .MuiChip-icon": { color: "var(--brand-text)" },
        "& .MuiChip-label": { ...truncateSx },
      }}
    />
  );
}
