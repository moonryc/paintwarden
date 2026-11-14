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

| Advisory | Severity | Applicability / decision |
| --- | --- | --- |
| [GHSA-mh32-jxcr-mh9f](https://github.com/advisories/GHSA-mh32-jxcr-mh9f) | Low | Dynamic-tag attribute injection. The `.astro` templates use fixed tags and fixed component imports, not untrusted dynamic tag names. User/plugin vault content is not an input to this build. Accept for this static site. |
| [GHSA-r3h5-4585-7x3w](https://github.com/advisories/GHSA-r3h5-4585-7x3w) | Moderate | Case-variant sibling read via the `@astrojs/node` image endpoint. `apps/paintwarden-site/astro.config.mjs` has `output: "static"`, no server adapter and no `@astrojs/node` dependency. Deployed output is static files; no such endpoint exists. Accept as not reachable. |

An Astro **7.4.12** patch upgrade was resolved and tested for dependency
compatibility, but rejected: it and the earliest release beyond both affected
ranges (**7.4.7**) require Node **>=22.23.4**. This task explicitly keeps
22.22.2; silently installing an unsupported engine is not a safe upgrade.
The experiment was reverted; the final lockfile changes only Nx's undici.
Revisit when upgrading the Node pin, introducing dynamic Astro tags, using an
adapter/SSR/image endpoint, or accepting untrusted website-build input.

`npm run audit:production` validates npm's JSON response, fails on audit/registry
errors or any unreviewed production advisory, and permits only these two URLs
for the locked root Astro **7.4.0**, at their reviewed severities. CI runs it.
A raw `npm audit --omit=dev` still exits nonzero for this documented exception.
The Docker and packaged desktop server exclude the website workspace; neither
ships Astro. This exception is not a waiver for the app's runtime dependencies.

## Accepted development/build-only advisories

None of the packages below is in `npm audit --omit=dev`. Inputs and scope matter:
run development servers on loopback, do not expose build-tool servers publicly,
and review untrusted PRs before executing their scripts.

| Root advisory | Affected resolved packages | Decision |
| --- | --- | --- |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), moderate globparts amplification | minimatch 10.2.5 and 9.0.9 | These consumers match repository-owned configuration/build globs, not HTTP/user/plugin-supplied patterns. Fixed version starts at 11.0.1; no patched 9.x/10.x is offered. Do not force a major matcher change across linting, codegen and packaging merely to silence audit. Accept dev-only with trusted-pattern constraint; revisit upstream compatible updates. |
| [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), moderate cancellation bypass | glob 13.0.7 under Storybook's React docgen Vite plugin | Source discovery is build-time, restricted to this checkout, not a service relying on AbortSignal as a resource/security boundary. Patch begins at 14.0.2, a major override outside the caller's range. Accept dev-only; prefer an upstream plugin update over forcing it. |
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

Full audit after triage: **0 high, 0 critical, 22 moderate package entries**.
Production-scope: **0 high, 0 critical, 1 moderate package entry**, solely the
reviewed static-site Astro exception above. Repeat both audit scopes before
releases; re-triage new advisories rather than extending an allowlist blindly.
