import { NumberField } from "@base-ui/react/number-field";
import Box from "@mui/material/Box";
import { useEffect, useState } from "react";

import { Minus, Plus } from "../icons";
import { down, up } from "../theme-tokens";
import { buttonResetSx } from "../utils/element-resets";

export function QuantityCounter({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
  onChange(value: number): void;
}) {
  const [draft, setDraft] = useState<number | null>(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <NumberField.Root
      value={draft}
      min={0}
      max={999}
      step={1}
      onValueChange={setDraft}
      onValueCommitted={(next) => {
        const quantity = Math.max(0, Math.min(999, Math.trunc(next ?? 0)));
        setDraft(quantity);
        if (quantity !== value) onChange(quantity);
      }}
    >
      <Box
        component={NumberField.Group}
        aria-label={`Quantity of ${name}`}
        sx={{
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          borderRadius: "16px",
          borderStyle: "solid",
          borderWidth: "1px",
          borderColor: "var(--line-strong)",
          bgcolor: "var(--surface-raised)",
          "&:focus-within": {
            borderColor: "var(--brand)",
          },
        }}
      >
        <Box
          component={NumberField.Decrement}
          aria-label={`Decrease ${name} quantity`}
          sx={{
            ...buttonResetSx,
            display: "grid",
            height: "2.5rem",
            width: "2.5rem",
            placeItems: "center",
            color: "var(--ink-soft)",
            "&:hover": {
              "@media (hover: hover)": {
                bgcolor: "var(--sunken)",
              },
            },
            "&:disabled": {
              opacity: 0.4,
            },
            [up.md]: {
              height: "2rem",
              width: "2rem",
            },
          }}
        >
          <Minus size={14} />
        </Box>
        <Box
          component={NumberField.Input}
          aria-label={`${name} quantity`}
          sx={[
            {
              boxSizing: "border-box",
              border: "0 solid currentColor",
              font: "inherit",
              height: "2.5rem",
              width: "2.75rem",
              borderInlineStyle: "solid",
              borderInlineWidth: "1px",
              borderColor: "var(--line)",
              bgcolor: "transparent",
              p: 0,
              textAlign: "center",
              fontSize: "0.75rem",
              lineHeight: 4 / 3,
              fontWeight: 600,
              color: "var(--ink)",
              fontVariantNumeric: "tabular-nums",
              [up.md]: {
                height: "2rem",
                width: "2.5rem",
              },
            },
            { lineHeight: "24px", [down.md]: { fontSize: "16px" } },
          ]}
        />
        <Box
          component={NumberField.Increment}
          aria-label={`Increase ${name} quantity`}
          sx={{
            ...buttonResetSx,
            display: "grid",
            height: "2.5rem",
            width: "2.5rem",
            placeItems: "center",
            color: "var(--ink-soft)",
            "&:hover": {
              "@media (hover: hover)": {
                bgcolor: "var(--sunken)",
              },
            },
            "&:disabled": {
              opacity: 0.4,
            },
            [up.md]: {
              height: "2rem",
              width: "2rem",
            },
          }}
        >
          <Plus size={14} />
        </Box>
      </Box>
    </NumberField.Root>
  );
}
