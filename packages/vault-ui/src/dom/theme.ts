import { createTheme } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    overlay: Palette["primary"];
  }
  interface PaletteOptions {
    overlay?: PaletteOptions["primary"];
  }
}

declare module "@mui/material/Button" {
  interface ButtonPropsVariantOverrides {
    overlay: true;
  }
}

declare module "@mui/material/IconButton" {
  interface IconButtonPropsColorOverrides {
    overlay: true;
  }
}

import { breakpoints, colors, down } from "./theme-tokens";

// Follow LanguageProvider/site regional overrides, not a frozen initial stack.
const sans = "var(--font-sans)";
const serif = "var(--font-serif)";

// MUI's palette, from the same tokens as the CSS variables that Vault installs.
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: '[data-theme="%s"]' },
  defaultColorScheme: "dark",
  colorSchemes: {
    dark: {
      palette: {
        primary: {
          main: colors.brand,
          light: colors.brandHover,
          dark: "#3559a8",
          contrastText: colors.brandFg,
        },
        secondary: { main: colors.gold, contrastText: colors.goldFg },
        success: { main: colors.ok, contrastText: colors.canvas },
        error: { main: colors.rust, contrastText: colors.canvas },
        info: { main: colors.sky },
        background: { default: colors.canvas, paper: colors.surface },
        text: { primary: colors.ink, secondary: colors.inkSoft, disabled: "#808080" },
        divider: colors.line,
        // White controls over images and dark photo backdrops.
        overlay: { main: "#ffffff", contrastText: "#000000" },
      },
    },
  },
  breakpoints: { values: breakpoints },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: sans,
    h1: { fontFamily: serif, fontWeight: 600, letterSpacing: "-0.02em" },
    h2: { fontFamily: serif, fontWeight: 600, letterSpacing: "-0.02em" },
    h3: { fontFamily: serif, fontWeight: 600, letterSpacing: "-0.02em" },
    h4: { fontFamily: serif, fontWeight: 600, letterSpacing: "-0.02em" },
    h5: { fontFamily: serif, fontWeight: 600, letterSpacing: "-0.02em" },
    h6: { fontFamily: serif, fontWeight: 600, letterSpacing: "-0.02em" },
    button: { textTransform: "none", fontWeight: 650 },
  },
  components: {
    MuiFormLabel: {
      styleOverrides: {
        root: { "&.Mui-focused:not(.Mui-error)": { color: "var(--brand-text)" } },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          "&.MuiAlert-filled.MuiAlert-colorSuccess": {
            backgroundColor: "var(--ok-strong)",
            color: "var(--on-scrim)",
          },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: {
        root: {
          borderRadius: 20,
          borderColor: "var(--line)",
          background: "var(--surface)",
          boxShadow: "0 1px 2px rgb(var(--shadow-color) / 6%), 0 1px 1px rgb(var(--shadow-color) / 4%)",
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      // The brand blue is too dark for text on the dark surfaces, so text buttons use its lighter tint.
      variants: [
        { props: { variant: "text", color: "primary" }, style: { color: "var(--brand-text)" } },
        // A frosted button laid over a photo, such as Rotate or Remove photo.
        {
          props: { variant: "overlay" },
          style: {
            padding: "4px 10px",
            color: "var(--ink)",
            backgroundColor: "color-mix(in oklab, var(--surface-raised) 90%, transparent)",
            "&:hover": { backgroundColor: "var(--surface-raised)" },
            "&.Mui-disabled": { color: "var(--ink-faint)" },
          },
        },
      ],
      styleOverrides: {
        root: {
          borderRadius: 12,
          whiteSpace: "nowrap",
          minHeight: 40,
          [down.md]: { minHeight: 44 },
        },
        outlined: {
          borderColor: "var(--line-strong)",
          color: "var(--ink)",
          background: "var(--surface-raised)",
          "&:hover": { background: "var(--sunken)", borderColor: "var(--line-strong)" },
        },
        sizeSmall: { minHeight: 32, [down.md]: { minHeight: 40 } },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 12 } },
      variants: [
        {
          props: { color: "overlay" },
          style: { "&.Mui-disabled": { color: "rgb(var(--highlight-color) / 30%)" } },
        },
      ],
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: { gap: 4, padding: 4, borderRadius: 12, background: "var(--sunken)" },
        grouped: { border: 0, borderRadius: "8px !important", margin: "0 !important" },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          border: 0,
          textTransform: "none",
          fontWeight: 600,
          fontSize: "0.75rem",
          color: "var(--ink-faint)",
          padding: "12px",
          "&:hover": { background: "transparent", color: "var(--ink)" },
          "&.Mui-selected, &.Mui-selected:hover": {
            background: "var(--surface-raised)",
            color: "var(--ink)",
            boxShadow: "0 1px 2px rgb(var(--shadow-color) / 12%)",
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          background: "var(--surface-raised)",
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--line-strong)" },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        input: { [down.md]: { fontSize: "16px" } },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
        sizeSmall: { fontSize: "0.7rem" },
        // Gold chips name where an item came from, such as a catalog source.
        colorSecondary: { backgroundColor: "var(--gold-soft)", color: "var(--gold-text)" },
      },
    },
    MuiFab: { styleOverrides: { root: { textTransform: "none" } } },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 6, borderRadius: 999, background: "var(--sunken)" },
        bar: { borderRadius: 999 },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 24, border: "1px solid var(--line)" },
        // MUI sizes "sm" dialogs from the sm breakpoint (640px here); dialogs keep their 600px.
        // Full-screen dialogs still fill the screen.
        paperWidthSm: ({ ownerState }) => (ownerState.fullScreen ? {} : { maxWidth: 600 }),
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          color: "var(--ink-soft)",
          "&:hover": { background: "var(--sunken)", color: "var(--ink)" },
          // Same soft pill as the phone tab bar so the active destination reads identically everywhere.
          "&.Mui-selected, &.Mui-selected:hover": {
            background: "var(--brand-soft)",
            color: "var(--brand-text)",
          },
        },
      },
    },
    MuiListItemIcon: { styleOverrides: { root: { minWidth: 34, color: "inherit" } } },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          minWidth: 0,
          padding: "6px 0",
          color: "var(--ink-faint)",
          "&.Mui-selected": { color: "var(--brand-text)" },
        },
        label: {
          fontSize: "0.65rem",
          fontWeight: 600,
          marginTop: 2,
          "&.Mui-selected": { fontSize: "0.65rem" },
        },
      },
    },
    MuiSkeleton: { defaultProps: { animation: "wave" } },
  },
});
