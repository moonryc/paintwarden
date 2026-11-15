/**
 * Background for a checkbox or icon button laid over a tile image. MUI's hover state swaps the
 * background for a translucent tint, which lets the image show through and hides the control,
 * so hover and focus keep an opaque surface with a slight brand tint instead.
 */
export const tileControlSx = {
  bgcolor: "var(--surface)",
  "&:hover, &.Mui-focusVisible": {
    bgcolor: "color-mix(in oklab, var(--brand) 14%, var(--surface))",
  },
} as const;
