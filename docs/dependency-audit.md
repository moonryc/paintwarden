# Dependency audit — prerelease fixes (2026-11-13)

Use pinned Node **22.22.2** and `npm ci`. `npm audit --json` and
`npm audit --omit=dev --json` were both run before and after triage. These are
registry snapshots, not a claim that dependencies have no undiscovered defects.

## Fixed

A scoped root override upgrades **Nx's undici 7.29.0 → 7.30.2**, without changing
Nx or other consumers. This is a compatible 7.x upgrade. It removes all 18
undici advisories reported by this audit, including the high-severity findings:

- GHSA-3wwx-pv8p-q78v (WebSocket decompression unhandled error)
- GHSA-pmjh-fq2x-6v4x (orphaned RetryHandler body)
- GHSA-r53p-7pc4-xj5r (retry response splitting)
- GHSA-rfgv-xxqx-mfg5 (unrequested WebSocket subprotocol)
- GHSA-3xpg-4rpp-hhhm (unbounded response decompression)
- GHSA-2jfj-6hjv-fm6j (Set-Cookie cache disclosure)
- GHSA-2gqq-gqf2-x968 (dump interceptor truncation)
- GHSA-w293-vg96-wgc3 (BalancedPool TLS validation)
- GHSA-8436-99hf-9mmv (unsafe-method caching)
- GHSA-rx4f-c7p8-82vq (WebSocketStream close)
- GHSA-4qv8-2p9j-2685 (EventSource parser memory)
- GHSA-f72v-6w45-q472 (integrity algorithm tokens)
- GHSA-xjj6-f33q-929c (excessive content encodings)
- GHSA-4w7w-5xrc-9h26 (cross-origin redirect cache disclosure)
- GHSA-2m5v-pch6-74hx (Agent TLS validation)
- GHSA-qrxm-fqhp-jwvm (TLS renegotiation)
- GHSA-9fm3-97px-rjf6 (WebSocket PONG buffering)
- GHSA-55wc-3pg8-jfw6 (decompress interceptor exception)

## Accepted production-scope exception: Astro 7.4.0

The root workspace's production audit includes the **static product website**;
it does not mean Astro runs in the app server. Two advisories aggregate to one
moderate affected package:

| Advisory                                                                 | Severity | Applicability / decision                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [GHSA-mh32-jxcr-mh9f](https://github.com/advisories/GHSA-mh32-jxcr-mh9f) | Low      | Dynamic-tag attribute injection. The `.astro` templates use fixed tags and fixed component imports, not untrusted dynamic tag names. User/plugin vault content is not an input to this build. Accept for this static site.                                                 |
| [GHSA-r3h5-4585-7x3w](https://github.com/advisories/GHSA-r3h5-4585-7x3w) | Moderate | Case-variant sibling read via the `@astrojs/node` image endpoint. `apps/paintwarden-site/astro.config.mjs` has `output: "static"`, no server adapter and no `@astrojs/node` dependency. Deployed output is static files; no such endpoint exists. Accept as not reachable. |

An Astro **7.4.12** patch upgrade was resolved and tested for dependency
compatibility, but rejected: it and the earliest release beyond both affected
ranges (**7.4.7**) require Node **>=22.23.4**. This task explicitly keeps
22.22.2; silently installing an unsupported engine is not a safe upgrade.
The experiment was reverted; the final lockfile changes only Nx's undici.
Revisit when upgrading the Node pin, introducing dynamic Astro tags, using an
adapter/SSR/image endpoint, or accepting untrusted website-build input.

`npm run audit:production` validates npm's JSON response, fails on audit/registry
errors or any unreviewed production advisory. Its original Astro-only exception
permits only these two URLs for the locked root Astro **7.4.0**, at their
reviewed severities. The additional exact build-only graph reviewed below is
separately pinned. CI runs the check.
A raw `npm audit --omit=dev` still exits nonzero for this documented exception.
The Docker and packaged desktop server exclude the website workspace; neither
ships Astro. This exception is not a waiver for the app's runtime dependencies.

## Picomatch build-only exception (reviewed 2026-11-17)

[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf),
**high**: repeated single-branch extglobs can cause ReDoS. The registry and GitHub
advisory were checked directly on 2026-11-17: latest picomatch is **4.0.7**, all
versions through 4.0.7 are affected, and `first_patched_version` is null. There
is no patched 2.x/3.x/4.x release to select; forcing the 2.x consumers onto 4.0.7
would not fix the vulnerability. No dependency/Node/Astro upgrade or lockfile
change was made for this exception.

The locked matcher copies are `node_modules/picomatch` **4.0.7**,
`node_modules/anymatch/node_modules/picomatch` **2.3.2**, and development-only
`node_modules/micromatch/node_modules/picomatch` **2.3.2**. These consumers match
**trusted, repository-owned build/source-discovery globs**, not user-supplied,
plugin-supplied or HTTP patterns. Do not execute an untrusted checkout/build
configuration on the assumption that this exception makes its globs safe.

Although npm classifies the website/build-tool chain as production dependencies,
this is **not an app-runtime exception**. Release-coordinator evidence for this
review established all of the following:

- staged production server `node_modules`: no `picomatch/package.json`;
- actual packaged Electron ASAR file list: no picomatch paths;
- built Docker `paintwarden:ui-quick3` final `/app` filesystem: no picomatch paths
  (`paint-tracker-audit/ui-quick3/docker-picomatch.txt` is empty);
- built static site/web JavaScript scan: references only in legal-notice assets
  and `licenses/index.html`, not executable matcher code.

**Repeat the runtime-absence checks for release artifacts.** The audit checker
itself validates the lock/report contract, not the built artifact contents. If
any runtime copy or executable bundled matcher appears, or application input is
allowed to supply glob patterns, this decision is invalid and release must fail
pending review. License listings alone do not establish runtime inclusion.

`scripts/production-audit-picomatch-reviewed.json` records the exact reviewed
production audit graph: **11 high affected-package entries** propagated from
this one root advisory, with the two original Astro root advisories unchanged.
The affected names are picomatch, anymatch, fdir, tinyglobby, unstorage, vite,
@vitejs/plugin-react, @astrojs/internal-helpers, @astrojs/markdown-satteri,
@astrojs/react, and astro. It also pins **16 lock locations**, their exact
versions and development classifications, including copies omitted by the
production audit. The checker rejects any additional/missing location, changed
version/classification, new advisory (including an Astro advisory), changed
severity, advisory identity, propagated edge, node path, or report shape/count.
This is not a package-name or blanket-high-severity allowlist. Even harmless
registry-report shape changes require re-review rather than automatic widening.
Raw `npm audit --omit=dev` remains nonzero.

**Removal follow-up:** monitor the advisory and its referenced
[upstream PR #194](https://github.com/micromatch/picomatch/pull/194). Once a
published compatible release is confirmed to fix this advisory, upgrade every
affected locked copy (review any required narrow override), remove this
picomatch graph exception/snapshot, regenerate third-party notices, and rerun
both audit scopes, negative controls, runtime-absence checks and normal build
and UI gates. A PR merge alone is not proof of a fixed published release.

## Accepted development/build-only advisories

None of the packages below is in `npm audit --omit=dev`. Inputs and scope matter:
run development servers on loopback, do not expose build-tool servers publicly,
and review untrusted PRs before executing their scripts.

| Root advisory                                                                                                                    | Affected resolved packages                                                                        | Decision                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), moderate globparts amplification                       | minimatch 10.2.5 and 9.0.9                                                                        | These consumers match repository-owned configuration/build globs, not HTTP/user/plugin-supplied patterns. Fixed version starts at 11.0.1; no patched 9.x/10.x is offered. Do not force a major matcher change across linting, codegen and packaging merely to silence audit. Accept dev-only with trusted-pattern constraint; revisit upstream compatible updates.                              |
| [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), moderate cancellation bypass                           | glob 13.0.7 under Storybook's React docgen Vite plugin                                            | Source discovery is build-time, restricted to this checkout, not a service relying on AbortSignal as a resource/security boundary. Patch begins at 14.0.2, a major override outside the caller's range. Accept dev-only; prefer an upstream plugin update over forcing it.                                                                                                                      |
| [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99), moderate esbuild development-server cross-origin reads | esbuild 0.18.20 under `@esbuild-kit/core-utils` → `@esbuild-kit/esm-loader` → drizzle-kit 0.31.10 | This legacy loader uses esbuild `transform` / `transformSync`, not its vulnerable development-server API. Normal app builds use separate modern esbuild versions. No old esbuild server is launched by our migration/generation scripts. Accept dev-only/unreachable; remove with upstream loader replacement. The suggested drizzle-kit 0.18.1 is a downgrade and is deliberately not applied. |

The remaining **22 moderate affected package entries** are those three root
advisories, the Astro exception, and npm's propagated dependency entries (not
22 separate exploitable flaws):

- minimatch → `@electron/universal`, `app-builder-lib`, `dmg-builder`,
  `electron-builder-squirrel-windows`, `electron-builder`, `nx`, `graphql-config`,
  `@graphql-codegen/cli`, `@typescript-eslint/typescript-estree`,
  `@typescript-eslint/parser`, `@typescript-eslint/utils`,
  `@typescript-eslint/type-utils`, `@typescript-eslint/eslint-plugin`;
- glob/minimatch → `@joshwooding/vite-plugin-react-docgen-typescript`,
  `@storybook/react-vite`;
- esbuild → `@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader`, `drizzle-kit`;
- the three root packages themselves and Astro.

Suggested major downgrades of Nx, Electron Builder, GraphQL Codegen, TypeScript
ESLint and Storybook were rejected. They would trade known working interfaces
for older toolchains, not establish that our runtime is safer.

Original 2026-11-13 full audit after triage: **0 high, 0 critical, 22 moderate
package entries**; production scope was **1 moderate package entry**, solely
Astro. The 2026-11-17 production snapshot is now **11 high, 0 critical package
entries**, reflecting the newly disclosed picomatch advisory and propagation
above, not 11 independent root flaws. Repeat both audit scopes before releases;
re-triage new advisories rather than extending an allowlist blindly.

The picomatch graph comparison excludes only npm’s volatile `fixAvailable` upgrade recommendation (its shape remains validated). Installed lock versions/paths, advisory objects, severities and propagation edges stay exact; a changed suggested upgrade cannot authorize a runtime dependency. Artifact package inventory rejects `picomatch` even when its license is inventoried.
