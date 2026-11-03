#!/usr/bin/env bash
set -euo pipefail
umask 077

# Client-side entry. Invoked only by the manual Staging workflow after review.
[[ "$#" -eq 4 ]] || exit 2
sha="$1" jar="$2" expected_backend="$3" expected_frontend="$4"
for commit in "$sha" "$expected_backend" "$expected_frontend"; do
  [[ "$commit" =~ ^[0-9a-f]{40}$ ]] || exit 2
done
[[ -f "$jar" && -s "$jar" && ! -L "$jar" ]]
: "${STAGING_HOST:?}" "${STAGING_PORT:?}" "${STAGING_USER:?}"
: "${STAGING_HEALTH_URL:?}" "${STAGING_PUBLIC_URL:?}" "${STAGING_EXPECTED_ORIGIN:?}"
: "${STAGING_SSH_KEY_FILE:?}" "${STAGING_KNOWN_HOSTS_FILE:?}"
: "${STAGING_SSH_HOST_FINGERPRINT:?trusted ED25519 SHA256 fingerprint required}"
: "${STAGING_RELEASE_ID:?numeric workflow run-attempt required}"
# Fix this entry to the existing canonical Staging endpoint, never Production.
[[ "$STAGING_HOST" == 47.76.106.57 && "$STAGING_PORT" == 22 && "$STAGING_USER" == portra-deploy ]]
[[ "$STAGING_EXPECTED_ORIGIN" == https://47.76.106.57 ]]
[[ "$STAGING_RELEASE_ID" =~ ^[0-9]+-[0-9]+$ ]]
[[ "$STAGING_SSH_HOST_FINGERPRINT" =~ ^SHA256:[A-Za-z0-9+/]{43}$ ]]
for url in "$STAGING_HEALTH_URL" "$STAGING_PUBLIC_URL"; do
  [[ "$url" == "$STAGING_EXPECTED_ORIGIN/"* && "$url" =~ ^https://[A-Za-z0-9.:-]+(/[^[:space:]\']*)?$ ]] || exit 2
done
[[ -f "$STAGING_SSH_KEY_FILE" && -f "$STAGING_KNOWN_HOSTS_FILE" ]]
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
payload="$(mktemp -d)"
trap 'rm -rf -- "$payload"' EXIT

# This is local verification only. No keyscan or SSH occurs before the match.
ssh-keygen -F "$STAGING_HOST" -f "$STAGING_KNOWN_HOSTS_FILE" |
  awk '$2 == "ssh-ed25519" { print }' > "$payload/known_hosts"
mapfile -t fingerprints < <(ssh-keygen -lf "$payload/known_hosts" -E sha256 | awk '{print $2}')
[[ "${#fingerprints[@]}" -eq 1 && "${fingerprints[0]}" == "$STAGING_SSH_HOST_FINGERPRINT" ]] || {
  echo 'Trusted Staging host fingerprint mismatch; no connection made' >&2; exit 1;
}
ssh_options=(-i "$STAGING_SSH_KEY_FILE" -o BatchMode=yes -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=yes -o UpdateHostKeys=no -o VerifyHostKeyDNS=no
  -o GlobalKnownHostsFile=/dev/null -o "UserKnownHostsFile=$payload/known_hosts"
  -o HostKeyAlgorithms=ssh-ed25519 -o ConnectTimeout=10)
remote="$STAGING_USER@$STAGING_HOST"
incoming="/home/portra-deploy/incoming/$sha/backend-only-$STAGING_RELEASE_ID"
install -d "$payload/infra/scripts"
cp -- "$jar" "$payload/portra-backend.jar"
sha256sum "$payload/portra-backend.jar" > "$payload/portra-backend.jar.sha256"
cp -- "$script_dir/deploy-backend.sh" "$script_dir/health-check.sh" \
  "$script_dir/health-backend-staging.sh" "$script_dir/verify-privacy-jar.py" "$payload/infra/scripts/"
printf '%s\n' "$sha" > "$payload/target-commit.txt"

# A failed/partial upload never reaches the deployment command. No shared payload
# is overwritten; the server lock covers all live-link and provenance mutations.
ssh "${ssh_options[@]}" -p "$STAGING_PORT" "$remote" \
  "umask 077; mkdir -p '/home/portra-deploy/incoming/$sha' && mkdir '$incoming'"
scp "${ssh_options[@]}" -P "$STAGING_PORT" -r \
  "$payload/portra-backend.jar" "$payload/portra-backend.jar.sha256" \
  "$payload/target-commit.txt" "$payload/infra" "$remote:$incoming/"
ssh "${ssh_options[@]}" -p "$STAGING_PORT" "$remote" \
  "bash '$incoming/infra/scripts/deploy-backend.sh' '$sha' '$incoming/portra-backend.jar' '$STAGING_HEALTH_URL' '$STAGING_PUBLIC_URL' '$STAGING_EXPECTED_ORIGIN' '$expected_backend' '$expected_frontend'"
