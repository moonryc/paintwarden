# Global banner layout regression

The shared shell owns notice placement. GraphQL transport providers expose status to the shell rather than rendering notices before it. `AppContent` supplies responsive gutters, `AppBanner` supplies dismiss/Retry controls, and `ContentSnackbar` bounds floating notices to the same column.

## Cross-platform CI gate

```sh
node scripts/smoke-banner-layout.mjs /tmp/banner-layout --geometry-only
```

This starts and stops its own loopback Storybook server, uses fixture data only, and runs Chromium at 1440, 1024, and 390 pixels. It asserts the expected notices are present, clear the sidebar/titlebar, fit the content gutters and viewport, and retain unclipped actions. Renderer errors and horizontal overflow fail the gate. The fifteen cases cover combined notices, a simulated 32px hidden-inset titlebar, toast/update notifications, and a real GraphQL-provider reconciliation failure.

Upload the evidence directory even on failure: it contains screenshots, `layout-report.json`, and the Storybook log. Geometry mode explicitly **does not compare pixels** and needs no platform-specific baseline assets. The titlebar fixture is renderer simulation, not a packaged-native certification.

## Reviewed local pixel regression

```sh
# Only when deliberately accepting a reviewed new baseline:
node scripts/smoke-banner-layout.mjs EVIDENCE --update-baselines
# Subsequent regression replay:
node scripts/smoke-banner-layout.mjs EVIDENCE
# Or use a separate baseline artifact:
node scripts/smoke-banner-layout.mjs EVIDENCE --baseline-dir BASELINES
```

The browser clock/timezone are fixed so the Home greeting does not change at noon. Real timers continue running. The default pixel replay checks reviewed PNGs in `EVIDENCE/baselines`. Any pixel changing more than 8/255 in a channel fails (small rasterizer rounding is ignored). The initial macOS audit lives outside the repository in `paint-tracker-audit/banner-fix`; these macOS screenshots must not be treated as portable Linux pixel baselines. A future pixel CI gate should use reviewed Linux baselines from a pinned browser/OS image. The durable cross-platform CI gate is the geometry mode above; it must not silently create/accept pixel baselines on each run.

The usual `storybook:test` gate separately runs story interactions and accessibility checks, including dismiss/Retry and the quiet updater-metadata-404 state.
