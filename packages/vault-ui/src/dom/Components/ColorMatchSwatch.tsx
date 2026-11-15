import Box from "@mui/material/Box";

/**
 * Shows the wanted color and a paint color side by side so their difference reads at a glance.
 * Decorative: the surrounding text names both colors.
 */
export function ColorMatchSwatch({
  target,
  paint,
  size = 44,
}: {
  target: string;
  paint?: string | null;
  size?: number;
}) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        display: "flex",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 1.5,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box sx={{ flex: 1, bgcolor: target }} />
      <Box sx={{ flex: 1, bgcolor: paint ?? target, borderLeft: "1px solid", borderColor: "divider" }} />
    </Box>
  );
}
