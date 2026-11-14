import { Avatar } from "@mui/material";

// Translate this key at render while the server hasn't said who owns the vault yet.
export const FALLBACK_OWNER_NAME = "layoutPainter" as const;

// The owner's initial on a gold disc, used in the navigation and in Settings.
export function UserAvatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <Avatar
      sx={{
        boxSizing: "border-box",
        height: size,
        width: size,
        bgcolor: "var(--gold)",
        fontFamily: '"Fraunces", Georgia, "Times New Roman", serif',
        fontSize: size * (16 / 36),
        lineHeight: "1.5",
        fontWeight: "600",
        color: "var(--gold-fg)",
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </Avatar>
  );
}
