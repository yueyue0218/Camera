#!/usr/bin/env bash
set -euo pipefail

sha="${1:?full Git SHA is required}"
backend_changed="${2:?backend flag is required}"
nginx_changed="${3:?nginx flag is required}"
systemd_changed="${4:?systemd flag is required}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]]
for flag in "$backend_changed" "$nginx_changed" "$systemd_changed"; do
  [[ "$flag" == true || "$flag" == false ]]
done

state_root=/home/portra-deploy/state
install -d -m 700 "$state_root"
printf '%s\n' "$sha" > "$state_root/infra-commit.txt"
printf 'INFRA_COMMIT=%s\nBACKEND_CHANGED=%s\nNGINX_CHANGED=%s\nSYSTEMD_CHANGED=%s\nDEPLOYED_AT=%s\n' \
  "$sha" "$backend_changed" "$nginx_changed" "$systemd_changed" \
  "$(date -u +%Y%m%dT%H%M%SZ)" > "$state_root/infra-state.env"
chmod 0600 "$state_root/infra-commit.txt" "$state_root/infra-state.env"
echo "INFRA_COMMIT=$sha"
