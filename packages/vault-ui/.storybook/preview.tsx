/// <reference types="vite/client" />
import inter400 from "@fontsource/inter/files/inter-latin-400-normal.woff2?url";
import inter600 from "@fontsource/inter/files/inter-latin-600-normal.woff2?url";
import inter700 from "@fontsource/inter/files/inter-latin-700-normal.woff2?url";
import fraunces from "@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2?url";
import Box from "@mui/material/Box";
import { ThemeProvider } from "@mui/material/styles";
import type { Preview } from "@storybook/react-vite";
import { themes } from "storybook/theming";

import { withVaultStore } from "../src/dom/storybook/vault-store";
import { theme } from "../src/dom/theme";
import { installBaseStyles } from "../src/dom/utils/base-styles";

// Same page setup as the web app: dark theme, palette variables, and the Inter and Fraunces fonts.
document.documentElement.dataset.theme = "dark";
installBaseStyles();
for (const [family, source, weight] of [
  ["Inter", inter400, "400"],
  ["Inter", inter600, "600"],
  ["Inter", inter700, "700"],
  ["Fraunces", fraunces, "100 900"],
] as const) {
  void new FontFace(family, `url(${source})`, { weight })
    .load()
    .then((face) => document.fonts.add(face))
    .catch(() => undefined);
}

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: { matchers: { color: /(background|color|colorHex)$/i } },
    docs: { theme: themes.dark },
    // Accessibility violations, such as unlabelled buttons or low contrast, fail the story tests.
    a11y: { test: "error" },
  },
  decorators: [
    withVaultStore,
    (Story) => (
      <ThemeProvider theme={theme}>
        <Box sx={{ minHeight: "100%", p: 3, bgcolor: "var(--canvas)", color: "var(--ink)" }}>
          <Story />
        </Box>
      </ThemeProvider>
    ),
  ],
  tags: ["autodocs"],
};

export default preview;
