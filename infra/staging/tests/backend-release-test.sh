#!/usr/bin/env bash
# Local filesystem simulation; never touches server paths or invokes systemctl.
set -euo pipefail
case "$(uname -s)" in MINGW*|MSYS*) export MSYS=winsymlinks:sys ;; esac
repo="$(cd "$(dirname "$0")/../../.." && pwd)"
test_root="$(mktemp -d "$repo/output/release-script-test.XXXXXX")"
app="$test_root/app"
home_dir="$test_root/deployer"
mkdir -p "$app/releases/legacy" "$home_dir/state" "$home_dir/scripts/current" "$test_root/bin"
export RELEASE_TEST_LOG="$test_root/restarts.log"
export PATH="$test_root/bin:$PATH"
printf '#!/usr/bin/env bash\necho "$*" >> "$RELEASE_TEST_LOG"\n' > "$test_root/bin/sudo"
printf '#!/usr/bin/env bash\nexit 0\n' > "$test_root/bin/chgrp"
chmod +x "$test_root/bin/"*
# Windows filesystems do not implement Unix setgid permissions. Only emulate
# install -d on that platform; actual copies, hashes and link switching still run.
case "$(uname -s)" in
  MINGW*|MSYS*)
    printf '#!/usr/bin/env bash\n[[ "$1" == -d && "$2" == -m ]] || exit 2\nshift 3\nmkdir -p -- "$@"\n' > "$test_root/bin/install"
    chmod +x "$test_root/bin/install"
    ;;
esac
for script in deploy-backend rollback-backend; do
  sed -e "s|/opt/portra/app|$app|g" -e "s|/home/portra-deploy|$home_dir|g" \
    "$repo/infra/staging/scripts/$script.sh" > "$test_root/$script.sh"
  bash -n "$test_root/$script.sh"
done
printf old-artifact > "$app/releases/legacy/portra-backend.jar"
old_hash="$(sha256sum "$app/releases/legacy/portra-backend.jar" | awk '{print $1}')"
ln -s "$app/releases/legacy" "$app/current"
ln -s "$app/current/portra-backend.jar" "$app/app.jar"
sha=1111111111111111111111111111111111111111
incoming="$home_dir/incoming/$sha"
mkdir -p "$incoming/infra/scripts"
printf new-artifact > "$incoming/portra-backend.jar"
sha256sum "$incoming/portra-backend.jar" > "$incoming/portra-backend.jar.sha256"
printf '#!/usr/bin/env bash\nexit 0\n' > "$incoming/infra/scripts/health-check.sh"
cp "$incoming/infra/scripts/health-check.sh" "$home_dir/scripts/current/health-check.sh"
bash "$test_root/deploy-backend.sh" "$sha" "$incoming/portra-backend.jar" health public origin
[[ "$(readlink -f "$app/previous")" == "$app/releases/legacy" ]]
[[ "$(sha256sum "$home_dir/state/backend-backups/$old_hash/portra-backend.jar" | awk '{print $1}')" == "$old_hash" ]]
[[ "$(cat "$home_dir/state/backend-backups/$old_hash/deployed-commit.txt")" == UNKNOWN ]]
bash "$test_root/rollback-backend.sh" health public origin
[[ "$(readlink -f "$app/app.jar")" == "$app/releases/legacy/portra-backend.jar" ]]
[[ "$(cat "$home_dir/state/application-commit.txt")" == UNKNOWN ]]
[[ "$(cat "$home_dir/state/application-jar.sha256")" == "$old_hash" ]]
echo 'PASS: legacy backup and rollback without commit metadata'
# Corruption must fail before any link switch or restart.
printf corrupt >> "$app/previous/portra-backend.jar"
before="$(wc -l < "$RELEASE_TEST_LOG")"
if bash "$test_root/rollback-backend.sh" health public origin; then exit 1; fi
[[ "$(wc -l < "$RELEASE_TEST_LOG")" == "$before" ]]
[[ "$(readlink -f "$app/current")" == "$app/releases/legacy" ]]
echo 'PASS: corrupt rollback refused before mutation'
# Failed candidate health check restores the original bytes.
sha=2222222222222222222222222222222222222222
incoming="$home_dir/incoming/$sha"
mkdir -p "$incoming/infra/scripts"
printf bad-new-artifact > "$incoming/portra-backend.jar"
sha256sum "$incoming/portra-backend.jar" > "$incoming/portra-backend.jar.sha256"
printf '#!/usr/bin/env bash\nexit 1\n' > "$incoming/infra/scripts/health-check.sh"
if bash "$test_root/deploy-backend.sh" "$sha" "$incoming/portra-backend.jar" health public origin; then exit 1; fi
[[ "$(readlink -f "$app/current")" == "$app/releases/legacy" ]]
[[ "$(sha256sum "$app/app.jar" | awk '{print $1}')" == "$old_hash" ]]
echo 'PASS: failed deployment restores original JAR'
echo "Evidence: $test_root"
