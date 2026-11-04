#!/usr/bin/env python3
"""Backend-only activation. Requires a root-owned, exact-artifact production receipt.
Never writes Web, uploads, configuration, database, or infrastructure.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.request

APP = Path('/opt/portra/app')
WEB = Path('/var/www/dist')
UPLOADS = Path('/opt/portra/uploads')
STATE = Path('/home/portra-deploy/state')
INCOMING = Path('/home/portra-deploy/incoming')
RECEIPTS = Path('/etc/portra/releases')
SERVICE = 'portra-backend.service'


def need(condition, message):
    if not condition:
        raise RuntimeError(message)


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def inventory(root):
    need(root.is_dir(), 'Required preservation directory missing')
    result = {}
    for directory, dirs, names in os.walk(str(root), followlinks=False, onerror=lambda err: (_ for _ in ()).throw(err)):
        for name in dirs:
            need(not (Path(directory)/name).is_symlink(), 'Nested directory symlink requires review')
        for name in names:
            p = Path(directory)/name
            need(p.is_file() and not p.is_symlink(), 'Non-regular asset requires review')
            result[str(p.relative_to(root))] = digest(p)
    need(bool(result), 'Empty preservation directory requires review')
    return result


def run(*args):
    return subprocess.check_output(args, universal_newlines=True, stderr=subprocess.STDOUT).strip()


def atomic_json(path, value):
    temp = path.with_name(path.name + '.next-' + str(os.getpid()))
    with temp.open('x', encoding='utf-8') as stream:
        json.dump(value, stream, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(str(temp), str(path))


def link(target, path):
    temp = path.with_name(path.name + '.next-' + str(os.getpid()))
    os.symlink(str(target), str(temp))
    os.replace(str(temp), str(path))


def health(url):
    # Never follow redirects away from the approved local/public endpoint.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    with urllib.request.build_opener(NoRedirect).open(url, timeout=10) as response:
        value = json.loads(response.read(65536).decode('utf-8'))
        need(response.status == 200 and (value.get('code') == 200 or value.get('status') == 'UP'), 'Health response invalid')


def validate_receipt(receipt, revision, jar_hash, previous_hash):
    need(receipt.get('revision') == revision and receipt.get('jarSha256') == jar_hash, 'Approval does not bind exact JAR')
    need(receipt.get('previousJarSha256') == previous_hash, 'Live baseline changed; reapprove')
    need(receipt.get('host') == run('hostname'), 'Wrong host')
    need(receipt.get('expiresAtEpoch', 0) > time.time(), 'Approval expired')
    for key in ('productionDatabaseVerified', 'backupRestoreVerified', 'incrementalSchemaApproved', 'appProtocolPassed'):
        need(receipt.get(key) is True, 'Missing approval: ' + key)
    need(bool(receipt.get('backupEvidence')) and bool(receipt.get('databaseIdentity')), 'DB/backup evidence required')
    need(receipt.get('initialServiceState', 'active') in ('active','inactive'), 'Invalid approved initial service state')
    need(re.fullmatch(r'http://127\.0\.0\.1:8080/[A-Za-z0-9/_-]+', receipt.get('localHealthUrl', '')), '8080 local health URL required')
    need(re.fullmatch(r'https://[A-Za-z0-9.-]+(/[A-Za-z0-9/_-]+)', receipt.get('publicHealthUrl', '')), 'Approved HTTPS health URL required')


def load_receipt(path):
    need(not path.is_symlink(), 'Approval symlink rejected')
    for parent in [path] + list(path.parents):
        need(not parent.is_symlink(), 'Approval ancestor symlink rejected')
        meta = parent.stat()
        need(meta.st_uid == 0 and not (meta.st_mode & 0o022), 'Approval must be root-owned and not writable by deployment user')
    return json.loads(path.read_text())


def deploy(revision, jar_hash):
    need(re.fullmatch('[0-9a-f]{40}', revision) and re.fullmatch('[0-9a-f]{64}', jar_hash), 'Invalid release identity')
    source = INCOMING/revision/'backend.jar'
    receipt = load_receipt(RECEIPTS/(revision + '.json'))
    need(source.is_file() and not source.is_symlink() and digest(source) == jar_hash, 'Uploaded JAR hash mismatch')
    current = APP/'current'
    need(current.is_symlink() and (APP/'app.jar').is_symlink(), 'Existing release links required; do not bootstrap automatically')
    previous = current.resolve()
    need(previous.parent == APP/'releases', 'Unexpected current release path')
    need((APP/'app.jar').resolve() == previous/'portra-backend.jar', 'Service JAR link differs from current')
    previous_hash = digest(previous/'portra-backend.jar')
    validate_receipt(receipt, revision, jar_hash, previous_hash)
    # A reviewed maintenance window may intentionally leave the old JVM stopped
    # after backup/migration; do not restart an incompatible old binary first.
    initial_state = run('systemctl','show',SERVICE,'--property=ActiveState','--value')
    need(initial_state == receipt.get('initialServiceState', 'active'), 'Service state differs from approval')
    old_pid = run('systemctl','show',SERVICE,'--property=MainPID','--value')
    web_target = str(WEB.resolve())
    before_web, before_uploads = inventory(WEB), inventory(UPLOADS)
    release = APP/'releases'/revision
    need(not release.exists(), 'Release already exists; immutable identity cannot be reused')
    STATE.mkdir(exist_ok=True)
    evidence = {'revision': revision, 'jarSha256': jar_hash, 'previousJarSha256': previous_hash,
                'webTarget': web_target, 'webAssets': before_web, 'uploads': before_uploads,
                'databaseEvidence': receipt['databaseIdentity'], 'status': 'PREPARED'}
    evidence_path = STATE/('backend-release-' + revision + '.json')
    atomic_json(evidence_path, evidence)
    release.mkdir(mode=0o750)
    import shutil
    shutil.copyfile(str(source), str(release/'portra-backend.jar'))
    os.chmod(str(release/'portra-backend.jar'), 0o640)
    run('chgrp','portra',str(release/'portra-backend.jar'))
    (release/'deployed-commit.txt').write_text(revision + '\n')
    need(digest(release/'portra-backend.jar') == jar_hash, 'Installed JAR differs')
    activated = False
    try:
        # Both links are switched explicitly; do not assume app.jar follows current.
        link(release, current)
        activated = True
        link(current/'portra-backend.jar', APP/'app.jar')
        run('sudo','-n','/usr/bin/systemctl','restart',SERVICE)
        for attempt in range(18):
            try:
                need(run('systemctl','is-active',SERVICE) == 'active', 'Backend inactive')
                pid = run('systemctl','show',SERVICE,'--property=MainPID','--value')
                need(pid.isdigit() and int(pid)>0 and pid != old_pid, 'New JVM not observed')
                command = Path('/proc')/pid/'cmdline'
                need(b'/opt/portra/app/app.jar' in command.read_bytes().split(b'\0'), 'Unexpected JVM artifact path')
                health(receipt['localHealthUrl'])
                health(receipt['publicHealthUrl'])
                break
            except Exception:
                if attempt == 17:
                    raise
                time.sleep(5)
        need((APP/'app.jar').resolve() == release/'portra-backend.jar' and digest(APP/'app.jar') == jar_hash, 'Running release pointer/hash changed')
        need(str(WEB.resolve()) == web_target and inventory(WEB) == before_web, 'Web assets changed; halt')
        after_uploads = inventory(UPLOADS)
        need(all(after_uploads.get(k) == v for k,v in before_uploads.items()), 'Existing upload changed or missing; halt')
        evidence.update(status='BACKEND_HEALTH_PASS_APP_ACCEPTANCE_PENDING', mainPid=pid, webUnchanged=True, existingUploadsPreserved=True)
        atomic_json(evidence_path, evidence)
        print(json.dumps({k:evidence[k] for k in ('revision','jarSha256','status','mainPid','webUnchanged','existingUploadsPreserved')}))
    except Exception:
        evidence['status'] = 'FAILED_STOPPED_PIPELINE'
        # The pre-migration Main JAR is not automatically a compatible rollback.
        if activated and receipt.get('previousJarCompatibleAfterMigration') is True:
            try:
                need(digest(previous/'portra-backend.jar') == previous_hash, 'Rollback hash changed')
                link(previous, current)
                link(current/'portra-backend.jar', APP/'app.jar')
                run('sudo','-n','/usr/bin/systemctl','restart',SERVICE)
                for attempt in range(18):
                    try:
                        need(run('systemctl','is-active',SERVICE) == 'active', 'Rollback backend inactive')
                        health(receipt['localHealthUrl'])
                        health(receipt['publicHealthUrl'])
                        break
                    except Exception:
                        if attempt == 17:
                            raise
                        time.sleep(5)
                need((APP/'app.jar').resolve() == previous/'portra-backend.jar' and digest(APP/'app.jar') == previous_hash, 'Rollback artifact differs')
                evidence['rollback'] = 'COMPATIBLE_PREVIOUS_RESTORED'
            except Exception:
                evidence['rollback'] = 'FAILED_OPERATOR_REQUIRED'
        else:
            evidence['rollback'] = 'NOT_AUTHORIZED_COMPATIBLE_BINARY_REQUIRED'
        atomic_json(evidence_path, evidence)
        raise


if __name__ == '__main__':
    import fcntl
    # Serialize manual and automated invocations, not just GitHub jobs.
    with open('/home/portra-deploy/state/backend-release.lock','a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        deploy(*sys.argv[1:])
