import { ButtonBase } from "@mui/material";
import Box from "@mui/material/Box";
import type { ReactNode } from "react";

import { X } from "../icons";
import { truncateSx } from "../utils/truncate";

import { SchemeSwatch } from "./SchemeSwatch";

// Compact scheme label with its swatch, shared by paint steps and the scheme picker.
type SchemeChipProps = {
  scheme: { id: string; name: string };
  size?: "sm" | "md";
  onRemove?: () => void;
};

export function SchemeChip(props: SchemeChipProps) {
  return <SchemeChipView {...props} swatch={<SchemeSwatch schemeId={props.scheme.id} size="xs" />} />;
}

export function SchemeChipView({
  scheme,
  size = "sm",
  onRemove,
  swatch,
}: SchemeChipProps & { swatch: ReactNode }) {
  const md = size === "md";
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: md ? 0.75 : 0.5,
        maxWidth: "100%",
        pl: md ? 0.5 : 0.25,
        pr: onRemove ? 0.25 : md ? 1.25 : 0.875,
        py: md ? 0.5 : 0.25,
        border: "1px solid var(--line)",
        borderRadius: 999,
        bgcolor: "var(--sunken)",
        color: "var(--ink-soft)",
        fontSize: md ? 13 : 11,
        lineHeight: "18px",
        fontWeight: 600,
        overflow: "hidden",
      }}
    >
      {swatch}
      <Box component="span" sx={{ minWidth: 0, ...truncateSx }}>
        {scheme.name}
      </Box>
      {onRemove && (
        <ButtonBase
          onClick={onRemove}
          aria-label={`Remove ${scheme.name}`}
          sx={{
            display: "grid",
            placeItems: "center",
            width: 22,
            height: 22,
            flexShrink: 0,
            borderRadius: "50%",
            color: "var(--ink-faint)",
            "&:hover": { color: "var(--ink)", bgcolor: "var(--line)" },
            "&:focus-visible": { outline: "2px solid var(--gold)", outlineOffset: "-2px" },
          }}
        >
          <X size={14} />
        </ButtonBase>
      )}
    </Box>
  );
}
