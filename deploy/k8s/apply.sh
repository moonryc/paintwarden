#!/usr/bin/env bash
# Server-side; only Paintwarden resources and its own image are changed.
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
REV="${1:-$(cat SOURCE_REVISION)}"
[[ "$REV" =~ ^[0-9a-f]{40}$ ]] || { echo 'Full source commit required' >&2; exit 1; }
IMAGE="websites/paintwarden-site:sha-$REV"
verify_others() {
  local url code
  for url in https://ryanmoon.xyz https://skill-sync.ryanmoon.xyz https://family-wishlist.ryanmoon.xyz http://iran-war.178.105.194.243.sslip.io http://trump-lincoln.178.105.194.243.sslip.io; do
    code="$(curl --noproxy '*' -sS --max-time 20 -o /dev/null -w '%{http_code}' "$url")"
    printf '%s %s\n' "$code" "$url"
    [[ "$code" == 200 ]] || return 1
  done
}
verify_others
# Preserve ACME once explicitly enabled; never initiate it automatically before DNS.
CERT="$(kubectl -n websites get ingress paintwarden-site -o json --ignore-not-found | python3 -c 'import json,sys; s=sys.stdin.read(); print(json.loads(s).get("metadata",{}).get("annotations",{}).get("traefik.ingress.kubernetes.io/router.tls.certresolver", "") if s.strip() else "")')"
CERTRESOLVER_ANNOTATION=''
if [[ "$CERT" == letsencrypt ]]; then
  CERTRESOLVER_ANNOTATION='traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt'
fi
sed -e "s|__IMAGE__|$IMAGE|g" -e "s|__CERTRESOLVER_ANNOTATION__|$CERTRESOLVER_ANNOTATION|g" manifest.yaml.template > manifest.yaml
kubectl apply --dry-run=server -f manifest.yaml >/dev/null
docker build --platform linux/amd64 --build-arg "SOURCE_REVISION=$REV" -t "$IMAGE" .
[[ "$(docker image inspect "$IMAGE" --format '{{.Architecture}}')" == amd64 ]]
docker image save "$IMAGE" | k3s ctr --namespace k8s.io images import -
kubectl apply -f manifest.yaml
kubectl -n websites rollout status deployment/paintwarden-site --timeout=120s
verify_others
curl --noproxy '*' -fsSk --resolve paintwarden.com:443:178.105.194.243 https://paintwarden.com/ -o /dev/null
curl --noproxy '*' -sS --resolve paintwarden.com:80:178.105.194.243 -o /dev/null -w 'Paintwarden HTTP: %{http_code}\n' http://paintwarden.com/
docker image inspect "$IMAGE" --format 'Image bytes: {{.Size}}; architecture: {{.Architecture}}'
df -h /
# Intentionally no global image/builder/volume pruning on this shared production host.
