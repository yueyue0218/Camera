#!/usr/bin/env bash
set -euo pipefail
umask 027

sha="${1:?full Git SHA is required}"
source_jar="${2:?uploaded backend JAR path is required}"
source_frontend="${3:?uploaded frontend archive path is required}"
health_url="${4:?health URL is required}"
public_url="${5:?public URL is required}"
expected_origin="${6:?expected origin is required}"

[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid Git SHA" >&2; exit 2; }
incoming_root="/home/portra-deploy/incoming/$sha"
[[ "$source_jar" == "$incoming_root/portra-backend-$sha.jar" ]]
[[ "$source_frontend" == "$incoming_root/portra-frontend-$sha.tar.gz" ]]
[[ -f "$source_jar" && ! -L "$source_jar" && -s "$source_jar" ]]
[[ -f "$source_frontend" && ! -L "$source_frontend" && -s "$source_frontend" ]]

for value in "$health_url" "$public_url" "$expected_origin"; do
  [[ "$value" =~ ^https://[A-Za-z0-9.:-]+(/[^[:space:]\']*)?$ ]] || {
    echo "Refusing non-HTTPS or malformed acceptance URL" >&2
    exit 2
  }
done

app_root=/opt/portra/app
release_root="$app_root/releases"
release_dir="$release_root/$sha"
frontend_live=/var/www/dist
frontend_candidate="/var/www/dist.new-$sha"
backup_root=/home/portra-deploy/backups/frontend
state_root=/home/portra-deploy/state
health_script="$incoming_root/infra/scripts/health-check.sh"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
frontend_backup="$backup_root/$timestamp-before-$sha"
frontend_old="/var/www/dist.rollback-$sha-$$"
frontend_failed="/var/www/dist.failed-$sha-$$"
application_state="$state_root/application-commit.txt"
frontend_state="$state_root/frontend-commit.txt"
release_state="$state_root/release-state.env"

install -d -m 700 "$state_root"
exec 9>"$state_root/application-deploy.lock"
flock -n 9 || { echo "Another Portra application deployment is running" >&2; exit 1; }

verify_checksum() {
  local artifact="$1" checksum_file="${1}.sha256" expected actual
  [[ -f "$checksum_file" && ! -L "$checksum_file" ]]
  expected="$(awk '{print $1}' "$checksum_file")"
  [[ "$expected" =~ ^[0-9a-f]{64}$ ]]
  actual="$(sha256sum "$artifact" | awk '{print $1}')"
  [[ "$actual" == "$expected" ]] || {
    echo "Uploaded artifact checksum mismatch: ${artifact##*/}" >&2
    exit 1
  }
}

atomic_link() {
  local target="$1" link_path="$2" temp_link="${2}.next.$$"
  ln -s -- "$target" "$temp_link"
  mv -Tf -- "$temp_link" "$link_path"
}

verify_checksum "$source_jar"
verify_checksum "$source_frontend"
[[ -x "$health_script" || -f "$health_script" ]]

# Prepare and validate the immutable backend release without touching current.
install -d -m 2750 "$release_root"
install -d -m 750 "$release_dir"
if [[ -f "$release_dir/portra-backend.jar" ]]; then
  [[ "$(sha256sum "$release_dir/portra-backend.jar" | awk '{print $1}')" == \
      "$(sha256sum "$source_jar" | awk '{print $1}')" ]] || {
    echo "Backend release SHA already exists with a different artifact" >&2
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

[[ -L "$app_root/current" ]]
current_backend="$(readlink -f "$app_root/current")"
previous_backend="$current_backend"
if [[ "$current_backend" == "$release_dir" && -L "$app_root/previous" ]]; then
  previous_backend="$(readlink -f "$app_root/previous")"
fi
[[ "$previous_backend" == "$release_root/"* && -f "$previous_backend/portra-backend.jar" ]]
old_previous_app_present=false
old_previous_app_target=""
if [[ -L "$app_root/previous" ]]; then
  old_previous_app_present=true
  old_previous_app_target="$(readlink -f "$app_root/previous")"
  [[ "$old_previous_app_target" == "$release_root/"* ]]
fi
old_previous_human_present=false
old_previous_human_target=""
if [[ -L /home/portra-deploy/previous ]]; then
  old_previous_human_present=true
  old_previous_human_target="$(readlink -f /home/portra-deploy/previous)"
  [[ "$old_previous_human_target" == "$release_root/"* ]]
fi
if [[ -e "$app_root/app.jar" && ! -L "$app_root/app.jar" ]]; then
  echo "$app_root/app.jar must be the managed current-release symlink" >&2
  exit 1
fi

# Prepare and validate the frontend candidate beside the live directory.
[[ "$frontend_candidate" == "/var/www/dist.new-$sha" ]]
if [[ -e "$frontend_candidate" || -L "$frontend_candidate" ]]; then
  [[ ! -L "$frontend_candidate" ]]
  rm -rf --one-file-system -- "$frontend_candidate"
fi
archive_listing="$(mktemp)"
trap 'rm -f "$archive_listing"' EXIT
tar -tzf "$source_frontend" > "$archive_listing"
if grep -Eq '(^/|(^|/)\.\.(/|$))' "$archive_listing"; then
  echo "Frontend archive contains an unsafe path" >&2
  exit 1
fi
# Create the empty candidate with the script umask. Final public read/execute
# permissions are applied only after extraction and validation below.
mkdir -- "$frontend_candidate"
[[ -d "$frontend_candidate" && ! -L "$frontend_candidate" ]]
tar -xzf "$source_frontend" --no-same-owner --no-same-permissions -C "$frontend_candidate"
[[ -f "$frontend_candidate/index.html" && -d "$frontend_candidate/assets" ]]
[[ -f "$frontend_candidate/deployment.json" ]]
grep -Fq "\"gitSha\":\"$sha\"" "$frontend_candidate/deployment.json"
grep -Fq '"environment":"temp-staging"' "$frontend_candidate/deployment.json"
grep -R -Fq -- '/auth/temp-staging/login' "$frontend_candidate/assets"
chown -R portra-deploy:portra-deploy "$frontend_candidate"
find "$frontend_candidate" -type d -exec chmod 0775 {} +
find "$frontend_candidate" -type f -exec chmod 0664 {} +
[[ -d "$frontend_live" && ! -L "$frontend_live" ]]
/usr/sbin/nginx -t

# Both candidates are READY before either live surface changes.
echo "BACKEND_CANDIDATE=READY release=$release_dir"
echo "FRONTEND_CANDIDATE=READY path=$frontend_candidate"

install -d -m 775 "$backup_root" "$frontend_backup"
cp -a -- "$frontend_live" "$frontend_backup/dist"

previous_application_state="$(cat "$application_state" 2>/dev/null || true)"
previous_frontend_state="$(cat "$frontend_state" 2>/dev/null || true)"
previous_release_state="$(cat "$release_state" 2>/dev/null || true)"

backend_switched=false
backend_links_touched=false
frontend_old_moved=false
frontend_switched=false

apply_release() {
  backend_links_touched=true
  atomic_link "$previous_backend" "$app_root/previous" || return 1
  atomic_link "$previous_backend" /home/portra-deploy/previous || return 1
  atomic_link "$release_dir" "$app_root/current" || return 1
  backend_switched=true
  atomic_link "$release_dir" /home/portra-deploy/current || return 1

  if [[ ! -e "$app_root/app.jar" ]]; then
    ln -s "$app_root/current/portra-backend.jar" "$app_root/app.jar" || return 1
  fi

  [[ ! -e "$frontend_old" && ! -L "$frontend_old" ]] || return 1
  mv -T -- "$frontend_live" "$frontend_old" || return 1
  frontend_old_moved=true
  mv -T -- "$frontend_candidate" "$frontend_live" || return 1
  frontend_switched=true

  sudo /usr/bin/systemctl restart portra-backend.service || return 1
  sudo /usr/bin/systemctl is-active portra-backend.service || return 1
  bash "$health_script" "$health_url" "$public_url" "$expected_origin" || return 1
  [[ "$(readlink -f "$app_root/current")" == "$release_dir" ]] || return 1
  grep -Fq "\"gitSha\":\"$sha\"" "$frontend_live/deployment.json" || return 1

  printf '%s\n' "$sha" > "$application_state" || return 1
  printf '%s\n' "$sha" > "$frontend_state" || return 1
  printf 'APPLICATION_COMMIT=%s\nFRONTEND_COMMIT=%s\nDEPLOYED_AT=%s\n' \
    "$sha" "$sha" "$timestamp" > "$release_state" || return 1
  chmod 0600 "$application_state" "$frontend_state" "$release_state" || return 1
}

restore_state_file() {
  local path="$1" value="$2"
  if [[ -n "$value" ]]; then
    printf '%s\n' "$value" > "$path"
    chmod 0600 "$path"
  else
    rm -f -- "$path"
  fi
}

rollback_release() {
  local rollback_failed=false
  echo "Application acceptance failed; restoring backend and frontend" >&2

  if [[ "$frontend_switched" == true ]]; then
    mv -T -- "$frontend_live" "$frontend_failed" || rollback_failed=true
    mv -T -- "$frontend_old" "$frontend_live" || rollback_failed=true
    frontend_old_moved=false
  elif [[ "$frontend_old_moved" == true && ! -e "$frontend_live" ]]; then
    mv -T -- "$frontend_old" "$frontend_live" || rollback_failed=true
    frontend_old_moved=false
  fi

  if [[ "$backend_switched" == true ]]; then
    atomic_link "$previous_backend" "$app_root/current" || rollback_failed=true
    atomic_link "$previous_backend" /home/portra-deploy/current || rollback_failed=true
  fi

  if [[ "$backend_links_touched" == true ]]; then
    if [[ "$old_previous_app_present" == true ]]; then
      atomic_link "$old_previous_app_target" "$app_root/previous" || rollback_failed=true
    else
      rm -f -- "$app_root/previous" || rollback_failed=true
    fi
    if [[ "$old_previous_human_present" == true ]]; then
      atomic_link "$old_previous_human_target" /home/portra-deploy/previous || rollback_failed=true
    else
      rm -f -- /home/portra-deploy/previous || rollback_failed=true
    fi
  fi

  restore_state_file "$application_state" "$previous_application_state" || rollback_failed=true
  restore_state_file "$frontend_state" "$previous_frontend_state" || rollback_failed=true
  restore_state_file "$release_state" "$previous_release_state" || rollback_failed=true

  sudo /usr/bin/systemctl restart portra-backend.service || rollback_failed=true
  sudo /usr/bin/systemctl is-active portra-backend.service || rollback_failed=true
  bash "$health_script" "$health_url" "$public_url" "$expected_origin" || rollback_failed=true

  if [[ -d "$frontend_failed" && ! -L "$frontend_failed" ]]; then
    rm -rf --one-file-system -- "$frontend_failed"
  fi
  [[ "$rollback_failed" == false ]]
}

if ! apply_release; then
  rollback_release || echo "ROLLBACK=FAILED" >&2
  exit 1
fi

if [[ -d "$frontend_old" && ! -L "$frontend_old" ]]; then
  rm -rf --one-file-system -- "$frontend_old" || \
    echo "Warning: retained old frontend at $frontend_old" >&2
fi

echo "DEPLOYED_COMMIT=$sha"
echo "BACKEND_COMMIT=$sha"
echo "FRONTEND_COMMIT=$sha"
