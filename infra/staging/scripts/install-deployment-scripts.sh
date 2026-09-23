#!/usr/bin/env bash
set -euo pipefail

sha="${1:?full Git SHA is required}"
source_dir="${2:?source scripts directory is required}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$source_dir" == "/home/portra-deploy/incoming/$sha/infra/scripts" ]]
[[ -d "$source_dir" && ! -L "$source_dir" ]]

root=/home/portra-deploy/scripts
release="$root/releases/$sha"
install -d -m 700 "$root/releases"
install -d -m 700 "$release"

for name in health-check.sh deploy-backend.sh rollback-backend.sh \
  install-deployment-scripts.sh; do
  [[ -f "$source_dir/$name" && ! -L "$source_dir/$name" ]]
  install -m 0750 "$source_dir/$name" "$release/$name"
done

temp_link="$root/current.next.$$"
ln -s "$release" "$temp_link"
mv -Tf "$temp_link" "$root/current"
printf '%s\n' "$sha" > "$release/deployed-commit.txt"
chmod 0600 "$release/deployed-commit.txt"
echo "DEPLOYMENT_SCRIPTS_COMMIT=$sha"
