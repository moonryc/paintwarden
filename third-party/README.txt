PAINTWARDEN — THIRD-PARTY NOTICES AND LIBRARY SOURCE MATERIALS

These components remain under their own licenses, not Paintwarden's PolyForm
Noncommercial license. Copyright, permission, patent and disclaimer notices are
reproduced below. Listing a component does not assert that it is present in every
platform's binary. Notice texts remain in English.

Scope and provenance
--------------------
The locked inventory conservatively includes all non-development npm lockfile
locations (server, desktop, browser and static-site dependencies, all optional
OS/CPU variants), and build tools physically copied by server staging. Site
build-only and optional components may be listed even when not distributed.
Package tarballs are verified against package-lock.json integrity before their
license/copyright/NOTICE files are collected. A few packages omit license files;
third-party/upstream-npm.json pins their upstream license by exact commit/hash.
Font notices include Inter and Fraunces (OFL-1.1).

Native notices include each locked sharp platform package's own README,
THIRD-PARTY notices, license and versions.json where provided, plus full license
and copyright material from the exact native dependency sources. The complete
librsvg release Cargo.lock is covered conservatively, including optional and
build/test crates; this is not a claim every listed crate is linked. Two older
crates (malloc_buf and objc-foundation) omit a license file upstream: their exact
release manifests' author and MIT declarations accompany the standard MIT text.

third-party/sources.json records native source URLs, archive hashes, runtime
versions, Rust crate licenses and notice provenance. third-party/inventory.json
records the lock digest, npm locations, classifications and all material hashes.
Electron's original Chromium HTML is retained alongside its readable-text copy
in these notices. The distributed Electron runtime also retains its own notices,
which can contain platform-specific additions. Node's full release LICENSE
(including its bundled dependencies) is retained separately.

LGPL and MPL native libraries — source and replacement
-----------------------------------------------------
sharp 0.35.5 uses prebuilt sharp-libvips 1.3.4, containing libvips 8.18.7.
libvips copyright includes The National Gallery, VIPS contributors and the
individual copyright holders listed in native/vips/COPYRIGHT.txt.
The prebuilt libraries are distributed under LGPL-3.0-or-later, exercising the
"or any later version" option of upstream LGPL-2/2.1 components. Full LGPL-2.1,
LGPL-3.0 and GPL-3.0 (incorporated by LGPL-3.0) texts are included. The GPL text
is supplied as the LGPL supplement, not a claim of a GPL-only npm dependency.
Cairo and other MPL-covered files keep their separate license terms.

Exact libvips source:
https://github.com/libvips/libvips/releases/download/v8.18.7/vips-8.18.7.tar.xz
https://github.com/libvips/libvips/tree/v8.18.7
Exact prebuilt-library source/build recipe (all supported platforms):
https://github.com/lovell/sharp-libvips/tree/v1.3.4
https://github.com/lovell/sharp-libvips/archive/refs/tags/v1.3.4.tar.gz
The build scripts, flags, dependency versions and patch URLs are copied under
third-party/native/sharp-libvips-build/. Exact dependency source archive URLs
and hashes are also in sources.json. This provides source links, not a separate
written source offer. No Paintwarden modifications are made to these libraries.
For any upstream Windows MXE recipe referenced by that tag, use its matching
v8.18.7 source tag, not the current main branch.

libvips is dynamically loaded as a separate shared library by the sharp native
addon, NOT statically linked into Paintwarden or its Node executable. The
packaging check reads Mach-O/PE/ELF dynamic-loader import tables and requires
separate compatible dylib/DLL/so files. Other native dependencies may be statically
incorporated into that replaceable libvips shared library; their corresponding
sources and build recipes are referenced above.

You may modify and replace the LGPL libraries and reverse engineer the combined
work for debugging those modifications. Nothing in Paintwarden's first-party
license restricts those LGPL rights. To replace them:
  1. Quit Paintwarden completely and preserve a copy of the installed app.
  2. Build the desired library with matching platform/CPU, ABI and shared-library
     names using the versioned sharp-libvips build recipe. Rebuild the complete
     libvips shared library when changing a statically incorporated dependency.
  3. Replace the shared library in the packaged server's node_modules/@img tree:
     macOS: Paintwarden.app/Contents/Resources/server/node_modules/@img/
            sharp-libvips-darwin-<arch>/lib/libvips-cpp.8.18.7.dylib
     Linux container: /app/node_modules/@img/sharp-libvips-linux-<arch>/lib/
            libvips-cpp.so.8.18.7 (or the locked linuxmusl variant)
     Windows: resources/server/node_modules/@img/sharp-win32-<arch>/lib/
            libvips-42.dll and libvips-cpp-8.18.7.dll as appropriate.
     Keep any other required sibling DLLs/shared libraries ABI-compatible.
  4. Run the bundled Node with sharp to test image conversion before using real
     vault data. Modified binaries are your responsibility; restore the saved
     originals if the build is incompatible. Updates may replace modifications.

For a modified macOS app, OS code-signature validation may require local ad-hoc
re-signing of modified binaries/app (codesign --force --deep --sign - <app>) or a
locally built app; this is not an Apple-notarized distribution signature. The app
entitlements disable library validation; no vendor signing key is needed for a
local replacement. A real signed/notarized release still needs a replacement
acceptance review. Container users may COPY replacement libraries into a derived
image; rebuild/update paths are not a restriction on the LGPL permission.

Unused sharp WASM fallback packages are deliberately removed from shipped native
server/Docker trees; artifact checks reject any physically shipped .wasm file.
They remain conservatively listed in the lock inventory. A future WASM build must
add its own static-linking/source/relink materials before relaxing that check.

Maintenance and legal review
----------------------------
Run npm run notices:generate after lock changes; -- --refresh re-collects exact
npm tarball notice files over HTTPS. npm run notices:check is offline and fails
for stale locks/notices, missing or changed reviewed material, new unclassified
license expressions, and GPL/AGPL npm dependencies. Updating libvips/Electron/Node
requires explicit source/version review; do not merely change the version field.

This engineering compliance material is not legal advice. Counsel should review
LGPL corresponding-source sufficiency (including upstream regenerated Rust build
locks/patches), modified-library replacement on signed/notarized macOS/Windows,
MPL file-level duties and first-party noncommercial license interactions before
commercialization or a signed public release. Upstream build recipes and source
links are versioned but are not a claim of byte-reproducible native builds.

FULL NOTICES FOLLOW
