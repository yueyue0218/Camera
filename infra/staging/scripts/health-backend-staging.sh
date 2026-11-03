#!/usr/bin/env bash
set -euo pipefail
umask 077

# Preserve the existing shared health helper; add the 0a31 privacy route guard
# only to Backend-only Staging acceptance (including old-service recovery).
health_url="${1:?health URL is required}"
public_url="${2:?public URL is required}"
expected_origin="${3:?expected origin is required}"
attempts="${4:-12}"
interval_seconds="${5:-5}"
for value in "$health_url" "$public_url" "$expected_origin"; do
  [[ "$value" =~ ^https://[A-Za-z0-9.:-]+(/[^[:space:]\']*)?$ ]] || exit 2
done
[[ "$attempts" =~ ^[1-9][0-9]*$ && "$interval_seconds" =~ ^[0-9]+$ ]]
command -v python3 >/dev/null || { echo 'Python 3 is required for privacy acceptance' >&2; exit 1; }
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
privacy_file="$(mktemp)"
trap 'rm -f -- "$privacy_file"' EXIT

privacy_healthy() {
  local response
  response="$(curl -q --noproxy '*' --proto '=https' --silent --show-error --max-time 10 \
    --output "$privacy_file" --write-out '%{http_code} %{content_type}' \
    "$expected_origin/privacy/consent")" || return 1
  [[ "$response" == '200 application/json' || "$response" == '200 application/json;'* ]] || return 1
  python3 - "$privacy_file" <<'PY'
import json, pathlib, sys
try:
    value = json.loads(pathlib.Path(sys.argv[1]).read_text())
    good = (isinstance(value, dict) and type(value.get('code')) is int
            and value['code'] == 40101 and 'data' in value and value['data'] is None)
except (OSError, ValueError):
    good = False
raise SystemExit(0 if good else 1)
PY
}

for ((attempt = 1; attempt <= attempts; attempt++)); do
  if bash "$script_dir/health-check.sh" "$health_url" "$public_url" "$expected_origin" 1 0 \
    && privacy_healthy; then
    echo "BACKEND_STAGING_HEALTH=PASS attempt=$attempt"
    echo 'PRIVACY_UNAUTHENTICATED_RESPONSE=PASS'
    exit 0
  fi
  if (( attempt < attempts )); then sleep "$interval_seconds"; fi
done
echo 'BACKEND_STAGING_HEALTH=FAIL' >&2
exit 1
