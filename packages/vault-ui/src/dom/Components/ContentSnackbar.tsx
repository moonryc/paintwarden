import { Box, Snackbar, type SnackbarProps } from "@mui/material";

import { contentGutters } from "../Layout/AppContent";
import { up } from "../theme-tokens";

// A viewport-centred Snackbar ignores the fixed sidebar. Use the actual content
// bounds instead, including at 1024px where the desktop navigation first opens.
export function ContentSnackbar({ children, ...props }: Omit<SnackbarProps, "sx" | "anchorOrigin">) {
  return (
    <Snackbar
      {...props}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      sx={{
        "&&": {
          left: 0,
          right: 0,
          width: "auto",
          transform: "none",
          bottom: "calc(5.5rem + env(safe-area-inset-bottom))",
          pointerEvents: "none",
          [up.lg]: { left: "264px", bottom: "calc(1.5rem + env(safe-area-inset-bottom))" },
        },
      }}
    >
      <Box sx={contentGutters}>
        <Box
          data-content-snackbar
          sx={{
            width: "100%",
            maxWidth: 640,
            mx: "auto",
            pointerEvents: "auto",
            overflowWrap: "anywhere",
            maxHeight: "calc(100dvh - 10rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
            overflowY: "auto",
            "& .MuiAlert-root": { width: "100%", boxSizing: "border-box", minWidth: 0 },
            "& .MuiAlert-message": { minWidth: 0 },
            "& .MuiAlert-action": { flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" },
          }}
        >
          {children}
        </Box>
      </Box>
    </Snackbar>
  );
}
