# Code quality checks

The repository uses npm and Node.js 22.13 or newer. Run these commands from the repository root:

```sh
npm run format:check
npm run lint
npm test
```

`npm run format:write` formats TypeScript and JavaScript source in `apps/`, `packages/`, and `scripts/`.
Generated database migrations, bundled desktop servers, desktop build output, and lockfiles are excluded.
ESLint checks the server, web app, paint core, and shared UI. `npm run lint` also runs TypeScript
checks for those projects and JavaScript syntax checks for the Electron host. CI runs shared checks
on Linux and desktop packaging checks on macOS and Windows.

Shared UI styling lives in React `sx` props. Colors come from the CSS variables defined in
`packages/vault-ui/src/dom/theme-tokens.ts`, such as `var(--ink)`, which also feeds the MUI theme,
the product website and the desktop connection screen; add a token there rather than a hex value
in a component. Controls and text over photos use `var(--scrim)` (mixed with transparent) and
`var(--on-scrim)`, and shadows use `var(--shadow-sm)`, `var(--shadow-lg)` and `var(--shadow-xl)` or
`rgb(var(--shadow-color) / …)`. The same file defines the breakpoint scale: use responsive values such as
`{ xs: 2, md: 3 }`, or the `up`/`down` media-query keys, rather than writing pixel widths.
Use `!important` only to hold an interactive MUI component's color through its hover, selected or
disabled styles, or where a theme media rule would otherwise win; prefer a theme override when the
same look repeats.

## Adaptation from the supplied handoff

- The handoff's formatting options are retained: 110-column Prettier width, trailing commas, and
  parentheses around arrow arguments. Prettier 3 is required here because Prettier 2 cannot parse
  this project's TypeScript import attributes.
- ESLint uses `plugin:prettier/recommended` after the other presets so formatting differences are
  reported as errors by `prettier/prettier`. The separate `format:check` command remains available
  for files outside the TypeScript ESLint targets.
- TypeScript was already strict. The project now also checks implicit returns, switch fallthrough,
  filename casing, and unreachable code. The shared paint core has its own TypeScript project.
- ESLint uses typed TypeScript rules, import checks, SonarJS, React, React Hooks, and JSX accessibility
  checks. Unsafe TypeScript operations are errors in application and core code, with the handoff's
  test exception for response fixtures. Warnings stay visible while the current UI is cleaned up.
  Some shared UI files still hold several components, so `react/no-multi-comp` and the shared UI
  line limit warn while server, web, and core source enforce their line limit as an error.
  `react/jsx-no-bind` is off because inline handlers are ordinary in React function components,
  and `sonarjs/no-duplicate-string` is off in TSX files because `sx` objects repeat theme tokens.
  Tests allow 1,000 lines. The installed React Hooks plugin has extra compiler-oriented rules that
  were not in the handoff's older recommended preset; only the Rules of Hooks and
  effect-dependency rules are enabled here.
- A restricted syntax rule reports `toFixed()` calls, and React files prohibit bare `lodash`
  imports. These replace the handoff's custom rules without carrying over its unsafe autofixer for
  aliased Lodash imports.
- GraphQL rules, source-specific import restrictions, project paths, and its Yarn and Husky hooks do
  not apply to Paint Vault. Nx retains this repository's existing targets; no dependency install or
  database migration runs from a Git hook.

The format pass is intentionally a separate source-wide change. Review formatting differences
separately from functional changes when committing this work.
