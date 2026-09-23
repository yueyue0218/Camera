#!/usr/bin/env bash
set -euo pipefail

health_url="${1:?health URL is required}"
public_url="${2:?public URL is required}"
expected_origin="${3:?expected origin is required}"
app_root=/opt/portra/app
release_root="$app_root/releases"
state_root=/home/portra-deploy/state
health_script=/home/portra-deploy/scripts/current/health-check.sh

[[ -L "$app_root/current" && -L "$app_root/previous" ]]
current_target="$(readlink -f "$app_root/current")"
previous_target="$(readlink -f "$app_root/previous")"
[[ "$current_target" == "$release_root/"* && "$previous_target" == "$release_root/"* ]]

atomic_link() {
  local target="$1"
  local link_path="$2"
  local temp_link="${link_path}.next.$$"
  ln -s -- "$target" "$temp_link"
  mv -Tf -- "$temp_link" "$link_path"
}

atomic_link "$previous_target" "$app_root/current"
atomic_link "$current_target" "$app_root/previous"
atomic_link "$previous_target" /home/portra-deploy/current
atomic_link "$current_target" /home/portra-deploy/previous

sudo /usr/bin/systemctl restart portra-backend.service
sudo /usr/bin/systemctl is-active portra-backend.service
bash "$health_script" "$health_url" "$public_url" "$expected_origin"

previous_commit="$(cat "$previous_target/deployed-commit.txt")"
printf '%s\n' "$previous_commit" > "$state_root/application-commit.txt"
chmod 0600 "$state_root/application-commit.txt"
echo "ROLLED_BACK_TO=$previous_commit"
