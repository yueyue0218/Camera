#!/usr/bin/env bash
set -euo pipefail
umask 077
export PATH=/usr/sbin:/usr/bin:/sbin:/bin

[[ "$#" -eq 2 ]] || {
  echo "Usage: portra-deploy-infra <full-main-commit-sha> <nginx|systemd|all>" >&2
  exit 2
}

sha="$1"
surface="$2"

[[ "$EUID" -eq 0 ]] || { echo "This helper must run as root" >&2; exit 2; }
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid Git SHA" >&2; exit 2; }
[[ "$surface" == nginx || "$surface" == systemd || "$surface" == all ]] || {
  echo "Invalid deployment surface" >&2
  exit 2
}

readonly trusted_repository_url=https://github.com/yueyue0218/Camera.git
readonly trusted_main_ref=refs/heads/portra-trusted-main
readonly trusted_repository=/opt/portra/deploy/trusted-repository.git
readonly deploy_root=/opt/portra/deploy
readonly work_parent=/opt/portra/deploy/work
readonly health_url='https://47.76.106.57/service-packages?page=1&size=1'
readonly public_url='https://47.76.106.57/'
readonly expected_origin='https://47.76.106.57'

# These hashes approve the complete canonical bytes. Changing any root-loaded file
# requires a reviewed helper update and a new administrator bootstrap.
readonly approved_nginx_ssl_sha256=f2fadf7671e24ef37feb20e3d2829abb3c2d821d290a23ac5c3cac8ec9d97d98
readonly approved_nginx_shared_sha256=668e5a8ff29398265d802a16de78e4efaf3ee8084b880f417a7af16e52fc871c
readonly approved_systemd_sha256=24d558f6026f513013f668fb6ec93040046046b13901b19c0aab840464a34a70

readonly nginx_ssl_target=/etc/nginx/conf.d/portra-ssl.conf
readonly nginx_shared_target=/etc/nginx/default.d/portra.conf
readonly systemd_target=/etc/systemd/system/portra-backend.service

for command_path in /usr/bin/env /usr/bin/git /usr/bin/sha256sum /usr/bin/systemctl \
  /usr/bin/systemd-analyze /usr/bin/flock /usr/bin/cmp /usr/bin/grep \
  /usr/bin/sed /usr/bin/curl /usr/bin/mktemp /usr/bin/readlink /usr/bin/stat \
  /usr/bin/install /usr/bin/chmod /usr/bin/awk /usr/bin/cp /usr/bin/mv \
  /usr/bin/rm /usr/bin/date /usr/bin/sleep /usr/sbin/nginx; do
  [[ -x "$command_path" ]] || { echo "Missing required command: $command_path" >&2; exit 1; }
done

exec 9>/run/lock/portra-infra-deploy.lock
/usr/bin/flock -n 9 || { echo "Another Portra infrastructure deployment is running" >&2; exit 1; }

assert_root_directory() {
  local directory="$1"
  [[ -d "$directory" && ! -L "$directory" ]]
  [[ "$(/usr/bin/readlink -f -- "$directory")" == "$directory" ]]
  [[ "$(/usr/bin/stat -c '%U:%G' -- "$directory")" == root:root ]]
}

assert_root_directory /opt
if [[ ! -e /opt/portra ]]; then
  /usr/bin/install -d -o root -g root -m 0755 /opt/portra
fi
assert_root_directory /opt/portra
if [[ ! -e "$deploy_root" ]]; then
  /usr/bin/install -d -o root -g root -m 0755 "$deploy_root"
fi
assert_root_directory "$deploy_root"
/usr/bin/chmod 0755 "$deploy_root"
/usr/bin/install -d -o root -g root -m 0700 "$work_parent"
assert_root_directory "$work_parent"

if [[ ! -e "$trusted_repository" ]]; then
  /usr/bin/git init --bare "$trusted_repository" >/dev/null
fi
[[ -d "$trusted_repository" && ! -L "$trusted_repository" ]]
[[ "$(/usr/bin/readlink -f -- "$trusted_repository")" == "$trusted_repository" ]]
[[ "$(/usr/bin/stat -c '%U:%G' -- "$trusted_repository")" == root:root ]]
/usr/bin/chmod 0700 "$trusted_repository"

trusted_git() {
  /usr/bin/env -i \
    PATH=/usr/bin:/bin \
    HOME=/root \
    GIT_CONFIG_NOSYSTEM=1 \
    GIT_CONFIG_GLOBAL=/dev/null \
    GIT_TERMINAL_PROMPT=0 \
    /usr/bin/git --git-dir="$trusted_repository" "$@"
}

# Trust chain: fixed HTTPS repository -> freshly fetched main -> exact head SHA.
# No manifest or configuration supplied by portra-deploy participates in this step.
trusted_git -c protocol.file.allow=never -c protocol.ext.allow=never \
  fetch --force --no-tags --prune "$trusted_repository_url" \
  "+refs/heads/main:$trusted_main_ref"
trusted_head="$(trusted_git rev-parse "$trusted_main_ref^{commit}")"
[[ "$sha" == "$trusted_head" ]] || {
  echo "Refusing infrastructure commit that is not the current trusted main head" >&2
  echo "requested=$sha trusted_main=$trusted_head" >&2
  exit 1
}
trusted_git cat-file -e "$sha^{commit}"

work_root="$(/usr/bin/mktemp -d "$work_parent/$sha.XXXXXX")"
trap '/usr/bin/rm -rf -- "$work_root"' EXIT
staged_root="$work_root/trusted"
validation_root="$work_root/validation"
install -d -o root -g root -m 0700 "$staged_root" "$validation_root"

export_trusted_file() {
  local repository_path="$1"
  local destination="$2"
  local approved_hash="$3"
  local actual_hash

  trusted_git show "$sha:$repository_path" > "$destination"
  /usr/bin/chmod 0600 "$destination"
  actual_hash="$(/usr/bin/sha256sum "$destination" | /usr/bin/awk '{print $1}')"
  [[ "$actual_hash" == "$approved_hash" ]] || {
    echo "Root-loaded canonical file is not approved: $repository_path" >&2
    echo "expected=$approved_hash actual=$actual_hash" >&2
    exit 1
  }
}

deploy_nginx=false
deploy_systemd=false
[[ "$surface" == nginx || "$surface" == all ]] && deploy_nginx=true
[[ "$surface" == systemd || "$surface" == all ]] && deploy_systemd=true

if [[ "$deploy_nginx" == true ]]; then
  export_trusted_file infra/staging/nginx/portra-ssl.conf \
    "$staged_root/portra-ssl.conf" "$approved_nginx_ssl_sha256"
  export_trusted_file infra/staging/nginx/portra.conf \
    "$staged_root/portra.conf" "$approved_nginx_shared_sha256"
fi
if [[ "$deploy_systemd" == true ]]; then
  export_trusted_file infra/staging/systemd/portra-backend.service \
    "$staged_root/portra-backend.service" "$approved_systemd_sha256"
fi

validate_systemd_security_model() {
  local normalized="$validation_root/systemd.normalized"
  local approved="$validation_root/systemd.approved"

  /usr/bin/grep -Ev '^[[:space:]]*(#|$)' "$staged_root/portra-backend.service" > "$normalized"
  cat > "$approved" <<'EOF'
[Unit]
Description=Portra Spring Boot Backend
After=network.target mysqld.service
Requires=mysqld.service
[Service]
Type=simple
User=portra
Group=portra
WorkingDirectory=/opt/portra/app
EnvironmentFile=/etc/portra/portra.env
ExecStart=/usr/bin/java -jar /opt/portra/app/app.jar --server.address=127.0.0.1 --server.port=8080
Restart=on-failure
RestartSec=5
SuccessExitStatus=143
[Install]
WantedBy=multi-user.target
EOF
  /usr/bin/cmp -s "$approved" "$normalized" || {
    echo "Systemd unit violates the approved semantic allowlist" >&2
    exit 1
  }
  /usr/bin/systemd-analyze verify "$staged_root/portra-backend.service"
}

validate_nginx_candidate() {
  local validation_ssl="$validation_root/portra-ssl.conf"
  /usr/bin/sed "s|include /etc/nginx/default.d/portra.conf;|include $staged_root/portra.conf;|" \
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
  body="$(/usr/bin/mktemp "$work_root/health.XXXXXX")"
  headers="$(/usr/bin/mktemp "$work_root/headers.XXXXXX")"
  for attempt in {1..12}; do
    health_status="$(/usr/bin/curl --silent --show-error --max-time 10 --output "$body" \
      --write-out '%{http_code}' "$health_url" || true)"
    public_status="$(/usr/bin/curl --silent --show-error --max-time 10 --output /dev/null \
      --write-out '%{http_code}' "$public_url" || true)"
    cors_status="$(/usr/bin/curl --silent --show-error --max-time 10 --request OPTIONS \
      --output /dev/null --dump-header "$headers" \
      --header "Origin: $expected_origin" \
      --header 'Access-Control-Request-Method: POST' \
      --header 'Access-Control-Request-Headers: authorization,content-type' \
      --write-out '%{http_code}' "${expected_origin}/auth/refresh" || true)"
    if [[ "$health_status" == 200 ]] \
      && /usr/bin/grep -Eq '"code"[[:space:]]*:[[:space:]]*200' "$body" \
      && [[ "$public_status" == 200 && "$cors_status" == 200 ]] \
      && /usr/bin/grep -Fqi "Access-Control-Allow-Origin: $expected_origin" "$headers" \
      && /usr/bin/grep -Fqi 'Access-Control-Allow-Credentials: true' "$headers" \
      && /usr/bin/grep -Eqi '^Access-Control-Allow-Headers:.*authorization' "$headers"; then
      return 0
    fi
    /usr/bin/sleep 5
  done
  return 1
}

if [[ "$deploy_nginx" == true ]]; then
  /usr/sbin/nginx -t
  validate_nginx_candidate
fi
if [[ "$deploy_systemd" == true ]]; then
  validate_systemd_security_model
fi

timestamp="$(/usr/bin/date -u +%Y%m%dT%H%M%SZ)"
backup_root="/opt/portra/backups/infra/$timestamp-$sha"
install -d -o root -g root -m 0750 "$backup_root"
if [[ "$deploy_nginx" == true ]]; then
  install -d -o root -g root -m 0750 "$backup_root/nginx"
  cp -a "$nginx_ssl_target" "$backup_root/nginx/portra-ssl.conf"
  cp -a "$nginx_shared_target" "$backup_root/nginx/portra.conf"
fi
if [[ "$deploy_systemd" == true ]]; then
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

printf '%s\n' "$sha" > "$work_root/infra-commit.txt"
install -o root -g root -m 0644 "$work_root/infra-commit.txt" \
  "$deploy_root/infra-commit.txt.next"
mv -f "$deploy_root/infra-commit.txt.next" "$deploy_root/infra-commit.txt"
printf 'INFRA_COMMIT=%s\nSURFACE=%s\nDEPLOYED_AT=%s\n' "$sha" "$surface" "$timestamp" \
  > "$backup_root/installed-infra-state.env"
/usr/bin/chmod 0640 "$backup_root/installed-infra-state.env"

echo "INFRA_DEPLOYMENT=PASS commit=$sha surface=$surface provenance=trusted-main"
