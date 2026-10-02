# C-DEPLOY-01 — Staging deployment closure

## Entry point

`Project CI` is the primary entry point. A successful push to `main` calls
**Deploy Portra staging** with the exact same `${{ github.sha }}`. Pull requests and
failed CI runs never deploy. `workflow_dispatch` remains a main-only fallback that
uses the same deployment job.

Input `deploy_scope` controls only optional infrastructure work: `auto`,
`application`, `infra`, or `all`. Backend and frontend application surfaces always
deploy together from the same immutable main SHA.

`auto` compares the target commit with the independently recorded infra commits.
Every accepted main SHA builds and deploys both application surfaces. Changes under
`infra/staging/nginx/**`, `systemd/**`, or `scripts/**` deploy only those surfaces.
Changes to the privileged root helper or sudo policy stop the run until an
administrator reviews, installs, and records that target commit.

## Deployment behavior

Application deployment builds the backend with Java 17 and `-DskipTests` and builds
the frontend with Node 20, `npm ci`, and `npm run build:temp-staging`. Both artifacts
come from the caller's exact `github.sha`, include checksums, and upload to the same
non-live incoming directory. The server prepares and validates both candidates before
switching either one. It then updates the backend `current` release and atomically
switches `/var/www/portra/current` to the prepared immutable frontend release,
restarts `portra-backend.service`, and runs finite health, HTTPS, CORS, credentials,
and Authorization-preflight checks. The fixed administrator-created entry
`/var/www/dist -> /var/www/portra/current` is never replaced by a normal deployment.
Failure atomically returns frontend `current` to its previous release, restores the
previous backend release, and re-runs acceptance.

Privileged infrastructure deployment does not trust uploaded candidates. The
root-owned helper independently fetches the fixed GitHub repository into a root-owned
cache, requires the requested SHA to be the exact current `main` head, exports files
directly from Git, and checks complete approved SHA-256 values. The systemd unit must
also match a complete semantic allowlist. It then backs up live files, installs
atomically, validates, reloads/restarts only the affected service, and rolls back on
validation or health failure.

The workflow never runs SQL and never reads or replaces `/etc/portra/portra.env`.
The repository contains only the non-secret template
`deploy/portra.temp-staging.env.example`.

## Required GitHub configuration

Secrets:

- `STAGING_SSH_PRIVATE_KEY`: private key for the restricted `portra-deploy` account.
- `STAGING_KNOWN_HOSTS`: pre-verified SSH host key entry. The workflow always uses
  strict host-key checking.

Variables:

- `STAGING_HOST`: staging host only.
- `STAGING_PORT`: SSH port, normally `22`.
- `STAGING_USER`: `portra-deploy`.
- `STAGING_HEALTH_URL`: HTTPS read-only backend endpoint returning business code 200.
- `STAGING_PUBLIC_URL`: public HTTPS root URL.
- `STAGING_EXPECTED_ORIGIN`: exact accepted HTTPS browser origin.

For the current staging host the three URL variables are expected to describe
`https://47.76.106.57`; no secret value belongs in these variables.

## Frontend release-root bootstrap

Before this release architecture is merged, an administrator runs the reviewed
`infra/staging/scripts/bootstrap-frontend-release-root.sh` from the exact CI-passing
pull-request head. This one-time, idempotent migration converts the existing live
directory into:

```text
/var/www/dist -> /var/www/portra/current
/var/www/portra/current -> releases/bootstrap-<timestamp>
/var/www/portra/releases/bootstrap-<timestamp>/
```

It copies the legacy live frontend into both the bootstrap release and the existing
backup area before replacing the live entry. If the new entry cannot be created or
validated, it restores the original `/var/www/dist` directory. The migration does not
change `/var/www` ownership, reload Nginx, add sudo permissions, or modify Nginx
configuration. Nginx continues to use `root /var/www/dist;`.

After bootstrap, normal GitHub Actions deployments run as `portra-deploy`. They can
write `/var/www/portra`, prepare `/var/www/portra/releases/<sha>`, and atomically
replace `/var/www/portra/current`; they cannot write `/var/www` or replace
`/var/www/dist`. Existing valid same-SHA releases are reused, inconsistent releases
fail closed, and no automatic release pruning occurs.

## Privileged infrastructure bootstrap boundary

The existing server sudo policy permits only restart/is-active for
`portra-backend.service`. A one-time administrator bootstrap described in
`infra/staging/README.md` is required before Nginx or systemd deployment can run.
Do not weaken this boundary with `NOPASSWD: ALL` or generic `sudo sh/cp/systemctl`.
Any change to root-loaded Nginx/systemd bytes requires a reviewed helper update and a
new administrator bootstrap. Backend and non-root deployment assets remain automatic.

## Known runtime risk

`ConversationSchemaInitializer` can still attempt runtime `ALTER TABLE` or
`CREATE TABLE`. This deployment task does not change it and does not integrate database
migrations. Schema robustness remains a separate backend task.
