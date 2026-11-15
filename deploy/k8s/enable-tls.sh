#!/usr/bin/env bash
# Run once on Hetzner AFTER Namecheap DNS has propagated. No retry loop.
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
python3 - <<'PY'
import socket
expected = {'178.105.194.243'}
for host in ('paintwarden.com', 'www.paintwarden.com'):
    addresses = {a[4][0] for a in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)}
    print(host, ', '.join(sorted(addresses)))
    if addresses != expected:
        raise SystemExit('DNS is not ready (including AAAA); refusing ACME activation.')
PY
kubectl -n websites annotate ingress paintwarden-site traefik.ingress.kubernetes.io/router.tls.certresolver=letsencrypt --overwrite
# Keep saved applied manifest in sync. apply.sh preserves the live annotation on later deploys.
if [[ -f manifest.yaml ]]; then
  python3 - <<'PY'
p = 'manifest.yaml'
s = open(p).read()
marker = '    # No certresolver until both DNS names point here. Run enable-tls.sh once ready.\n'
annotation = '    traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt\n'
if annotation not in s:
    s = s.replace(marker, marker + annotation)
    open(p, 'w').write(s)
PY
fi
echo 'ACME enabled once. Inspect logs; do not repeatedly toggle/restart the ingress.'
kubectl -n kube-system logs deploy/traefik-patched --since=2m --tail=100 | grep -Ei 'paintwarden|acme|certificate' || true
echo 'After issuance, verify: curl -I https://paintwarden.com && curl -I https://www.paintwarden.com'
