import { Box, Chip } from "@mui/material";
import { useTranslation } from "react-i18next";

import type { ScanPin } from "../Components/SwatchScanCanvas";

/** Sampled pins as chips: click selects a pin, the delete icon (or Delete/Backspace) removes it. */
export function SwatchScanPins({
  pins,
  selected,
  nameFor,
  onSelect,
  onRemove,
}: {
  pins: ScanPin[];
  selected: number | null;
  nameFor: (hex: string) => string;
  onSelect: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const { t } = useTranslation("components");
  return (
    <Box
      component="ol"
      aria-label={t("scanPins")}
      sx={{ display: "flex", flexWrap: "wrap", gap: 1, listStyle: "none", p: 0, m: 0, mt: "0 !important" }}
    >
      {pins.map((pin, i) => {
        const active = pin.id === selected;
        return (
          <Box component="li" key={pin.id} sx={{ minWidth: 0, maxWidth: "100%" }}>
            <Chip
              clickable
              color={active ? "primary" : "default"}
              variant={active ? "filled" : "outlined"}
              aria-pressed={active}
              onClick={() => onSelect(pin.id)}
              onDelete={() => onRemove(pin.id)}
              avatar={
                <Box
                  aria-hidden
                  sx={{ bgcolor: `${pin.hex} !important`, border: "1px solid white", borderRadius: "50%" }}
                />
              }
              label={t("scanPinMatch", { number: i + 1, hex: pin.hex, name: nameFor(pin.hex) })}
              sx={{
                maxWidth: "100%",
                height: "auto",
                minHeight: 32,
                "& .MuiChip-label": { whiteSpace: "normal", overflowWrap: "anywhere", py: 0.5 },
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
}
