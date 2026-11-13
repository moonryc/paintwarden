import { ButtonBase } from "@mui/material";

import { Plus, X } from "../icons";

// The dashed "+ Add" control that follows the content it extends, such as a recipe's scheme
// tiles or paint steps. While its panel is open it shows an X instead.
export function DashedAddButton({
  label,
  ariaLabel,
  onClick,
  expanded,
  ariaHaspopup,
  minHeight = 48,
}: {
  label: string;
  ariaLabel?: string;
  onClick(): void;
  expanded?: boolean;
  ariaHaspopup?: "dialog";
  minHeight?: number;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={ariaLabel}
      aria-haspopup={ariaHaspopup}
      aria-expanded={expanded}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.75,
        width: "100%",
        minHeight,
        border: "1px dashed var(--line-strong)",
        borderRadius: 1.5,
        color: "var(--ink-soft)",
        fontSize: 12,
        fontWeight: 700,
        transition: "border-color .15s, color .15s",
        "&:hover": { borderColor: "var(--brand)", color: "var(--brand)" },
      }}
    >
      {expanded ? <X size={15} /> : <Plus size={15} />} {label}
    </ButtonBase>
  );
}
