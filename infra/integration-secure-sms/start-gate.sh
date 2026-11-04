#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/portra-integration/releases/@COMMIT@
sha256sum --quiet -c SHA256SUMS
[[ $(systemctl show portra-integration-validate.service -p Result --value) == success ]]
[[ $(systemctl show portra-integration-validate.service -p ExecMainStatus --value) == 0 ]]
[[ $(systemctl show portra-integration-validate.service -p ExecMainStartTimestampMonotonic --value) =~ ^[1-9][0-9]*$ ]]
# Recheck format locally at every start, but do not repeat JPA or cloud probes.
/usr/bin/python3 check-environment.py
echo 'START_GATE_PASS commit=@SHORT_COMMIT@ profiles=staging,integration runtime_ddl=false'
