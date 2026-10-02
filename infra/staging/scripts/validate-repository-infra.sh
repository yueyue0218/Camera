#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
infra_root="$repo_root/infra/staging"

required=(
  "$infra_root/nginx/portra-ssl.conf"
  "$infra_root/nginx/portra.conf"
  "$infra_root/systemd/portra-backend.service"
  "$infra_root/sudoers/portra-deploy"
  "$infra_root/scripts/health-check.sh"
  "$infra_root/scripts/deploy-application.sh"
  "$infra_root/scripts/bootstrap-frontend-release-root.sh"
  "$infra_root/scripts/deploy-backend.sh"
  "$infra_root/scripts/rollback-backend.sh"
  "$infra_root/scripts/deploy-infra-root.sh"
)
for path in "${required[@]}"; do
  [[ -f "$path" ]] || { echo "Missing canonical infra file: $path" >&2; exit 1; }
done

for script in "$infra_root"/scripts/*.sh; do
  bash -n "$script"
done

grep -Fq 'proxy_pass http://127.0.0.1:8080;' "$infra_root/nginx/portra.conf"
grep -Fq 'EnvironmentFile=/etc/portra/portra.env' "$infra_root/systemd/portra-backend.service"
grep -Fq 'ExecStart=/usr/bin/java -jar /opt/portra/app/app.jar' \
  "$infra_root/systemd/portra-backend.service"

deploy_workflow="$repo_root/.github/workflows/deploy.yml"
ci_workflow="$repo_root/.github/workflows/ci.yml"
application_deploy="$infra_root/scripts/deploy-application.sh"
frontend_bootstrap="$infra_root/scripts/bootstrap-frontend-release-root.sh"
grep -Fq 'ref: ${{ github.sha }}' "$deploy_workflow"
grep -Fq 'npm run build:temp-staging' "$deploy_workflow"
grep -Fq 'deploy-application.sh' "$deploy_workflow"
grep -Fq 'portra-frontend-$TARGET_SHA.tar.gz' "$deploy_workflow"
grep -Fq 'uses: ./.github/workflows/deploy.yml' "$ci_workflow"
grep -Fq "github.event_name == 'push' && github.ref == 'refs/heads/main'" "$ci_workflow"
for expected in \
  'FRONTEND_ROOT=/var/www/portra' \
  'FRONTEND_RELEASE_ROOT=/var/www/portra/releases' \
  'FRONTEND_CURRENT=/var/www/portra/current' \
  'FRONTEND_LIVE_ENTRY=/var/www/dist'; do
  grep -Fqx "$expected" "$application_deploy"
done
grep -Fq 'mktemp -d "$FRONTEND_RELEASE_ROOT/.candidate-$sha-XXXXXX"' "$application_deploy"
grep -Fq 'atomic_frontend_switch "releases/$sha"' "$application_deploy"
grep -Fq '[[ "$(readlink -- "$FRONTEND_LIVE_ENTRY")" == "$FRONTEND_CURRENT" ]]' \
  "$application_deploy"

if grep -Eq '/var/www/dist\.(new|rollback|failed)-' "$application_deploy"; then
  echo "Legacy frontend sibling-directory strategy detected" >&2
  exit 1
fi
if grep -E '^[[:space:]]*mv([[:space:]]|$)' "$application_deploy" | \
    grep -Eq '(/var/www/dist|\$FRONTEND_LIVE_ENTRY)'; then
  echo "Normal application deployment must never move /var/www/dist" >&2
  exit 1
fi
if grep -Eq 'nginx[[:space:]]+.*-t([[:space:]]|$)' "$application_deploy"; then
  echo "Normal application deployment must not validate privileged Nginx configuration" >&2
  exit 1
fi

for expected in \
  'readonly LIVE_ENTRY=/var/www/dist' \
  'readonly FRONTEND_ROOT=/var/www/portra' \
  'readonly RELEASE_ROOT=/var/www/portra/releases' \
  'readonly CURRENT=/var/www/portra/current' \
  'readonly DEPLOY_USER=portra-deploy' \
  'readonly DEPLOY_GROUP=portra-deploy'; do
  grep -Fqx "$expected" "$frontend_bootstrap"
done
grep -Fq '[[ "$(id -u)" -eq 0 ]]' "$frontend_bootstrap"
grep -Fq '[[ "$#" -eq 0 ]]' "$frontend_bootstrap"
if grep -Eq 'NOPASSWD|sudoers|portra-deploy-infra|/home/portra-deploy/incoming' \
    "$frontend_bootstrap"; then
  echo "Frontend bootstrap must not broaden or reuse the privileged deployment boundary" >&2
  exit 1
fi

helper="$infra_root/scripts/deploy-infra-root.sh"
grep -Fq 'trusted_repository_url=https://github.com/yueyue0218/Camera.git' "$helper"
grep -Fq '[[ "$sha" == "$trusted_head" ]]' "$helper"
grep -Fq 'Systemd unit violates the approved semantic allowlist' "$helper"
if grep -Fq '/home/portra-deploy/incoming' "$helper"; then
  echo "Privileged helper must not trust the deploy-user incoming directory" >&2
  exit 1
fi

assert_approved_hash() {
  local variable_name="$1" file_path="$2" expected actual
  expected="$(sed -n "s/^readonly ${variable_name}=//p" "$helper")"
  actual="$(sha256sum "$file_path" | awk '{print $1}')"
  [[ "$expected" =~ ^[0-9a-f]{64}$ && "$actual" == "$expected" ]] || {
    echo "Approved root-loaded hash mismatch for $file_path" >&2
    exit 1
  }
}

assert_approved_hash approved_nginx_ssl_sha256 "$infra_root/nginx/portra-ssl.conf"
assert_approved_hash approved_nginx_shared_sha256 "$infra_root/nginx/portra.conf"
assert_approved_hash approved_systemd_sha256 "$infra_root/systemd/portra-backend.service"

if grep -Eq 'NOPASSWD:[[:space:]]*ALL|StrictHostKeyChecking[=[:space:]]*no' \
  "$infra_root/sudoers/portra-deploy" "$repo_root/.github/workflows/deploy.yml"; then
  echo "Unsafe sudo or SSH policy detected" >&2
  exit 1
fi

for surface in nginx systemd all; do
  grep -Fqx "portra-deploy ALL=(root) NOPASSWD: /usr/local/sbin/portra-deploy-infra * $surface" \
    "$infra_root/sudoers/portra-deploy"
done
if grep -Eq 'NOPASSWD:.*(sudo|/bin/(ba)?sh|/usr/bin/(ba)?sh|/bin/(cp|mv)|/usr/bin/(cp|mv)|systemctl[[:space:]]+\*)' \
  "$infra_root/sudoers/portra-deploy"; then
  echo "Over-broad privileged command detected" >&2
  exit 1
fi

if command -v visudo >/dev/null 2>&1; then
  visudo -cf "$infra_root/sudoers/portra-deploy"
fi

echo "REPOSITORY_INFRA_VALIDATION=PASS"
