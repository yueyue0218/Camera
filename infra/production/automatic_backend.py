"""Standing authorization for application-only releases on protected main.

Python 3.6 compatible for the existing ECS. Never modifies policy or database.
"""
import hashlib
import re
import zipfile


def schema_fingerprint(jar, version=2):
    """Bind DB mappings, SQL, configuration, initializers and dependency versions.

    This is a conservative change detector, not proof of semantic compatibility.
    It deliberately requires renewed authorization for changes to these surfaces.
    """
    if type(version) is not int or version not in (1, 2):
        raise RuntimeError('Unsupported schema fingerprint version')
    entries = []
    markers = (b'jakarta/persistence/Entity;', b'jakarta/persistence/Embeddable;',
               b'jakarta/persistence/MappedSuperclass;', b'jakarta/persistence/Converter;',
               b'com/baomidou/mybatisplus/annotation/TableName;')
    with zipfile.ZipFile(str(jar)) as archive:
        for name in sorted(archive.namelist()):
            if name.startswith('BOOT-INF/lib/') and name.endswith('.jar'):
                entries.append((name, b''))
            if not name.startswith('BOOT-INF/classes/') or name.endswith('/'):
                continue
            data = archive.read(name)
            text_resource = name.endswith(('.sql', '.yml', '.yaml', '.properties', '.xml'))
            if (text_resource
                    or 'SchemaInit' in name or '/common/config/' in name
                    or (name.endswith('.class') and any(m in data for m in markers))):
                # Normalize CRLF only in text resources; keep all other bytes,
                # including whitespace, lone CR, class files and library names.
                if version == 2 and text_resource:
                    data = data.replace(b'\r\n', b'\n')
                entries.append((name, data))
    if not entries:
        raise RuntimeError('No schema/configuration evidence in JAR')
    digest = hashlib.sha256()
    for name, data in entries:
        digest.update(name.encode('utf-8') + b'\0')
        digest.update(hashlib.sha256(data).digest())
    return digest.hexdigest()


def validate_policy(policy, jar, host):
    if policy.get('enabled') is not True or policy.get('repository') != 'yueyue0218/Camera':
        raise RuntimeError('Automatic backend deployment is not authorized')
    if policy.get('host') != host:
        raise RuntimeError('Automatic policy host mismatch')
    if policy.get('schemaFingerprint') != schema_fingerprint(jar, policy.get('schemaFingerprintVersion', 1)):
        raise RuntimeError('Schema/configuration/dependencies changed; review and renew automatic policy')
    if not policy.get('databaseIdentity') or not policy.get('backupEvidence'):
        raise RuntimeError('Reviewed database and backup evidence required')
    if policy.get('initialServiceState') != 'active':
        raise RuntimeError('Automatic deployment requires an active baseline')
    if not re.fullmatch(r'http://127\.0\.0\.1:8080/[A-Za-z0-9/_-]+', policy.get('localHealthUrl', '')):
        raise RuntimeError('Invalid automatic local health URL')
    if not re.fullmatch(r'https://[A-Za-z0-9.-]+/[A-Za-z0-9/_-]+', policy.get('publicHealthUrl', '')):
        raise RuntimeError('Invalid automatic public health URL')


def upgrade_policy(policy, current_jar, host):
    """Upgrade only an authorization that still matches the CURRENT live JAR.

    Never derive new authorization from an incoming or failed-release artifact.
    """
    validate_policy(policy, current_jar, host)
    if policy.get('schemaFingerprintVersion', 1) != 1:
        raise RuntimeError('Fingerprint policy is already upgraded')
    updated = dict(policy)
    updated['schemaFingerprintVersion'] = 2
    updated['schemaFingerprint'] = schema_fingerprint(current_jar, 2)
    return updated
