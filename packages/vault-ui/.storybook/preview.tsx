/// <reference types="vite/client" />
import inter400 from "@fontsource/inter/files/inter-latin-400-normal.woff2?url";
import inter600 from "@fontsource/inter/files/inter-latin-600-normal.woff2?url";
import inter700 from "@fontsource/inter/files/inter-latin-700-normal.woff2?url";
import fraunces from "@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2?url";
import Box from "@mui/material/Box";
import type { Preview } from "@storybook/react-vite";
import { themes } from "storybook/theming";

import { withVaultStore } from "../src/dom/storybook/vault-store";
import { LanguageProvider, languages } from "../src/dom/i18n";
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

import { expectNoPageOverflow } from "../src/dom/storybook/layout";

const preview: Preview = {
  initialGlobals: { locale: "en" },
  globalTypes: {
    locale: {
      description: "Language",
      toolbar: {
        icon: "globe",
        dynamicTitle: true,
        items: [
          ...languages.map(({ code, name }) => ({ value: code, title: name })),
          { value: "en-XA", title: "［Pseudo］" },
        ],
      },
    },
  },
  parameters: {
    layout: "fullscreen",
    controls: { matchers: { color: /(background|color|colorHex)$/i } },
    docs: { theme: themes.dark },
    // Accessibility violations, such as unlabelled buttons or low contrast, fail the story tests.
    a11y: { test: "error" },
  },
  decorators: [
    withVaultStore,
    (Story, context) => (
      <LanguageProvider language={String(context.parameters.locale || context.globals.locale || "en")}>
        {/* Whole-app stories set `fullBleed` so the shell reaches the window edges, as in the app. */}
        <Box
          sx={{
            minHeight: "100%",
            p: context.parameters.fullBleed ? 0 : 3,
            bgcolor: "var(--canvas)",
            color: "var(--ink)",
          }}
        >
          <Story />
        </Box>
      </LanguageProvider>
    ),
  ],
  afterEach: async ({ title, canvasElement }) => {
    if (title.startsWith("Pages/") || title.startsWith("Dialogs/") || title === "Paint tools/Layout")
      await expectNoPageOverflow(canvasElement.ownerDocument);
  },
  tags: ["autodocs"],
};

export default preview;
