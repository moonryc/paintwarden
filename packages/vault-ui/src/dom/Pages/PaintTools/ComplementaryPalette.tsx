import { Box, Button } from "@mui/material";
import { useId } from "react";
import { useTranslation } from "react-i18next";

type Slot = {
  role: string;
  label: string;
  paint?: { name: string; hex?: string | null } | null;
  input: boolean;
};

/** The four chosen paints in saved scheme order, with the action that saves them. */
export function ComplementaryPalette({
  slots,
  canSave,
  onSave,
}: {
  slots: Slot[];
  canSave: boolean;
  onSave: () => void;
}) {
  const { t } = useTranslation("pages");
  const headingId = useId();
  return (
    <Box sx={{ mt: 4, p: { xs: 1.5, sm: 2 }, borderRadius: 2, bgcolor: "var(--sunken)" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <Box component="h3" id={headingId} sx={{ m: 0, fontSize: 16 }}>
          {t("complementaryPalette")}
        </Box>
        <Button variant="contained" disabled={!canSave} onClick={onSave}>
          {t("complementarySave")}
        </Button>
      </Box>
      <Box
        component="ol"
        aria-labelledby={headingId}
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" },
          gap: { xs: 1, sm: 1.5 },
          listStyle: "none",
          p: 0,
          m: 0,
        }}
      >
        {slots.map((slot) => (
          <Box component="li" key={slot.role} sx={{ minWidth: 0 }}>
            <Box
              aria-hidden="true"
              sx={{
                height: { xs: 48, sm: 72 },
                boxSizing: "border-box",
                borderRadius: 1.5,
                border: slot.input ? "3px solid" : "1px solid",
                borderColor: slot.input ? "primary.main" : "divider",
                bgcolor: slot.paint?.hex ?? "transparent",
                backgroundImage: slot.paint?.hex
                  ? "none"
                  : "repeating-linear-gradient(45deg, var(--surface) 0 6px, transparent 6px 12px)",
              }}
            />
            <Box sx={{ fontSize: 12, fontWeight: 700, mt: 0.75 }}>{slot.label}</Box>
            <Box sx={{ fontSize: 12, color: "text.secondary", overflowWrap: "break-word" }}>
              {slot.paint?.name ?? t("complementaryNoPick")}
            </Box>
            {slot.input && (
              <Box sx={{ fontSize: 11, color: "text.secondary", fontStyle: "italic" }}>
                {t("complementaryYourPaint")}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
