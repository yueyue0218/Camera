#!/usr/bin/env bash
set -euo pipefail

sha="${1:?full Git SHA is required}"
source_jar="${2:?uploaded JAR path is required}"
health_url="${3:?health URL is required}"
public_url="${4:?public URL is required}"
expected_origin="${5:?expected origin is required}"

[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid Git SHA" >&2; exit 2; }
[[ "$source_jar" == "/home/portra-deploy/incoming/$sha/portra-backend.jar" ]]
[[ -f "$source_jar" && ! -L "$source_jar" ]]

app_root=/opt/portra/app
release_root="$app_root/releases"
release_dir="$release_root/$sha"
state_root=/home/portra-deploy/state
health_script="/home/portra-deploy/incoming/$sha/infra/scripts/health-check.sh"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

install -d -m 2750 "$release_root"
install -d -m 700 "$state_root"
install -d -m 750 "$release_dir"

expected_checksum_file="${source_jar}.sha256"
if [[ -f "$expected_checksum_file" ]]; then
  expected_checksum="$(awk '{print $1}' "$expected_checksum_file")"
  [[ "$expected_checksum" =~ ^[0-9a-f]{64}$ ]]
  actual_checksum="$(sha256sum "$source_jar" | awk '{print $1}')"
  [[ "$actual_checksum" == "$expected_checksum" ]] || {
    echo "Uploaded JAR checksum mismatch" >&2
    exit 1
  }
fi

if [[ -f "$release_dir/portra-backend.jar" ]]; then
  [[ "$(sha256sum "$release_dir/portra-backend.jar" | awk '{print $1}')" == \
      "$(sha256sum "$source_jar" | awk '{print $1}')" ]] || {
    echo "Release SHA already exists with a different artifact" >&2
    exit 1
  }
else
  cp -- "$source_jar" "$release_dir/portra-backend.jar.uploading"
  chmod 0640 "$release_dir/portra-backend.jar.uploading"
  chgrp portra "$release_dir/portra-backend.jar.uploading"
  mv -f -- "$release_dir/portra-backend.jar.uploading" "$release_dir/portra-backend.jar"
fi
printf '%s\n' "$sha" > "$release_dir/deployed-commit.txt"
sha256sum "$release_dir/portra-backend.jar" > "$release_dir/portra-backend.jar.sha256"
chmod 0640 "$release_dir/deployed-commit.txt" "$release_dir/portra-backend.jar.sha256"
chgrp portra "$release_dir/deployed-commit.txt" "$release_dir/portra-backend.jar.sha256"

atomic_link() {
  local target="$1"
  local link_path="$2"
  local temp_link="${link_path}.next.$$"
  ln -s -- "$target" "$temp_link"
  mv -Tf -- "$temp_link" "$link_path"
}

previous_target=""
if [[ -L "$app_root/current" ]]; then
  current_target="$(readlink -f "$app_root/current")"
  if [[ "$current_target" == "$release_dir" && -L "$app_root/previous" ]]; then
    previous_target="$(readlink -f "$app_root/previous")"
  else
    previous_target="$current_target"
  fi
elif [[ -f "$app_root/app.jar" && ! -L "$app_root/app.jar" ]]; then
  legacy_dir="$release_root/legacy-$timestamp"
  install -d -m 750 "$legacy_dir"
  cp -- "$app_root/app.jar" "$legacy_dir/portra-backend.jar"
  chmod 0640 "$legacy_dir/portra-backend.jar"
  chgrp portra "$legacy_dir/portra-backend.jar"
  printf 'UNKNOWN\n' > "$legacy_dir/deployed-commit.txt"
  previous_target="$legacy_dir"
fi

if [[ -n "$previous_target" && "$previous_target" == "$release_root/"* ]]; then
  atomic_link "$previous_target" "$app_root/previous"
  atomic_link "$previous_target" /home/portra-deploy/previous
fi

if [[ -f "$app_root/app.jar" && ! -L "$app_root/app.jar" ]]; then
  mv -- "$app_root/app.jar" "$app_root/app.jar.before-release-$timestamp"
fi
atomic_link "$release_dir" "$app_root/current"
atomic_link "$release_dir" /home/portra-deploy/current
if [[ ! -L "$app_root/app.jar" ]]; then
  ln -s "$app_root/current/portra-backend.jar" "$app_root/app.jar"
fi

rollback() {
  if [[ -z "$previous_target" || "$previous_target" != "$release_root/"* ]]; then
    echo "No managed previous release is available" >&2
    return 1
  fi
  atomic_link "$previous_target" "$app_root/current"
  atomic_link "$previous_target" /home/portra-deploy/current
  sudo /usr/bin/systemctl restart portra-backend.service
  sudo /usr/bin/systemctl is-active portra-backend.service
  bash "$health_script" "$health_url" "$public_url" "$expected_origin"
  previous_commit="$(cat "$previous_target/deployed-commit.txt" 2>/dev/null || printf 'UNKNOWN')"
  printf '%s\n' "$previous_commit" > "$state_root/application-commit.txt"
}

if ! sudo /usr/bin/systemctl restart portra-backend.service \
  || ! sudo /usr/bin/systemctl is-active portra-backend.service \
  || ! bash "$health_script" "$health_url" "$public_url" "$expected_origin"; then
  echo "New backend release failed acceptance; restoring previous release" >&2
  rollback
  exit 1
fi

printf '%s\n' "$sha" > "$state_root/application-commit.txt"
printf 'APPLICATION_COMMIT=%s\nDEPLOYED_AT=%s\n' "$sha" "$timestamp" \
  > "$state_root/backend-state.env"
chmod 0600 "$state_root/application-commit.txt" "$state_root/backend-state.env"

current_real="$(readlink -f "$app_root/current")"
previous_real="$(readlink -f "$app_root/previous" 2>/dev/null || true)"
mapfile -t managed_releases < <(
  find "$release_root" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' |
    while read -r modified candidate; do
      release_name="${candidate##*/}"
      [[ "$release_name" =~ ^[0-9a-f]{40}$ ]] || continue
      printf '%s %s\n' "$modified" "$candidate"
    done |
    sort -nr |
    cut -d' ' -f2-
)
for ((index = 7; index < ${#managed_releases[@]}; index++)); do
  candidate="${managed_releases[$index]}"
  [[ "$candidate" == "$release_root/"* ]]
  [[ "$candidate" != "$current_real" && "$candidate" != "$previous_real" ]] || continue
  rm -rf -- "$candidate"
done

echo "DEPLOYED_COMMIT=$sha"
