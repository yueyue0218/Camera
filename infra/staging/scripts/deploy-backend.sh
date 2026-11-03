#!/usr/bin/env bash
set -euo pipefail
umask 027

# Backend-only Staging entry: no frontend/config/schema changes.
[[ "$#" -eq 7 ]] || { echo 'Expected SHA, JAR, three HTTPS URLs, reviewed Backend SHA and Web SHA' >&2; exit 2; }
sha="$1" source_jar="$2" health_url="$3" public_url="$4" expected_origin="$5"
expected_backend="$6" expected_frontend="$7"
for commit in "$sha" "$expected_backend" "$expected_frontend"; do
  [[ "$commit" =~ ^[0-9a-f]{40}$ ]] || { echo 'Full reviewed Git SHAs required' >&2; exit 2; }
done
for value in "$health_url" "$public_url" "$expected_origin"; do
  [[ "$value" =~ ^https://[A-Za-z0-9.:-]+(/[^[:space:]\']*)?$ ]] || exit 2
done
incoming_root="$(dirname -- "$source_jar")"
[[ "$source_jar" == "$incoming_root/portra-backend.jar" ]]
[[ "$incoming_root" == "/home/portra-deploy/incoming/$sha" ||
   "$incoming_root" =~ ^/home/portra-deploy/incoming/$sha/backend-only-[0-9]+-[0-9]+$ ]]
[[ -f "$source_jar" && ! -L "$source_jar" && -s "$source_jar" ]]
health_script="$incoming_root/infra/scripts/health-backend-staging.sh"
privacy_inspector="$incoming_root/infra/scripts/verify-privacy-jar.py"
for helper in "$health_script" "$privacy_inspector" "$incoming_root/infra/scripts/health-check.sh"; do
  [[ -f "$helper" && ! -L "$helper" ]]
done
command -v python3 >/dev/null || { echo 'Python 3 is required for privacy release inspection' >&2; exit 1; }

app_root=/opt/portra/app
release_root="$app_root/releases"
release_dir="$release_root/$sha"
state_root=/home/portra-deploy/state
frontend_current=/var/www/portra/current
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

install -d -m 700 "$state_root"
# Same path/inode as deploy-application.sh; held through acceptance and rollback.
exec 9>"$state_root/application-deploy.lock"
flock -n 9 || { echo 'Another Portra application deployment is running' >&2; exit 1; }

[[ -d "$release_root" && ! -L "$release_root" ]]
[[ "$(cat "$state_root/application-commit.txt")" == "$expected_backend" ]]
[[ "$(cat "$state_root/frontend-commit.txt")" == "$expected_frontend" ]]
[[ -L "$frontend_current" ]]
old_frontend="$(readlink -- "$frontend_current")"
grep -Fq "\"gitSha\":\"$expected_frontend\"" "$frontend_current/deployment.json"
[[ -L "$app_root/current" && -L /home/portra-deploy/current && -L "$app_root/app.jar" ]]
old_current="$(readlink -f -- "$app_root/current")"
[[ "$old_current" == "$release_root/"* && -d "$old_current" ]]
[[ "$(readlink -f -- /home/portra-deploy/current)" == "$old_current" ]]
[[ "$(readlink -f -- "$app_root/app.jar")" == "$old_current/portra-backend.jar" ]]
[[ "$(cat "$old_current/deployed-commit.txt")" == "$expected_backend" ]]
[[ -f "$old_current/portra-backend.jar" && ! -L "$old_current/portra-backend.jar" ]]
old_checksum="$(sha256sum "$old_current/portra-backend.jar" | awk '{print $1}')"
[[ "$(awk '{print $1}' "$old_current/portra-backend.jar.sha256")" == "$old_checksum" ]]
# This entry cannot perform the first privacy cutover: every failure must be
# able to recover to the exact, already privacy-aware starting current release.
python3 "$privacy_inspector" "$old_current/portra-backend.jar" || {
  echo 'PRIVACY_BASELINE_REQUIRED: refusing a pre-privacy starting release; separate cutover review required' >&2
  exit 1
}
bash "$health_script" "$health_url" "$public_url" "$expected_origin"

checksum_file="${source_jar}.sha256"
[[ -f "$checksum_file" && ! -L "$checksum_file" ]]
expected_checksum="$(awk '{print $1}' "$checksum_file")"
[[ "$expected_checksum" =~ ^[0-9a-f]{64}$ ]]
[[ "$(sha256sum "$source_jar" | awk '{print $1}')" == "$expected_checksum" ]] || {
  echo 'Uploaded JAR checksum mismatch' >&2; exit 1;
}
python3 "$privacy_inspector" "$source_jar" || {
  echo 'PRIVACY_TARGET_REQUIRED: target JAR lacks the reviewed privacy boundary' >&2
  exit 1
}

# Verify copied bytes before publishing the immutable release.
[[ ! -L "$release_dir" ]]
install -d -m 750 "$release_dir"
if [[ -e "$release_dir/portra-backend.jar" || -L "$release_dir/portra-backend.jar" ]]; then
  [[ -f "$release_dir/portra-backend.jar" && ! -L "$release_dir/portra-backend.jar" ]]
  [[ "$(sha256sum "$release_dir/portra-backend.jar" | awk '{print $1}')" == "$expected_checksum" ]]
  [[ "$(cat "$release_dir/deployed-commit.txt")" == "$sha" ]]
else
  candidate="$release_dir/portra-backend.jar.uploading.$$"
  cp -- "$source_jar" "$candidate"
  [[ "$(sha256sum "$candidate" | awk '{print $1}')" == "$expected_checksum" ]]
  chmod 0640 "$candidate"
  chgrp portra "$candidate"
  mv -T -- "$candidate" "$release_dir/portra-backend.jar"
  printf '%s\n' "$sha" > "$release_dir/deployed-commit.txt"
  printf '%s  portra-backend.jar\n' "$expected_checksum" > "$release_dir/portra-backend.jar.sha256"
  chmod 0640 "$release_dir/deployed-commit.txt" "$release_dir/portra-backend.jar.sha256"
  chgrp portra "$release_dir/deployed-commit.txt" "$release_dir/portra-backend.jar.sha256"
fi
echo "BACKEND_CANDIDATE=READY sha=$sha"

# Retrying the already-live release must not rotate previous to itself.
if [[ "$old_current" == "$release_dir" ]]; then
  bash "$health_script" "$health_url" "$public_url" "$expected_origin"
  echo "BACKEND_COMMIT=$sha FRONTEND_COMMIT=$expected_frontend ALREADY_CURRENT=true"
  exit 0
fi

# Preserve exact old bytes without writing to the old release.
backup_dir="$state_root/backend-backups/$old_checksum"
install -d -m 700 "$backup_dir"
if [[ ! -f "$backup_dir/portra-backend.jar" ]]; then
  cp -- "$old_current/portra-backend.jar" "$backup_dir/portra-backend.jar"
fi
[[ "$(sha256sum "$backup_dir/portra-backend.jar" | awk '{print $1}')" == "$old_checksum" ]]
printf '%s\n' "$old_current" > "$backup_dir/original-target.txt"
printf '%s\n' "$expected_backend" > "$backup_dir/deployed-commit.txt"
printf '%s  portra-backend.jar\n' "$old_checksum" > "$backup_dir/portra-backend.jar.sha256"
chmod 0600 "$backup_dir/"*

attempt_dir="$(mktemp -d "$state_root/.backend-attempt-$sha-XXXXXX")"
link_paths=("$app_root/current" /home/portra-deploy/current "$app_root/previous" /home/portra-deploy/previous "$app_root/app.jar")
old_links=()
for path in "${link_paths[@]}"; do
  if [[ -L "$path" ]]; then
    old_links+=("$(readlink -- "$path")")
  else
    [[ ! -e "$path" ]] # Refuse to replace unmanaged regular files/directories.
    old_links+=("")
  fi
done
state_names=(application-commit.txt application-jar.sha256 backend-state.env release-state.env)
for name in "${state_names[@]}"; do
  [[ ! -L "$state_root/$name" ]]
  if [[ -e "$state_root/$name" ]]; then
    [[ -f "$state_root/$name" ]]
    cp -p -- "$state_root/$name" "$attempt_dir/$name"
  fi
done

atomic_link() {
  local target="$1" path="$2" temp="${2}.next.$$"
  ln -s -- "$target" "$temp" || return 1
  if ! mv -Tf -- "$temp" "$path"; then
    rm -f -- "$temp"
    return 1
  fi
}
write_state() {
  local name="$1" value="$2" temp="$state_root/${1}.next.$$"
  printf '%s\n' "$value" > "$temp" || return 1
  chmod 0600 "$temp" || return 1
  mv -Tf -- "$temp" "$state_root/$name"
}
frontend_unchanged() {
  [[ "$(cat "$state_root/frontend-commit.txt")" == "$expected_frontend" &&
     "$(readlink -- "$frontend_current")" == "$old_frontend" ]] &&
    grep -Fq "\"gitSha\":\"$expected_frontend\"" "$frontend_current/deployment.json"
}
rollback() {
  local failed=false index name temp
  echo 'ROLLBACK=START' >&2
  [[ "$(sha256sum "$old_current/portra-backend.jar" | awk '{print $1}')" == "$old_checksum" ]] || return 1
  python3 "$privacy_inspector" "$old_current/portra-backend.jar" || return 1
  for index in "${!link_paths[@]}"; do
    if [[ -n "${old_links[$index]}" ]]; then
      atomic_link "${old_links[$index]}" "${link_paths[$index]}" || failed=true
    else
      rm -f -- "${link_paths[$index]}" || failed=true
    fi
  done
  for name in "${state_names[@]}"; do
    if [[ -f "$attempt_dir/$name" ]]; then
      temp="$state_root/$name.restore.$$"
      cp -p -- "$attempt_dir/$name" "$temp" && mv -Tf -- "$temp" "$state_root/$name" || failed=true
    else
      rm -f -- "$state_root/$name" || failed=true
    fi
  done
  [[ "$(readlink -f -- "$app_root/app.jar")" == "$old_current/portra-backend.jar" ]] || return 1
  sudo /usr/bin/systemctl restart portra-backend.service || failed=true
  sudo /usr/bin/systemctl is-active portra-backend.service || failed=true
  bash "$health_script" "$health_url" "$public_url" "$expected_origin" || failed=true
  frontend_unchanged || failed=true
  [[ "$failed" == false ]] || return 1
  echo 'ROLLBACK=PASS OLD_SERVICE_HEALTHY=true' >&2
}

transaction_started=false
committed=false
on_exit() {
  local status="$?"
  trap - EXIT INT TERM
  if [[ "$transaction_started" == true && "$committed" == false ]]; then
    status=1
    rollback || echo 'ROLLBACK=FAILED MANUAL_RECOVERY_REQUIRED=true' >&2
  fi
  # Failure snapshots remain for diagnosis. No release pruning during a switch.
  if [[ "$committed" == true ]]; then
    rm -f -- "$attempt_dir/"*
    rmdir -- "$attempt_dir"
  fi
  exit "$status"
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# The exit guard is active before the first live-link or state mutation.
transaction_started=true
atomic_link "$old_current" "$app_root/previous"
atomic_link "$old_current" /home/portra-deploy/previous
atomic_link "$release_dir" "$app_root/current"
atomic_link "$release_dir" /home/portra-deploy/current
atomic_link "$app_root/current/portra-backend.jar" "$app_root/app.jar"
sudo /usr/bin/systemctl restart portra-backend.service
sudo /usr/bin/systemctl is-active portra-backend.service
bash "$health_script" "$health_url" "$public_url" "$expected_origin"
[[ "$(readlink -f -- "$app_root/app.jar")" == "$release_dir/portra-backend.jar" ]]
frontend_unchanged
write_state application-commit.txt "$sha"
write_state application-jar.sha256 "$expected_checksum"
write_state backend-state.env "$(printf 'APPLICATION_COMMIT=%s\nFRONTEND_COMMIT=%s\nDEPLOYED_AT=%s\nJAR_SHA256=%s' "$sha" "$expected_frontend" "$timestamp" "$expected_checksum")"
write_state release-state.env "$(printf 'APPLICATION_COMMIT=%s\nFRONTEND_COMMIT=%s\nDEPLOYED_AT=%s\nDEPLOYMENT_MODE=backend-only' "$sha" "$expected_frontend" "$timestamp")"
committed=true
echo "DEPLOYED_COMMIT=$sha"
echo "BACKEND_COMMIT=$sha"
echo "FRONTEND_COMMIT=$expected_frontend"
