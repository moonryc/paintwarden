import { themeVars } from "../theme-tokens";

// Puts the palette variables and the page's base typography on the document, as the web app,
// the desktop app and Storybook all expect.
export function installBaseStyles() {
  for (const [name, value] of Object.entries(themeVars)) {
    document.documentElement.style.setProperty(name, value);
  }
  Object.assign(document.documentElement.style, {
    colorScheme: "dark",
    lineHeight: "1.5",
    minHeight: "100%",
    width: "100%",
  });
  Object.assign(document.body.style, {
    background: "var(--canvas)",
    color: "var(--ink)",
    fontFamily: "var(--font-sans)",
    fontFeatureSettings: '"cv11", "ss01"',
    margin: "0",
    minHeight: "100%",
    overscrollBehaviorY: "none",
    WebkitTapHighlightColor: "transparent",
    WebkitTextSizeAdjust: "100%",
    width: "100%",
  });
  const root = document.getElementById("root");
  if (root) Object.assign(root.style, { minHeight: "100dvh", width: "100%" });
}
