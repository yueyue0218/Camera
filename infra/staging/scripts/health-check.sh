#!/usr/bin/env bash
set -euo pipefail

health_url="${1:?health URL is required}"
public_url="${2:?public URL is required}"
expected_origin="${3:?expected origin is required}"
attempts="${4:-12}"
interval_seconds="${5:-5}"

for value in "$health_url" "$public_url" "$expected_origin"; do
  [[ "$value" =~ ^https://[A-Za-z0-9.:-]+(/[^[:space:]\']*)?$ ]] || {
    echo "Refusing non-HTTPS or malformed acceptance URL" >&2
    exit 2
  }
done
[[ "$attempts" =~ ^[1-9][0-9]*$ ]]
[[ "$interval_seconds" =~ ^[0-9]+$ ]]

body_file="$(mktemp)"
header_file="$(mktemp)"
trap 'rm -f "$body_file" "$header_file"' EXIT

for ((attempt = 1; attempt <= attempts; attempt++)); do
  health_status="$(curl --silent --show-error --max-time 10 \
    --output "$body_file" --write-out '%{http_code}' "$health_url" || true)"
  public_status="$(curl --silent --show-error --max-time 10 \
    --output /dev/null --write-out '%{http_code}' "$public_url" || true)"
  cors_status="$(curl --silent --show-error --max-time 10 \
    --request OPTIONS --output /dev/null --dump-header "$header_file" \
    --header "Origin: $expected_origin" \
    --header 'Access-Control-Request-Method: POST' \
    --header 'Access-Control-Request-Headers: authorization,content-type' \
    --write-out '%{http_code}' "${expected_origin}/auth/refresh" || true)"

  if [[ "$health_status" == 200 ]] \
    && grep -Eq '"code"[[:space:]]*:[[:space:]]*200' "$body_file" \
    && [[ "$public_status" == 200 ]] \
    && [[ "$cors_status" == 200 ]] \
    && grep -Fqi "Access-Control-Allow-Origin: $expected_origin" "$header_file" \
    && grep -Fqi 'Access-Control-Allow-Credentials: true' "$header_file" \
    && grep -Eqi '^Access-Control-Allow-Headers:.*authorization' "$header_file"; then
    echo "HEALTH_CHECK=PASS attempt=$attempt"
    echo "HTTPS_GET=PASS"
    echo "CORS_PREFLIGHT=PASS origin=$expected_origin"
    echo "AUTHORIZATION_PREFLIGHT=PASS"
    exit 0
  fi

  echo "Health attempt $attempt/$attempts failed; retrying" >&2
  if (( attempt < attempts )); then
    sleep "$interval_seconds"
  fi
done

echo "HEALTH_CHECK=FAIL" >&2
exit 1
