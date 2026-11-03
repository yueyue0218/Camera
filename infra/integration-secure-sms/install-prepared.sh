#!/usr/bin/env bash
# Preparation only. No starts, enablement, migrations, credentials writes or daemon reload.
set -Eeuo pipefail
umask 077
[[ $(id -u) == 0 ]]
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
sha256sum --quiet -c SHA256SUMS
release=/opt/portra-integration/releases/@COMMIT@
[[ ! -e $release && ! -L $release ]] || { echo 'STOP: release exists; inspect manually, no overwrite'; exit 1; }
for unit in portra-integration.service portra-integration-validate.service; do
  [[ ! -e /etc/systemd/system/$unit && ! -L /etc/systemd/system/$unit ]]
  [[ $(systemctl show "$unit" -p LoadState --value) == not-found ]] || { echo "STOP: existing $unit requires review"; exit 1; }
done
for path in /opt/portra-integration /opt/portra-integration/releases /opt/portra-integration/uploads /etc/portra-integration; do
  [[ ! -L $path ]] || { echo 'STOP: symlink in dedicated path'; exit 1; }
done
[[ -f /etc/portra-integration/app.env && ! -L /etc/portra-integration/app.env ]]
[[ $(stat -c '%a:%U:%G' /etc/portra-integration/app.env) == 600:root:root ]]
[[ -x /usr/bin/java && -x /usr/bin/python3 && -x /usr/bin/bash ]]
/usr/bin/java -version 2>&1 | head -n 1 | grep -Eq 'version "17\.'
if ! getent passwd portra-integration >/dev/null; then
  useradd --system --user-group --home-dir /opt/portra-integration --no-create-home --shell /usr/sbin/nologin portra-integration
fi
[[ $(id -u portra-integration) != 0 ]]
[[ $(id -gn portra-integration) == portra-integration ]]
[[ $(id -nG portra-integration) == portra-integration ]]
if [[ -e /opt/portra-integration/uploads ]]; then
  [[ -d /opt/portra-integration/uploads ]]
  [[ $(stat -c '%a:%U:%G' /opt/portra-integration/uploads) == 700:portra-integration:portra-integration ]]
else
  install -d -o root -g root -m 0755 /opt/portra-integration
  install -d -o portra-integration -g portra-integration -m 0700 /opt/portra-integration/uploads
fi
install -d -o root -g root -m 0755 /opt/portra-integration /opt/portra-integration/releases "$release"
cp -R -- . "$release/"
chown -R root:root "$release"
find "$release" -type d -exec chmod 0755 {} +
find "$release" -type f -exec chmod 0644 {} +
install -o root -g root -m 0644 portra-integration.service portra-integration-validate.service /etc/systemd/system/
systemd-analyze verify /etc/systemd/system/portra-integration.service /etc/systemd/system/portra-integration-validate.service
runuser -u portra-integration -- test -r "$release/application.jar"
runuser -u portra-integration -- test -r "$release/application-8081.properties"
runuser -u portra-integration -- test -r "$release/validator/ValidateJpa.class"
runuser -u portra-integration -- test -w /opt/portra-integration/uploads
if runuser -u portra-integration -- test -w "$release/application.jar"; then exit 1; fi
if runuser -u portra-integration -- test -r /etc/portra-integration/app.env; then exit 1; fi
echo 'INSTALL_PASS: service user reads release/config; systemd PID1 reads root-only EnvironmentFile; no SQL or GRANT executed'
