# Website screenshot provenance

The website's `public/images/app/` assets are screenshots of the real, locally
built production Paintwarden web application, not UI mock-ups. They use a fresh
synthetic vault created by `e2e/site-capture.mjs`:

- Fictional Fable & Finch paints, schemes and miniature templates, imported through
  the real ZIP installation endpoint. No prepared catalog or manufacturer data.
- Original procedural SVG miniature dioramas, rasterized locally with sharp. No
  external images, logos, photographs, licensed miniature designs or image fetches.
- Real owner setup, GraphQL commands, folders, recipes and Swatch Scan pins.
- Genuine installation of a larger synthetic plugin while the screenshots show
  its active progress. The script cancels that installation afterward.
- A separate random loopback server port, temporary data directory and fresh
  browser contexts. The script never uses an installed app or an existing vault.

## Reproduce

Use the repository's pinned Node 22.22.2 after `npm ci`. Rebase the website branch
onto the reviewed current main **before** the production build and capture.

```sh
npm run build
node e2e/site-capture.mjs /absolute/path/to/capture-evidence
node scripts/optimize-site-screenshots.mjs /absolute/path/to/capture-evidence
node --test apps/paintwarden-site/tests/*.test.mjs
```

Captures are 1440×1000 desktop pixels and 390×844 phone CSS pixels at DPR 2
(780×1688 image pixels). Separate recipe screenshots scroll the real miniature
drawer; the phone complementary view scrolls to its palette. The scan screenshot
contains three actual image-space sampling pins. No UI or pixels are mocked or
retouched.

The optimizer produces WebP variants at 720/1080/1440 pixels for desktop and
390/780 pixels for phone. The shared image component declares responsive sources,
intrinsic dimensions, lazy loading and asynchronous decoding. Original PNGs,
source revision, capture checks, generated synthetic ZIP and output dimensions/
byte counts remain in the supplied evidence directory, not the repository.

## Website-only verification

The website smoke starts a disposable static server, checks all thirteen locale
pickers and five routes at desktop/phone widths, detects overflow and captures
the new phone/privacy callouts and full phone guide. It never contacts external
links or an app server. To keep each invocation bounded on slower machines, run
these two complementary locale batches:

```sh
PUBLIC_RELEASES_AVAILABLE=false SITE_SMOKE_LOCALES=en,es,fr,de,it,pt-BR,nl \
  node scripts/smoke-i18n-site.mjs /absolute/path/to/site-west-evidence
PUBLIC_RELEASES_AVAILABLE=false SITE_SMOKE_LOCALES=pl,ru,ja,ko,zh-Hans,zh-Hant \
  node scripts/smoke-i18n-site.mjs /absolute/path/to/site-east-evidence
```

The site release-gate tests separately build both private-beta and public-release
modes. Production remains `PUBLIC_RELEASES_AVAILABLE=false` until authorized.
