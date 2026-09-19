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

if grep -Eq 'NOPASSWD:[[:space:]]*ALL|StrictHostKeyChecking[=[:space:]]*no' \
  "$infra_root/sudoers/portra-deploy" "$repo_root/.github/workflows/deploy.yml"; then
  echo "Unsafe sudo or SSH policy detected" >&2
  exit 1
fi

if command -v visudo >/dev/null 2>&1; then
  visudo -cf "$infra_root/sudoers/portra-deploy"
fi

echo "REPOSITORY_INFRA_VALIDATION=PASS"
