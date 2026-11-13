// Browser defaults that the app's own buttons, links and lists clear, so they start from the
// same plain box as a div. Spread one into an element's sx before its own styles.

const focusOutline = {
  "&:focus-visible": { outline: "2px solid var(--gold)", outlineOffset: "2px", borderRadius: "6px" },
};

export const buttonResetSx = {
  background: "transparent",
  border: 0,
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
  lineHeight: "inherit",
  padding: 0,
  appearance: "button",
  ...focusOutline,
} as const;

export const linkResetSx = { color: "inherit", textDecoration: "inherit", ...focusOutline } as const;

export const listResetSx = { listStyle: "none", margin: 0, padding: 0 } as const;
