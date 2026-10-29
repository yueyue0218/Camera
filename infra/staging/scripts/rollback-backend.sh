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

# Validate everything before changing links or restarting the service.
[[ -f "$health_script" && -f "$previous_target/portra-backend.jar" ]]
[[ -f "$previous_target/portra-backend.jar.sha256" ]] || {
  echo "Previous checksum missing; verify and prepare legacy backup before rollback" >&2; exit 1;
}
previous_checksum="$(awk '{print $1}' "$previous_target/portra-backend.jar.sha256")"
[[ "$previous_checksum" =~ ^[0-9a-f]{64}$ ]]
[[ "$(sha256sum "$previous_target/portra-backend.jar" | awk '{print $1}')" == "$previous_checksum" ]] || {
  echo "Previous JAR checksum mismatch" >&2; exit 1;
}
previous_commit="$(cat "$previous_target/deployed-commit.txt" 2>/dev/null || printf 'UNKNOWN')"
[[ "$previous_commit" =~ ^[0-9a-f]{40}$ || "$previous_commit" == UNKNOWN ]]
[[ -d "$state_root" && -w "$state_root" ]]

atomic_link "$previous_target" "$app_root/current"
atomic_link "$current_target" "$app_root/previous"
atomic_link "$previous_target" /home/portra-deploy/current
atomic_link "$current_target" /home/portra-deploy/previous

atomic_link "$app_root/current/portra-backend.jar" "$app_root/app.jar"

sudo /usr/bin/systemctl restart portra-backend.service
sudo /usr/bin/systemctl is-active portra-backend.service
bash "$health_script" "$health_url" "$public_url" "$expected_origin"

printf '%s\n' "$previous_checksum" > "$state_root/application-jar.sha256"
printf '%s\n' "$previous_commit" > "$state_root/application-commit.txt"
printf 'APPLICATION_COMMIT=%s\nJAR_SHA256=%s\n' "$previous_commit" "$previous_checksum" > "$state_root/backend-state.env"
chmod 0600 "$state_root/application-commit.txt" "$state_root/application-jar.sha256" "$state_root/backend-state.env"
echo "ROLLED_BACK_TO=$previous_commit JAR_SHA256=$previous_checksum"
