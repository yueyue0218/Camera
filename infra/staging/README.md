# Portra staging canonical infrastructure

This directory is the canonical, non-secret desired state for Portra staging.
Server files are deployment results; they are not a second source of truth.

## Managed surfaces

| Surface | Repository path | Server path | Classification |
| --- | --- | --- | --- |
| HTTPS virtual host | `nginx/portra-ssl.conf` | `/etc/nginx/conf.d/portra-ssl.conf` | TRACKED_IN_REPO |
| API/static routing | `nginx/portra.conf` | `/etc/nginx/default.d/portra.conf` | TRACKED_IN_REPO |
| Backend unit | `systemd/portra-backend.service` | `/etc/systemd/system/portra-backend.service` | TRACKED_IN_REPO |
| Deployment scripts | `scripts/` | `/home/portra-deploy/scripts/releases/<sha>/` | TRACKED_IN_REPO |
| Privileged helper source | `scripts/deploy-infra-root.sh` | `/usr/local/sbin/portra-deploy-infra` | TRACKED_IN_REPO; root-owned bootstrap |
| Sudo policy | `sudoers/portra-deploy` | `/etc/sudoers.d/portra-deploy` | TRACKED_IN_REPO; root-owned bootstrap |
| Process environment template | `deploy/portra.temp-staging.env.example` | not installed | TRACKED_IN_REPO |
| Process environment values | not stored | `/etc/portra/portra.env` | SECRET_SERVER_ONLY |
| TLS certificate | not stored | `/etc/letsencrypt/live/47.76.106.57/fullchain.pem` | GENERATED |
| TLS private key | not stored | `/etc/letsencrypt/live/47.76.106.57/privkey.pem` | SECRET_SERVER_ONLY |
| Frontend assets | built artifact | `/var/www/dist` | GENERATED |

The vendor-owned `/etc/nginx/nginx.conf` remains server package configuration. Portra
owns only the two included files above. Database migrations are deliberately absent
from this deployment system.

## One-time administrator bootstrap

The normal deploy account must not receive `NOPASSWD: ALL`. Do not install helper or
sudoers files copied from `/home/portra-deploy` or the obsolete
`/root/portra-bootstrap-8f5b28405eeb5cc2fac19549934fea27b2df7ea9/` directory.
An administrator obtains the bytes independently from the fixed public repository,
requires the reviewed commit to be the exact current `main` head, verifies the
published SHA-256 values, and only then installs them:

The security-fix commit must first be reviewed and merged to `main`. Bootstrap must
not use a branch SHA, a local-only commit, or the obsolete copied candidate.

```bash
TARGET_SHA=<reviewed-full-40-character-main-commit>
BOOTSTRAP_DIR="$(mktemp -d /root/portra-bootstrap.XXXXXX)"
git clone --bare https://github.com/yueyue0218/Camera.git "$BOOTSTRAP_DIR/repository.git"
test "$(git --git-dir="$BOOTSTRAP_DIR/repository.git" rev-parse refs/heads/main)" = "$TARGET_SHA"

git --git-dir="$BOOTSTRAP_DIR/repository.git" show \
  "$TARGET_SHA:infra/staging/scripts/deploy-infra-root.sh" \
  > "$BOOTSTRAP_DIR/deploy-infra-root.sh"
git --git-dir="$BOOTSTRAP_DIR/repository.git" show \
  "$TARGET_SHA:infra/staging/sudoers/portra-deploy" \
  > "$BOOTSTRAP_DIR/portra-deploy"

sha256sum "$BOOTSTRAP_DIR/deploy-infra-root.sh" "$BOOTSTRAP_DIR/portra-deploy"
visudo -cf "$BOOTSTRAP_DIR/portra-deploy"

install -o root -g root -m 0755 "$BOOTSTRAP_DIR/deploy-infra-root.sh" \
  /usr/local/sbin/portra-deploy-infra
install -o root -g root -m 0440 "$BOOTSTRAP_DIR/portra-deploy" \
  /etc/sudoers.d/portra-deploy
visudo -cf /etc/sudoers.d/portra-deploy

install -d -o root -g root -m 0755 /opt/portra/deploy
printf '%s\n' "$TARGET_SHA" > /opt/portra/deploy/bootstrap-commit.txt
chown root:root /opt/portra/deploy/bootstrap-commit.txt
chmod 0644 /opt/portra/deploy/bootstrap-commit.txt

install -d -o portra-deploy -g portra -m 2750 /opt/portra/app/releases
install -d -o portra-deploy -g portra-deploy -m 0700 \
  /home/portra-deploy/incoming \
  /home/portra-deploy/state \
  /home/portra-deploy/scripts
```

## Root trust boundary

The root-owned helper never reads Nginx or systemd content from a deploy-user-writable
directory. For each invocation it uses an isolated Git environment and a root-owned
bare repository to fetch the fixed URL `https://github.com/yueyue0218/Camera.git`.
The requested SHA must equal the freshly fetched `refs/heads/main` head exactly.
Canonical files are exported directly from that root-owned Git object database.

The complete bytes of all three root-loaded files are pinned by SHA-256 inside the
reviewed root helper. The systemd unit also has a complete semantic allowlist fixing
`User`, `Group`, `WorkingDirectory`, `EnvironmentFile`, `ExecStart`, lifecycle shape,
restart policy, and service identity. Extra directives—including `ExecStartPre`,
`ExecStartPost`, or inline `Environment`—make validation fail. Nginx files are
protected by the same full-byte allowlist and are still checked with `nginx -t`.

Consequently, a root-owned Nginx/systemd change requires an explicit administrator
review and a new helper bootstrap with updated approved hashes. Backend releases and
non-root deployment scripts remain automatic. The root-owned bootstrap marker records
the reviewed helper/sudoers commit, and the workflow compares the installed helper
checksum before each privileged deployment.

After bootstrap, verify without changing live configuration:

```bash
visudo -cf /etc/sudoers.d/portra-deploy
sudo -l -U portra-deploy
stat -c '%U:%G %a %n' /usr/local/sbin/portra-deploy-infra
cat /opt/portra/deploy/bootstrap-commit.txt
```

## Provenance and rollback

- Backend releases: `/opt/portra/app/releases/<sha>/`
- Backend current/previous: `/opt/portra/app/current`, `/opt/portra/app/previous`
- Human-readable current: `/home/portra-deploy/current/deployed-commit.txt`
- Backend commit: `/home/portra-deploy/state/application-commit.txt`
- Root-owned Infra commit: `/opt/portra/deploy/infra-commit.txt`
- Non-root deployment scripts commit: `/home/portra-deploy/scripts/current/deployed-commit.txt`
- Infra backups: `/opt/portra/backups/infra/<timestamp>-<sha>/`

Manual backend rollback after the workflow has established the release layout:

```bash
bash /home/portra-deploy/scripts/current/rollback-backend.sh \
  'https://47.76.106.57/service-packages?page=1&size=1' \
  'https://47.76.106.57/' \
  'https://47.76.106.57'
```

The sudo rule permits only the fixed root-owned helper with a SHA argument and one of
the fixed surfaces `nginx`, `systemd`, or `all`. The helper itself enforces exact
argument count, 40-hex SHA syntax, exact trusted-main equality, and approved bytes.
