import { TextField } from "@mui/material";
import Box from "@mui/material/Box";

import { PaintBottle } from "./PaintBottle";

export function ColorHexField({ value, onChange }: { value: string; onChange(value: string): void }) {
  const colorHex = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : null;
  return (
    <Box
      component="div"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
      }}
    >
      <PaintBottle paint={{ colorHex }} />
      <TextField
        fullWidth
        label="Color hex"
        placeholder="e.g. #445566"
        slotProps={{ inputLabel: { shrink: true } }}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Box>
  );
}
