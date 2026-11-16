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

The capture also writes `phone-access-settings.png` at 1440×1050 from the real
production Settings component in a separate browser context. Its illustrative
desktop bridge supplies documentation-only sample addresses `192.0.2.10:48177`
and `100.64.0.10:48177`; the component genuinely generates the local QR code.
It contains no real machine address or name. All thirteen site locales explicitly
label this illustration, stored as a PNG in `docs/images/` and a WebP in the site's
`public/images/`. The other 22 app screenshots use the real synthetic vault without
mocked UI. The same capture and optimization commands above reproduce both kinds.

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

## Exhaustive responsive / layout-shift audit

After the site build, run the isolated layout audit with pinned Node 22.22.2:

```sh
node scripts/audit-site-layout.mjs /absolute/path/to/layout-west --locales=en,es,fr,de
node scripts/audit-site-layout.mjs /absolute/path/to/layout-central --locales=it,pt-BR,nl,pl
node scripts/audit-site-layout.mjs /absolute/path/to/layout-east --locales=ru,ja,ko,zh-Hans,zh-Hant
```

The audit does **not** build anything or start the app. It copies the existing
production site output into disposable storage, serves only that snapshot on a
random loopback port, uses fresh headless Chromium contexts, and cleans up its
server and temporary files. `--quick` checks just 320px and 1440px; omit it for
the complete audit. Each evidence directory receives a JSON report and the
snapshot's homepage SHA-256 so independently run shards can be matched.

Full coverage is all thirteen locales × five routes (overview, docs, phone, FAQ,
download), with cold top-level loads at 320, 390, 640, 768, 1024, 1280 and 1440px
for both saved-language and browser-language selection: 910 cold-load cases.
Cache is disabled; fonts and all images are settled before measurement. Reports
include raw loading-shift sums **including** recent-input shifts, Web Vitals CLS,
page overflow, and off-viewport meaningful content, not just hidden-scrollbar
checks. Raw loading-shift sums must be exactly zero.

For every locale/route, a loaded same-origin iframe's actual CSS viewport is
resized through **every integer width 320–1440**, forcing layout and checking
root/body scroll width at each pixel (72,865 checks). This tests CSS media-query
layout, not a separate cold navigation or screenshot at every pixel. Real
language-picker transitions at 320px and 1440px separately require stable header
and picker geometry, no overflow/clipping and no unexpected CLS. Intentional
translated-content reflow remains explicitly recorded as raw shift values; it
is not misrepresented as a zero-shift interaction. No-JavaScript English SSR and
font/catalog/JavaScript-request failure checks verify visible fail-open behavior.

The page hides only its initial JS-driven paint while its selected language and
fonts settle, preventing an English-first flash and font swaps; it retains usable
English SSR without JavaScript. An eight-second fail-open deadline also prevents
a failed hydration request from leaving an invisible page. Page-level overflow
masking is not used to satisfy the audit.
