import Box from "@mui/material/Box";
type PaintBottlePaint = {
  colorHex: string | null;
};

const BOTTLE_SIZES = {
  xs: { width: "1.75rem", height: "1.75rem", borderRadius: "10px" },
  sm: { width: "2.25rem", height: "2.25rem", borderRadius: "0.75rem" },
  md: { width: "2.75rem", height: "2.75rem", borderRadius: "16px" },
};

export function PaintBottle({ paint, size = "md" }: { paint: PaintBottlePaint; size?: "xs" | "sm" | "md" }) {
  return (
    <Box
      component="span"
      sx={{
        boxSizing: "border-box",
        position: "relative",
        display: "grid",
        flexShrink: 0,
        placeItems: "center",
        overflow: "hidden",
        border: "1px solid var(--line)",
        bgcolor: "var(--surface-raised)",
        ...BOTTLE_SIZES[size],
      }}
    >
      <Box
        component="span"
        sx={{
          position: "absolute",
          insetInline: "18%",
          top: "36%",
          bottom: "14%",
          borderRadius: "5px",
          boxShadow:
            "inset 0 -3px 0 rgb(var(--shadow-color) / 15%), inset 0 2px 0 rgb(var(--highlight-color) / 25%)",
        }}
        style={{ backgroundColor: paint.colorHex || "#aaa" }}
      />
      <Box
        component="span"
        sx={{
          position: "absolute",
          top: "8%",
          left: "50%",
          height: "30%",
          width: "56%",
          translate: "calc(calc(1 / 2 * 100%) * -1) 0",
          borderTopLeftRadius: "4px",
          borderTopRightRadius: "4px",
          bgcolor: "var(--bottle-cap)",
        }}
      />
    </Box>
  );
}
