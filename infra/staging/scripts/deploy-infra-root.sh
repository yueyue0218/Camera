#!/usr/bin/env bash
set -euo pipefail

candidate_root="${1:?candidate infra directory is required}"
sha="${2:?full Git SHA is required}"
surfaces="${3:?surface list is required}"
health_url="${4:?health URL is required}"
public_url="${5:?public URL is required}"
expected_origin="${6:?expected origin is required}"

[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid Git SHA" >&2; exit 2; }
[[ "$candidate_root" == "/home/portra-deploy/incoming/$sha/infra" ]]
[[ "$(realpath -e "$candidate_root")" == "$candidate_root" ]]
[[ "$surfaces" == nginx || "$surfaces" == systemd || "$surfaces" == nginx,systemd ]]
for value in "$health_url" "$public_url" "$expected_origin"; do
  [[ "$value" =~ ^https://[A-Za-z0-9.:-]+(/[^[:space:]]*)?$ ]] || exit 2
done

deploy_nginx=false
deploy_systemd=false
[[ ",$surfaces," == *,nginx,* ]] && deploy_nginx=true
[[ ",$surfaces," == *,systemd,* ]] && deploy_systemd=true

nginx_ssl_target=/etc/nginx/conf.d/portra-ssl.conf
nginx_shared_target=/etc/nginx/default.d/portra.conf
systemd_target=/etc/systemd/system/portra-backend.service
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_root="/opt/portra/backups/infra/$timestamp-$sha"
staged_root="/opt/portra/deploy/candidates/$sha"
validation_root="/opt/portra/deploy/validation/$sha-$$"

install -d -o root -g root -m 0750 "$backup_root" "$staged_root" "$validation_root"

stage_candidate() {
  local source="$1" destination="$2"
  [[ -f "$source" && ! -L "$source" ]]
  install -o root -g root -m 0644 "$source" "$destination"
}

if [[ "$deploy_nginx" == true ]]; then
  stage_candidate "$candidate_root/nginx/portra-ssl.conf" "$staged_root/portra-ssl.conf"
  stage_candidate "$candidate_root/nginx/portra.conf" "$staged_root/portra.conf"
fi
if [[ "$deploy_systemd" == true ]]; then
  stage_candidate "$candidate_root/systemd/portra-backend.service" \
    "$staged_root/portra-backend.service"
fi

validate_nginx_candidate() {
  local validation_ssl="$validation_root/portra-ssl.conf"
  sed "s|include /etc/nginx/default.d/portra.conf;|include $staged_root/portra.conf;|" \
    "$staged_root/portra-ssl.conf" > "$validation_ssl"
  cat > "$validation_root/nginx.conf" <<EOF
pid /run/portra-nginx-validate-$$.pid;
error_log stderr;
events {}
http {
    include /etc/nginx/mime.types;
    include $validation_ssl;
    server {
        listen 80;
        listen [::]:80;
        server_name 47.76.106.57;
        include $staged_root/portra.conf;
    }
}
EOF
  /usr/sbin/nginx -t -c "$validation_root/nginx.conf" -p /
}

acceptance_check() {
  local body headers health_status public_status cors_status
  body="$(mktemp)"
  headers="$(mktemp)"
  for attempt in {1..12}; do
    health_status="$(curl --silent --show-error --max-time 10 --output "$body" \
      --write-out '%{http_code}' "$health_url" || true)"
    public_status="$(curl --silent --show-error --max-time 10 --output /dev/null \
      --write-out '%{http_code}' "$public_url" || true)"
    cors_status="$(curl --silent --show-error --max-time 10 --request OPTIONS \
      --output /dev/null --dump-header "$headers" \
      --header "Origin: $expected_origin" \
      --header 'Access-Control-Request-Method: POST' \
      --header 'Access-Control-Request-Headers: authorization,content-type' \
      --write-out '%{http_code}' "${expected_origin}/auth/refresh" || true)"
    if [[ "$health_status" == 200 ]] \
      && grep -Eq '"code"[[:space:]]*:[[:space:]]*200' "$body" \
      && [[ "$public_status" == 200 && "$cors_status" == 200 ]] \
      && grep -Fqi "Access-Control-Allow-Origin: $expected_origin" "$headers" \
      && grep -Fqi 'Access-Control-Allow-Credentials: true' "$headers" \
      && grep -Eqi '^Access-Control-Allow-Headers:.*authorization' "$headers"; then
      rm -f "$body" "$headers"
      return 0
    fi
    sleep 5
  done
  rm -f "$body" "$headers"
  return 1
}

if [[ "$deploy_nginx" == true ]]; then
  /usr/sbin/nginx -t
  validate_nginx_candidate
  install -d -o root -g root -m 0750 "$backup_root/nginx"
  cp -a "$nginx_ssl_target" "$backup_root/nginx/portra-ssl.conf"
  cp -a "$nginx_shared_target" "$backup_root/nginx/portra.conf"
fi
if [[ "$deploy_systemd" == true ]]; then
  /usr/bin/systemd-analyze verify "$staged_root/portra-backend.service"
  install -d -o root -g root -m 0750 "$backup_root/systemd"
  cp -a "$systemd_target" "$backup_root/systemd/portra-backend.service"
fi

rollback_infra() {
  echo "Infrastructure acceptance failed; restoring known-good configuration" >&2
  if [[ "$deploy_nginx" == true ]]; then
    install -o root -g root -m 0644 "$backup_root/nginx/portra-ssl.conf" "$nginx_ssl_target"
    install -o root -g root -m 0644 "$backup_root/nginx/portra.conf" "$nginx_shared_target"
    /usr/sbin/nginx -t
    /usr/bin/systemctl reload nginx.service
  fi
  if [[ "$deploy_systemd" == true ]]; then
    install -o root -g root -m 0644 "$backup_root/systemd/portra-backend.service" "$systemd_target"
    /usr/bin/systemctl daemon-reload
    /usr/bin/systemctl restart portra-backend.service
  fi
  acceptance_check
}

apply_infra() {
  if [[ "$deploy_nginx" == true ]]; then
    install -o root -g root -m 0644 "$staged_root/portra-ssl.conf" \
      "${nginx_ssl_target}.next-$sha" || return 1
    install -o root -g root -m 0644 "$staged_root/portra.conf" \
      "${nginx_shared_target}.next-$sha" || return 1
    mv -f "${nginx_ssl_target}.next-$sha" "$nginx_ssl_target" || return 1
    mv -f "${nginx_shared_target}.next-$sha" "$nginx_shared_target" || return 1
    /usr/sbin/nginx -t || return 1
  fi
  if [[ "$deploy_systemd" == true ]]; then
    install -o root -g root -m 0644 "$staged_root/portra-backend.service" \
      "${systemd_target}.next-$sha" || return 1
    mv -f "${systemd_target}.next-$sha" "$systemd_target" || return 1
    /usr/bin/systemctl daemon-reload || return 1
  fi
  [[ "$deploy_nginx" != true ]] || /usr/bin/systemctl reload nginx.service || return 1
  [[ "$deploy_systemd" != true ]] || /usr/bin/systemctl restart portra-backend.service || return 1
  acceptance_check || return 1
}

if ! apply_infra; then
  rollback_infra
  exit 1
fi

printf '%s\n' "$sha" > "$backup_root/installed-infra-commit.txt"
rm -rf -- "$validation_root"
echo "INFRA_DEPLOYMENT=PASS commit=$sha surfaces=$surfaces"
