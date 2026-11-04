#!/usr/bin/env bash
# Run manually only after explicit start approval. Never modifies the 8080 environment.
set -Eeuo pipefail
umask 077
[[ ${1:-} == --approved-start-@SHORT_COMMIT@ ]] || { echo 'STOP: user start approval required; no action taken'; exit 1; }
[[ $(id -u) == 0 ]]
[[ $(hostname) == iZj6c37r6uh1vphb51xgm8Z ]] || { echo 'STOP: unexpected ECS hostname'; exit 1; }
for tool in systemctl journalctl ss python3 runuser sha256sum cmp; do command -v "$tool" >/dev/null; done
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
sha256sum --quiet -c SHA256SUMS
evidence=/var/tmp/portra-8081-@SHORT_COMMIT@-evidence
mkdir -m 0700 "$evidence" # Atomic one-shot lock, retained on success or failure.
step=PREPARE
new_start_attempted=0
on_failure() {
  rc=$?
  trap - ERR
  echo "FAIL: step=$step exit=$rc; no automatic retry, database rollback or original-service changes"
  if [[ $new_start_attempted == 1 ]]; then
    systemctl stop portra-integration.service || true
    journalctl -u portra-integration.service --since "$since" --no-pager > "$evidence/8081-failure.log" 2>&1 || true
  fi
  python3 snapshot-8080.py > "$evidence/8080-after-failure.json" 2> "$evidence/8080-check-error.txt" || true
  echo "Preserved evidence: $evidence. Resolve the specific failure before any new approved attempt."
  exit "$rc"
}
trap on_failure ERR
since=$(date --iso-8601=seconds)
step=EXISTING_8080_BASELINE
python3 snapshot-8080.py > "$evidence/8080-before.json"
[[ -z $(ss -H -ltn 'sport = :8081') ]] || { echo 'BLOCK: 8081 is occupied'; false; }
step=INSTALL_FILES_AND_PERMISSIONS
bash install-prepared.sh > "$evidence/install.log" 2>&1
step=LOAD_NEW_UNITS
systemctl daemon-reload # Loads new definitions only; does not restart any service.
step=CONFIG_EXTERNAL_AND_JPA_VALIDATE
if systemctl start portra-integration-validate.service; then
  journalctl -u portra-integration-validate.service --since "$since" --no-pager > "$evidence/validate.log"
else
  journalctl -u portra-integration-validate.service --since "$since" --no-pager > "$evidence/validate.log"
  echo 'BLOCK: configuration/external/JPA validation failed; see root-only validate.log'; false
fi
[[ $(systemctl show portra-integration-validate.service -p Result --value) == success ]]
[[ $(systemctl show portra-integration-validate.service -p ExecMainStatus --value) == 0 ]]
grep -q 'APP_GRANTS_PASS DML_ONLY' "$evidence/validate.log"
grep -q 'JPA_VALIDATE_PASS entities=38 database=portra_integration user=portra_int_app' "$evidence/validate.log"
echo 'PRE_START_PASS: configuration, service-user access, external endpoints, app DML-only grants, actual JPA'
step=START_8081
new_start_attempted=1
systemctl start portra-integration.service
step=WAIT_STARTUP
ready=0
for ((attempt=0;attempt<60;attempt++)); do
  systemctl is-active --quiet portra-integration.service
  if journalctl -u portra-integration.service --since "$since" --no-pager | grep 'Started CameraApplication' >/dev/null; then
    ready=1; break
  fi
  sleep 2
done
[[ $ready == 1 ]] || { echo 'BLOCK: application readiness timeout'; false; }
step=LOCAL_HTTP_ACCEPTANCE
python3 health-check.py > "$evidence/http-check.log" 2>&1
step=STARTUP_LOG_AND_STABILITY
sleep 5
systemctl is-active --quiet portra-integration.service
journalctl -u portra-integration.service --since "$since" --no-pager > "$evidence/8081.log"
if grep -Eiq 'Failed to verify or upgrade|Added conversations\.|Added messages\.|Upgraded moment_images|Schema-validation:|OutOfMemoryError| ERROR ' "$evidence/8081.log"; then
  echo 'BLOCK: startup/DDL/mapping/memory error in 8081 log'; false
fi
systemctl show portra-integration.service -p MainPID -p Result -p NRestarts -p MemoryCurrent -p MemoryPeak > "$evidence/8081-status.txt"
[[ $(systemctl show portra-integration.service -p NRestarts --value) == 0 ]]
step=EXISTING_8080_UNCHANGED
python3 snapshot-8080.py > "$evidence/8080-after.json"
cmp "$evidence/8080-before.json" "$evidence/8080-after.json"
step=COMPLETE
printf '%s\n' 'PASS: one-round JPA/logs/loopback/API checks; 8080 state/PID/start time/restarts/anonymous endpoint unchanged.'
printf '%s\n' 'No SMS/email sent, no user data copied. Operator-reviewed PNVS templates and SMTP credentials still need any separately approved functional test.'
echo "Evidence: $evidence"
printf 'ACCEPTED commit=@COMMIT@\n' > "$evidence/RESULT"
