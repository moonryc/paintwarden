#!/usr/bin/env bash
# Run from the Mac. Builds an exact commit in a disposable checkout, never the dev tree.
set -Eeuo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"
REV="$(git -C "$ROOT" rev-parse "${1:-HEAD}^{commit}")"
HOST="${DEPLOY_HOST:-hetzner}"
REMOTE=/root/REPOS/infrastructure/k3s/paintwarden-site
TMP="$(mktemp -d "${TMPDIR:-/tmp}/paintwarden-deploy.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/source" "$TMP/artifact"
git -C "$ROOT" archive "$REV" | tar -xf - -C "$TMP/source"
(
  cd "$TMP/source"
  npm ci --workspace paintwarden-site --include-workspace-root=false --ignore-scripts --no-audit --no-fund
  ASTRO_TELEMETRY_DISABLED=1 PUBLIC_RELEASES_AVAILABLE="${PUBLIC_RELEASES_AVAILABLE:-false}" npm run build --workspace paintwarden-site
  node scripts/copy-third-party-notices.mjs apps/paintwarden-site/dist
)
cp -R "$TMP/source/apps/paintwarden-site/dist" "$TMP/artifact/dist"
cp "$TMP/source/deploy/k8s/"* "$TMP/artifact/"
printf '{"siteId":"paintwarden-site","revision":"%s","publicReleasesAvailable":%s}\n' "$REV" "${PUBLIC_RELEASES_AVAILABLE:-false}" > "$TMP/artifact/dist/provenance.json"
printf '%s\n' "$REV" > "$TMP/artifact/SOURCE_REVISION"
ssh "$HOST" "mkdir -p '$REMOTE'"
# Only replace our own build output; no other application's files are touched.
ssh "$HOST" "rm -rf '$REMOTE/dist'"
tar -C "$TMP/artifact" -cf - . | ssh "$HOST" "tar -xf - -C '$REMOTE'"
ssh "$HOST" "bash '$REMOTE/apply.sh' '$REV'"
