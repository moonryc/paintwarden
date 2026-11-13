// A card that lifts slightly on hover and presses in when clicked, used for the scheme and
// template grids. Spread into the card's sx.
export const liftCardSx = {
  boxSizing: "border-box",
  overflow: "hidden",
  transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
  "@media (hover: hover)": {
    "&:hover": {
      transform: "translateY(-2px)",
      borderColor: "var(--line-strong)",
      boxShadow: "0 12px 28px -12px rgb(var(--shadow-color) / 22%)",
    },
  },
  "&:active": { transform: "scale(0.985)" },
  "@media (prefers-reduced-motion: reduce)": { "&:hover": { transform: "none" } },
} as const;
