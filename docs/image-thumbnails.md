# Image thumbnails

Vault-owned miniature, template and catalog-source raster image routes accept `w=160`, `w=320` or `w=640`. Without `w`, they stream the original unchanged. Other widths return 400, missing originals return 404, and corrupt/unsupported images return 415 for a requested variant (never a potentially enormous original as a thumbnail fallback). Authentication and record ownership/lookups are unchanged.

`lib/image-thumbnails.ts` uses **sharp 0.35.5**, WebP quality 78. WebP is supported by the shipped Electron/Chromium and current app browsers; no Accept-negotiation or JPEG fallback is needed. Original JPEG/PNG/AVIF/GIF/WebP files are retained for details, lightboxes and exports. Thumbnail encoding auto-orients, strips metadata, preserves aspect ratio without enlarging, uses the first frame of animations, and limits height to four times the requested width for pathological tall assets. Input decoding has a 40MP ceiling. Sharp/libvips has one worker thread and a small cache; at most two encodes run concurrently. Concurrent requests for the same variant share one promise. A bounded queue of 32 returns 503/Retry-After under overload; it never falls back to an original.

## Files and lifecycle

An immutable image UUID/key identifies its bytes, as before. Derivatives sit beside that original as:

```
images/<imageKey>.thumb-v1-160.webp
images/<imageKey>.thumb-v1-320.webp
images/<imageKey>.thumb-v1-640.webp
```

The image key + variant/version is the content address; identical photos with independently owned keys are not deduplicated. Bump `thumb-v1` if encoding parameters change, and change the URL contract/version before deploying such an encoder change so old immutable cached responses are not reused.

New uploads/imports prepare all three sizes before returning. Existing/restored images generate on demand. Failures preparing a derivative do not discard an otherwise accepted original; it remains exportable. Temporary encoder output is atomically renamed only while holding the existing image-mutation lock, after confirming that the original still exists. Native decoder slots are released **before** waiting for that lock to avoid deadlocks with uploads/restores.

Deleting an image removes its derivatives only after the existing reference/backup-hold checks allow deletion of the original. The restore serialization/reference-safety fix is retained. Backups enumerate original image keys from database references, so derivatives are **not** backed up and regenerate after restore. Copying a template image uses filesystem copies (including available derivatives) rather than Buffer → File → ArrayBuffer roundtrips, while keeping a distinct ownership key. Unchanged source checks use `stat`/`imageExists`, not full reads. HTTP image responses stream open files and close/cancel through the web-stream adapter; ZIP/share payloads that need original bytes retain their existing readers.

## Client contract

GraphQL summaries expose `thumbnailUrl`; detail `imageUrl` stays the original. The shared URL helper constructs responsive 160/320/640 `srcset` with component-specific `sizes`, lazy loading, asynchronous decoding, and reserved image boxes. Original URLs remain in details/lightboxes. Paint colors are CSS swatches, not image downloads.

External user-supplied images are deliberately unchanged, still lazy/async and dimension-reserved in lists. No new server-side fetch/proxy/SSRF surface is introduced; remote-image ingestion is a separate future feature. Catalog-source images are already downloaded on install and do get local thumbnails. Source logos are bounded-size SVGs and remain vectors.

Versioned image responses keep private immutable cache headers. The existing Electron server/account generation (`_pv_scope`) is preserved in each candidate URL and keys the desktop image cache; connection/account isolation is unchanged.

## Native and Docker dependencies

Sharp is external to the bundled ESM server. It uses npm's platform-specific optional `@img/sharp-*` and libvips packages. **Do not omit optional dependencies.** Build on the target OS/architecture. The desktop server lives under Electron `extraResources/server`, outside `app.asar`; its addons therefore need no `asarUnpack` pattern. The packaging script verifies that sharp resolves *inside* the packaged server and performs a WebP encode using its copied Node binary.

Preserve both hoisted `node_modules` and `apps/paintwarden/node_modules`. Another workspace can use a different optional sharp version; copying only the hoisted folder then silently loses the server's sharp and may accidentally resolve a developer checkout's dependencies. Verification reproduced this with the initial 0.34.5 dependency; the final patched 0.35.5 is coalesced at root with Astro's version. Keep the nested-dependency support for future lockfile changes. Docker preserves the server's workspace directory; desktop staging overlays its nested production modules into the standalone server's module folder. macOS arm64 and Linux arm64 were run for this change; Windows/x64 packaging follows sharp's supported prebuilt distributions but is not certified by those smokes.

## Reproducing measurements/smokes

Use `.nvmrc` Node 22.22.2, separate temporary data directories, and no personal vault. From the root:

```
node scripts/benchmark-image-thumbnails.mjs seed
node scripts/benchmark-image-thumbnails.mjs measure after apps/paintwarden/dist 3219
(cd apps/paintwarden && node --import tsx ../../scripts/benchmark-image-thumbnails-cpu.mts)
node scripts/smoke-image-thumbnails.mjs native /absolute/evidence/directory
node scripts/smoke-image-thumbnails.mjs docker /absolute/evidence/directory paintwarden:thumbnails-smoke
```

The harnesses retain synthetic fixtures and recovery ZIPs. The native smoke requires a freshly built actual `.app`; Docker smoke requires an already-built image and runs offline with no host port and tmpfs data. They exercise upload, every variant, immutable proxy headers/cache equality, exact full-original hashes, deletion, 19-section backup/Replace roundtrip and lazy regeneration. They are focused image checks, not full native-control or distribution/signing certification.
