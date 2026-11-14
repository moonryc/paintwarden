// The app palette and the CSS variables built from it. The MUI theme, the base styles Vault
// installs, the product website and the desktop connection screen all read these, so a color
// changes here and nowhere else.

export const colors = {
  canvas: "#202020",
  surface: "#262626",
  surfaceRaised: "#2c2c2c",
  sunken: "#303030",
  line: "#383838",
  lineStrong: "#4a4a4a",
  // Border between the plain divider rows in a scheme.
  lineDeep: "#1a1a1a",
  ink: "#d0d0d0",
  inkSoft: "#a8a8a8",
  inkFaint: "#999999",
  brand: "#406ac2",
  brandHover: "#4d79d4",
  brandFg: "#f0f0f0",
  brandSoft: "#263452",
  // The brand blue lightened for text on dark surfaces.
  brandText: "#8aaef0",
  gold: "#d9b72b",
  goldFg: "#262626",
  goldSoft: "#36301c",
  goldText: "#e8c84a",
  ok: "#85c46c",
  okSoft: "#24331f",
  rust: "#ff6a5c",
  rustSoft: "#3d211e",
  wishlist: "#f472b6",
  sky: "#66c3cc",
  // Background for white text, such as the update prompt; sky itself is too light for it.
  skyStrong: "#2f6a70",
  // The cap on paint bottles and the logo.
  bottleCap: "#4a504b",
  // Darkens photos so controls and text on them stay readable, as color-mix(in oklab,
  // var(--scrim) 60%, transparent); on-scrim is the text and icon color over it.
  scrim: "#000000",
  onScrim: "#ffffff",
} as const;

const cssName = (name: string) => `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

export const themeVars: Record<string, string> = {
  "--font-sans":
    '"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans CJK JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Apple SD Gothic Neo", "Malgun Gothic", "Microsoft YaHei", "PingFang SC", "PingFang TC", sans-serif',
  "--font-serif":
    '"Fraunces", Georgia, "Times New Roman", "Noto Serif CJK JP", "Songti SC", "Songti TC", serif',
  ...Object.fromEntries(Object.entries(colors).map(([name, value]) => [cssName(name), value])),
  // RGB channels for shadows, used as rgb(var(--shadow-color) / 10%).
  "--shadow-color": "0 0 0",
  // RGB channels for light edges and dimmed white, used as rgb(var(--highlight-color) / 25%).
  "--highlight-color": "255 255 255",
  // Raised elements: small for chips and buttons, large for dragged rows and toasts, extra
  // large for floating toolbars.
  "--shadow-sm": "0 1px 3px 0 rgb(var(--shadow-color) / 0.1), 0 1px 2px -1px rgb(var(--shadow-color) / 0.1)",
  "--shadow-lg":
    "0 10px 15px -3px rgb(var(--shadow-color) / 0.1), 0 4px 6px -4px rgb(var(--shadow-color) / 0.1)",
  "--shadow-xl":
    "0 20px 25px -5px rgb(var(--shadow-color) / 0.1), 0 8px 10px -6px rgb(var(--shadow-color) / 0.1)",
};

// One breakpoint scale for the whole app. The MUI theme uses it for responsive values such as
// { xs: 2, md: 3 }, and `up`/`down` give the same widths as media-query keys for sx.
export const breakpoints = { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 } as const;

type Breakpoint = Exclude<keyof typeof breakpoints, "xs">;
const sizes = Object.keys(breakpoints).filter((size) => size !== "xs") as Breakpoint[];

// "@media (min-width: 768px)" and so on, for sx keys: { [up.md]: { p: 3 } }.
export const up = Object.fromEntries(
  sizes.map((size) => [size, `@media (min-width: ${breakpoints[size]}px)`]),
) as Record<Breakpoint, string>;

// Widths below a breakpoint, matching MUI's theme.breakpoints.down().
export const down = Object.fromEntries(
  sizes.map((size) => [size, `@media (max-width: ${breakpoints[size] - 0.05}px)`]),
) as Record<Breakpoint, string>;

// Prefer the language's regional CJK faces rather than letting, for example,
// Japanese headings fall through to a Simplified Chinese serif font. Latin
// characters still use the app's bundled Inter/Fraunces fonts.
export function localizedFontVars(language: string): Record<"--font-sans" | "--font-serif", string> {
  const faces: Record<string, [string, string]> = {
    ja: [
      '"Hiragino Sans", "Noto Sans CJK JP", "Yu Gothic"',
      '"Hiragino Mincho ProN", "Noto Serif CJK JP", "Yu Mincho"',
    ],
    ko: [
      '"Apple SD Gothic Neo", "Noto Sans CJK KR", "Malgun Gothic"',
      '"AppleMyungjo", "Noto Serif CJK KR", "Batang"',
    ],
    "zh-Hans": [
      '"PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei"',
      '"Songti SC", "Noto Serif CJK SC", "SimSun"',
    ],
    "zh-Hant": [
      '"PingFang TC", "Noto Sans CJK TC", "Microsoft JhengHei"',
      '"Songti TC", "Noto Serif CJK TC", "PMingLiU"',
    ],
  };
  const face = faces[language];
  return face
    ? {
        "--font-sans": `"Inter", ${face[0]}, ui-sans-serif, system-ui, sans-serif`,
        "--font-serif": `"Fraunces", Georgia, "Times New Roman", ${face[1]}, serif`,
      }
    : { "--font-sans": themeVars["--font-sans"], "--font-serif": themeVars["--font-serif"] };
}
