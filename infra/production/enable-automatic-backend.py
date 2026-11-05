"""Root-operated one-time opt-in. Run from a reviewed checkout on ECS.

No service restart, sudoers edits, migrations, or GitHub configuration writes.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile

from automatic_backend import schema_fingerprint, validate_policy


def enable():
    parser = argparse.ArgumentParser()
    parser.add_argument('--enable', action='store_true', required=True)
    parser.add_argument('--allow-compatible-rollback', action='store_true',
                        help='Explicitly authorize rollback to the previous schema-compatible JAR')
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise RuntimeError('Run as root after reviewing the current production baseline')
    app = Path('/opt/portra/app')
    current = (app/'current').resolve()
    if current.parent != app/'releases' or (app/'app.jar').resolve() != current/'portra-backend.jar':
        raise RuntimeError('Unexpected release links')
    # Reuse verified baseline metadata, never invent DB/backup approval evidence.
    receipt_path = Path('/etc/portra/releases')/(current.name + '.json')
    for path in [receipt_path] + list(receipt_path.parents):
        meta = path.stat()
        if path.is_symlink() or meta.st_uid != 0 or meta.st_mode & 0o022:
            raise RuntimeError('Baseline approval must be root-owned and not group/world writable')
    receipt = json.loads(receipt_path.read_text())
    import hashlib
    with (current/'portra-backend.jar').open('rb') as stream:
        digest = hashlib.sha256(stream.read()).hexdigest()
    if receipt.get('revision') != current.name or receipt.get('jarSha256') != digest:
        raise RuntimeError('Current JAR does not match the reviewed baseline receipt')
    for key in ('productionDatabaseVerified', 'backupRestoreVerified', 'incrementalSchemaApproved', 'appProtocolPassed'):
        if receipt.get(key) is not True:
            raise RuntimeError('Baseline approval missing: ' + key)
    state = subprocess.check_output(['systemctl', 'is-active', 'portra-backend.service'], universal_newlines=True).strip()
    if state != 'active':
        raise RuntimeError('Baseline backend must be active')
    policy = {key: receipt.get(key) for key in ('localHealthUrl', 'publicHealthUrl', 'databaseIdentity', 'backupEvidence')}
    policy.update(enabled=True, repository='yueyue0218/Camera', host=subprocess.check_output(['hostname'], universal_newlines=True).strip(),
                  initialServiceState='active', baselineRevision=current.name,
                  schemaFingerprint=schema_fingerprint(current/'portra-backend.jar'),
                  previousJarCompatibleAfterMigration=args.allow_compatible_rollback)
    validate_policy(policy, current/'portra-backend.jar', policy['host'])
    # Import the existing no-redirect, TLS-verifying health implementation.
    import importlib.util
    spec = importlib.util.spec_from_file_location('release', str(Path(__file__).with_name('deploy-backend.py')))
    release = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(release)
    release.health(policy['localHealthUrl'])
    release.health(policy['publicHealthUrl'])
    target = Path('/etc/portra/automatic-backend.json')
    if target.exists() or target.is_symlink():
        raise RuntimeError('Policy already exists; review and back it up before renewing it')
    fd, temporary = tempfile.mkstemp(prefix='.automatic-backend-', dir=str(target.parent))
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(policy, stream, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        import grp
        os.chown(temporary, 0, grp.getgrnam('portra-deploy').gr_gid)
        os.chmod(temporary, 0o640)
        os.link(temporary, str(target))
    finally:
        os.unlink(temporary)
    print('Automatic application-only deployment authorized; policy: ' + str(target))


if __name__ == '__main__':
    enable()
