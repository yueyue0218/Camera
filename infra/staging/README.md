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

The normal deploy account must not receive `NOPASSWD: ALL`. An administrator reviews
the committed helper and sudo policy, uploads those two files to a root-controlled
staging location, then performs the following once:

```bash
install -o root -g root -m 0755 deploy-infra-root.sh \
  /usr/local/sbin/portra-deploy-infra

visudo -cf portra-deploy
install -o root -g root -m 0440 portra-deploy \
  /etc/sudoers.d/portra-deploy
visudo -cf /etc/sudoers.d/portra-deploy

TARGET_SHA=<reviewed-full-40-character-commit>
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

The helper is root-owned and accepts only the fixed candidate directory for a valid
40-character commit SHA. It copies only the canonical Portra Nginx and systemd files;
it does not execute uploaded scripts as root. The root-owned bootstrap marker records
the reviewed commit containing the installed helper and sudo policy. The workflow
stops with `ADMIN_BOOTSTRAP_REQUIRED` if either privileged source changed afterward,
and also compares the installed helper checksum before every privileged deployment.

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
- Infra commit: `/home/portra-deploy/state/infra-commit.txt`
- Infra backups: `/opt/portra/backups/infra/<timestamp>-<sha>/`

Manual backend rollback after the workflow has established the release layout:

```bash
bash /home/portra-deploy/scripts/current/rollback-backend.sh \
  'https://47.76.106.57/service-packages?page=1&size=1' \
  'https://47.76.106.57/' \
  'https://47.76.106.57'
```

Do not run the helper directly from a writable upload path with `sudo`. The sudo rule
permits only the fixed root-owned `/usr/local/sbin/portra-deploy-infra` copy.
