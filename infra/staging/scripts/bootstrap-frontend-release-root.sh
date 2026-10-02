#!/usr/bin/env bash
set -euo pipefail
umask 027

readonly LIVE_ENTRY=/var/www/dist
readonly FRONTEND_ROOT=/var/www/portra
readonly RELEASE_ROOT=/var/www/portra/releases
readonly CURRENT=/var/www/portra/current
readonly DEPLOY_USER=portra-deploy
readonly DEPLOY_GROUP=portra-deploy

[[ "$(id -u)" -eq 0 ]] || {
  echo "This one-time frontend migration must run as root" >&2
  exit 1
}
[[ "$#" -eq 0 ]] || {
  echo "This bootstrap accepts no arguments" >&2
  exit 2
}
getent passwd "$DEPLOY_USER" >/dev/null ||
  { echo "Missing deploy user: $DEPLOY_USER" >&2; exit 1; }
getent group "$DEPLOY_GROUP" >/dev/null ||
  { echo "Missing deploy group: $DEPLOY_GROUP" >&2; exit 1; }

fail() {
  echo "$*" >&2
  exit 1
}

verify_nginx_if_available() {
  if command -v nginx >/dev/null 2>&1; then
    nginx -t
  elif [[ -x /usr/sbin/nginx ]]; then
    /usr/sbin/nginx -t
  fi
}

resolve_current_release() {
  local resolved release_root_resolved
  [[ -L "$CURRENT" ]] || fail "$CURRENT must be a symlink"
  resolved="$(readlink -f -- "$CURRENT")" ||
    fail "$CURRENT does not resolve to an existing release"
  release_root_resolved="$(readlink -f -- "$RELEASE_ROOT")" ||
    fail "$RELEASE_ROOT cannot be resolved"
  [[ "$resolved" == "$release_root_resolved/"* ]] ||
    fail "$CURRENT must resolve strictly inside $RELEASE_ROOT"
  [[ -d "$resolved" && ! -L "$resolved" && -f "$resolved/index.html" ]] ||
    fail "Current frontend release is invalid: $resolved"
  printf '%s\n' "$resolved"
}

validate_layout() {
  local resolved
  [[ -d "$FRONTEND_ROOT" && ! -L "$FRONTEND_ROOT" ]] ||
    fail "Invalid frontend root: $FRONTEND_ROOT"
  [[ -d "$RELEASE_ROOT" && ! -L "$RELEASE_ROOT" ]] ||
    fail "Invalid frontend release root: $RELEASE_ROOT"
  [[ "$(stat -c '%U:%G' "$FRONTEND_ROOT")" == "$DEPLOY_USER:$DEPLOY_GROUP" ]] ||
    fail "$FRONTEND_ROOT must be owned by $DEPLOY_USER:$DEPLOY_GROUP"
  [[ "$(stat -c '%U:%G' "$RELEASE_ROOT")" == "$DEPLOY_USER:$DEPLOY_GROUP" ]] ||
    fail "$RELEASE_ROOT must be owned by $DEPLOY_USER:$DEPLOY_GROUP"
  [[ -L "$LIVE_ENTRY" ]] || fail "$LIVE_ENTRY must be a symlink"
  [[ "$(readlink -- "$LIVE_ENTRY")" == "$CURRENT" ]] ||
    fail "$LIVE_ENTRY must point exactly to $CURRENT"
  [[ "$(stat -c '%U:%G' "$LIVE_ENTRY")" == "root:root" ]] ||
    fail "$LIVE_ENTRY must remain administrator-owned"
  resolved="$(resolve_current_release)"
  [[ -f "$LIVE_ENTRY/index.html" ]] || fail "$LIVE_ENTRY/index.html does not resolve"
  if find "$resolved" -type d ! -perm -0005 -print -quit | grep -q .; then
    fail "Frontend release contains a directory that is not publicly traversable"
  fi
  if find "$resolved" -type f ! -perm -0004 -print -quit | grep -q .; then
    fail "Frontend release contains a file that is not publicly readable"
  fi
  printf 'FRONTEND_CURRENT_RELEASE=%s\n' "$resolved"
}

if [[ -L "$LIVE_ENTRY" ]]; then
  validate_layout
  verify_nginx_if_available
  echo "FRONTEND_RELEASE_ROOT_BOOTSTRAP=ALREADY_COMPLETE"
  exit 0
fi

[[ -d "$LIVE_ENTRY" ]] || fail "$LIVE_ENTRY must be the existing frontend directory"
[[ ! -L "$LIVE_ENTRY" ]] || fail "$LIVE_ENTRY is an unexpected symlink"
[[ -f "$LIVE_ENTRY/index.html" ]] || fail "$LIVE_ENTRY/index.html is required"

for path in "$FRONTEND_ROOT" "$RELEASE_ROOT"; do
  if [[ -e "$path" || -L "$path" ]]; then
    [[ -d "$path" && ! -L "$path" ]] || fail "Refusing unexpected path: $path"
  fi
done
[[ ! -e "$CURRENT" && ! -L "$CURRENT" ]] ||
  fail "$CURRENT already exists while $LIVE_ENTRY is still a directory"

install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 0775 "$FRONTEND_ROOT" "$RELEASE_ROOT"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
release_name="bootstrap-$timestamp"
bootstrap_release="$RELEASE_ROOT/$release_name"
bootstrap_candidate="$RELEASE_ROOT/.bootstrap-candidate-$timestamp-$$"
current_temp="$FRONTEND_ROOT/.current.bootstrap-$$"
backup_root=/home/portra-deploy/backups/frontend
backup_dir="$backup_root/$timestamp-before-release-root-migration"
legacy_saved="/var/www/dist.before-release-root-migration-$timestamp-$$"
live_temp="/var/www/.dist.next-$timestamp-$$"

candidate_created=false
current_temp_created=false
live_temp_created=false
created_release=false
created_current=false
migration_in_progress=false
completed=false

cleanup_on_exit() {
  local status=$?
  if [[ "$completed" != true ]]; then
    if [[ "$migration_in_progress" == true ]]; then
      if [[ -L "$LIVE_ENTRY" && "$(readlink -- "$LIVE_ENTRY")" == "$CURRENT" ]]; then
        rm -f -- "$LIVE_ENTRY" ||
          echo "Failed to remove incomplete live symlink: $LIVE_ENTRY" >&2
      fi
      if [[ -d "$legacy_saved" && ! -L "$legacy_saved" && ! -e "$LIVE_ENTRY" ]]; then
        mv -T -- "$legacy_saved" "$LIVE_ENTRY" ||
          echo "CRITICAL: failed to restore legacy frontend at $LIVE_ENTRY" >&2
      fi
    fi
    if [[ "$created_current" == true &&
          -L "$CURRENT" &&
          "$(readlink -- "$CURRENT")" == "releases/$release_name" ]]; then
      rm -f -- "$CURRENT" || echo "Failed to remove incomplete current symlink" >&2
    fi
    if [[ "$created_release" == true &&
          -d "$bootstrap_release" &&
          ! -L "$bootstrap_release" ]]; then
      rm -rf --one-file-system -- "$bootstrap_release" ||
        echo "Failed to remove incomplete bootstrap release: $bootstrap_release" >&2
    fi
  fi
  if [[ "$candidate_created" == true &&
        -d "$bootstrap_candidate" &&
        ! -L "$bootstrap_candidate" ]]; then
    rm -rf --one-file-system -- "$bootstrap_candidate" ||
      echo "Failed to remove bootstrap candidate: $bootstrap_candidate" >&2
  fi
  if [[ "$current_temp_created" == true && -L "$current_temp" ]]; then
    rm -f -- "$current_temp" || echo "Failed to remove temporary current symlink" >&2
  fi
  if [[ "$live_temp_created" == true && -L "$live_temp" ]]; then
    rm -f -- "$live_temp" || echo "Failed to remove temporary live symlink" >&2
  fi
  return "$status"
}
trap cleanup_on_exit EXIT

[[ ! -e "$bootstrap_release" && ! -L "$bootstrap_release" ]]
[[ ! -e "$bootstrap_candidate" && ! -L "$bootstrap_candidate" ]]
mkdir -- "$bootstrap_candidate"
candidate_created=true
cp -a -- "$LIVE_ENTRY/." "$bootstrap_candidate/"
[[ -f "$bootstrap_candidate/index.html" ]]
chown -R "$DEPLOY_USER:$DEPLOY_GROUP" "$bootstrap_candidate"
find "$bootstrap_candidate" -type d -exec chmod 0775 {} +
find "$bootstrap_candidate" -type f -exec chmod 0664 {} +
mv -T -- "$bootstrap_candidate" "$bootstrap_release"
candidate_created=false
created_release=true

[[ ! -e "$current_temp" && ! -L "$current_temp" ]]
ln -s -- "releases/$release_name" "$current_temp"
current_temp_created=true
mv -T -- "$current_temp" "$CURRENT"
current_temp_created=false
chown -h "$DEPLOY_USER:$DEPLOY_GROUP" "$CURRENT"
created_current=true
[[ -f "$CURRENT/index.html" ]] || fail "$CURRENT/index.html does not resolve"
resolve_current_release >/dev/null

[[ ! -e "$backup_dir" && ! -L "$backup_dir" ]] ||
  fail "Migration backup already exists: $backup_dir"
for path in /home/portra-deploy /home/portra-deploy/backups "$backup_root"; do
  [[ ! -L "$path" ]] || fail "Refusing symlink in migration backup path: $path"
done
install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 0775 "$backup_root" "$backup_dir" "$backup_dir/dist"
cp -a -- "$LIVE_ENTRY/." "$backup_dir/dist/"
chown -R "$DEPLOY_USER:$DEPLOY_GROUP" "$backup_dir"

[[ ! -e "$legacy_saved" && ! -L "$legacy_saved" ]]
[[ ! -e "$live_temp" && ! -L "$live_temp" ]]
ln -s -- "$CURRENT" "$live_temp"
live_temp_created=true
chown -h root:root "$live_temp"
mv -T -- "$LIVE_ENTRY" "$legacy_saved"
migration_in_progress=true
mv -T -- "$live_temp" "$LIVE_ENTRY"
live_temp_created=false

validate_layout
verify_nginx_if_available

migration_in_progress=false
completed=true
rm -rf --one-file-system -- "$legacy_saved" ||
  echo "Warning: migration succeeded but legacy staging directory remains at $legacy_saved" >&2
echo "FRONTEND_RELEASE_ROOT_BOOTSTRAP=COMPLETE"
echo "BOOTSTRAP_RELEASE=$bootstrap_release"
echo "MIGRATION_BACKUP=$backup_dir"
