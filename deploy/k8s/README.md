# Paintwarden static website (Hetzner k3s)

Additive deployment for `paintwarden.com` and `www.paintwarden.com` in namespace `websites`.
Mirrors the existing portfolio deployment: public-websites labels/network policy,
website-runtime account, non-root UID 101, read-only filesystem, port 8080, probes,
25m/32Mi requests and 200m/128Mi limits, Traefik HTTPS redirect and www → apex.

## Redeploy from the Mac

With Node >=22.13 and npm on PATH, from a checkout containing this deployment:

```sh
bash deploy/k8s/deploy.sh
```

Optional first argument is an exact source commit/ref (default HEAD). The script
archives that commit into a disposable directory, installs only site workspace
dependencies, builds static Astro output and copies LICENSE/third-party notices.
It transfers only the static artifact/deployment files, builds a tiny pinned
nginx-unprivileged image **on Hetzner (linux/amd64)**, tags
`websites/paintwarden-site:sha-<full-source-commit>`, imports it with
`docker save | k3s ctr --namespace k8s.io images import -`, then applies only
Paintwarden resources. The main checkout/dev server is never modified.

Server files/artifact are saved alongside the other deployments at:
`/root/REPOS/infrastructure/k3s/paintwarden-site/`.
This is deliberately separate from the existing all-sites render/deploy script;
no unrelated app manifests or environment files are changed.

`PUBLIC_RELEASES_AVAILABLE` defaults to false: all 13 languages show a private-beta
coming-soon Download page; private GitHub links are suppressed; local licenses and
notices remain available. After the repository and release are public, use
`PUBLIC_RELEASES_AVAILABLE=true bash deploy/k8s/deploy.sh` **at a new source commit**
so immutable SHA image tags are never reused for different availability settings.
Only flip this flag when both repository resources and releases are public.

Server-only rebuild of the already-transferred artifact:
`ssh hetzner 'bash /root/REPOS/infrastructure/k3s/paintwarden-site/apply.sh'`.
No image/volume/builder global pruning is performed.

## DNS and trusted TLS

Replace Namecheap parking/URL-redirect records with:

| Type | Host | Value |
|---|---|---|
| A | @ | 178.105.194.243 |
| A | www | 178.105.194.243 |

Alternatively www may be `CNAME www → paintwarden.com`. Remove conflicting A/AAAA
records for these names. No DNS credentials are needed on the server.

Until DNS propagates, HTTPS works only with Traefik's default (untrusted) cert and
`curl -k --resolve paintwarden.com:443:178.105.194.243 https://paintwarden.com/`.
The initial manifest intentionally omits the ACME resolver so it makes **zero**
premature Let's Encrypt attempts. After both names resolve exclusively to Hetzner:

```sh
ssh hetzner 'bash /root/REPOS/infrastructure/k3s/paintwarden-site/enable-tls.sh'
```

This checks DNS (including unwanted AAAA), opts in once, and shows recent logs.
Do not repeatedly toggle/restart to retry failed ACME validations. Later deploys
preserve the live resolver annotation. Verify both names without `-k` after issuance.

## Verification / rollback

`apply.sh` checks all five pre-existing sites return 200 before and after applying,
waits for the new pod, and checks the new host through `curl --resolve`.
`/_astro/` successful hashed files cache for a year; HTML revalidates; other files
cache for one hour; errors do not receive long-lived cache headers. gzip is enabled.
Missing routes/assets return real 404, not index.html.

Regression test:
`node --test apps/paintwarden-site/tests/release-gate.test.mjs` (two production builds,
default private mode plus restored public mode, all 13 notice translations).

Rollback a later site release: `kubectl -n websites rollout undo deployment/paintwarden-site`.
Remove only this site: `kubectl delete -f /root/REPOS/infrastructure/k3s/paintwarden-site/manifest.yaml`.
Never run a cluster-wide/image/volume prune on this shared server.
