import copy
import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from automatic_backend import schema_fingerprint, validate_policy, upgrade_policy


class AutomaticBackendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.jar = Path(self.tmp.name)/'app.jar'
        self.write_jar()
        self.policy = dict(enabled=True, repository='yueyue0218/Camera', host='ecs',
                           schemaFingerprint=schema_fingerprint(self.jar),
                           schemaFingerprintVersion=2,
                           databaseIdentity='reviewed-db', backupEvidence='reviewed-backup',
                           initialServiceState='active', localHealthUrl='http://127.0.0.1:8080/demands',
                           publicHealthUrl='https://portra.example/service-packages')

    def write_jar(self, config=b'spring: {}', entity=b'jakarta/persistence/Entity;mapping',
                  service=b'application-only', sql=b'CREATE TABLE t(id int)', dependency='driver-1.jar', initializer=b'init'):
        with zipfile.ZipFile(str(self.jar), 'w') as archive:
            for name, data in {
                'BOOT-INF/classes/application.yml': config,
                'BOOT-INF/classes/db/schema.sql': sql,
                'BOOT-INF/classes/com/example/User.class': entity,
                'BOOT-INF/classes/com/example/Service.class': service,
                'BOOT-INF/classes/com/example/SchemaInitializer.class': initializer,
                'BOOT-INF/lib/'+dependency: b'library',
            }.items():
                archive.writestr(name, data)

    def test_application_only_change_preserves_authorized_fingerprint(self):
        self.write_jar(service=b'new-business-code')
        validate_policy(self.policy, self.jar, 'ecs')

    def test_schema_config_initializer_and_dependency_changes_require_review(self):
        for change in [dict(config=b'changed'), dict(entity=b'jakarta/persistence/Entity;new-field'),
                       dict(sql=b'ALTER TABLE t ADD secret int'), dict(dependency='driver-2.jar'),
                       dict(initializer=b'new-init')]:
            with self.subTest(change=change):
                self.write_jar(**change)
                with self.assertRaisesRegex(RuntimeError, 'changed'):
                    validate_policy(self.policy, self.jar, 'ecs')

    def test_missing_authorization_or_evidence_and_wrong_host_fail_closed(self):
        for key, value in [('enabled', False), ('repository', 'another/repo'), ('host', 'other'),
                           ('databaseIdentity', ''), ('backupEvidence', ''), ('initialServiceState', 'inactive'),
                           ('localHealthUrl', 'http://127.0.0.1:8081/demands'),
                           ('publicHealthUrl', 'http://portra.example/demands')]:
            policy = copy.deepcopy(self.policy)
            policy[key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                validate_policy(policy, self.jar, 'ecs')

    def test_packed_entry_order_does_not_change_fingerprint(self):
        original = schema_fingerprint(self.jar)
        with zipfile.ZipFile(str(self.jar)) as archive:
            entries = [(name, archive.read(name)) for name in reversed(archive.namelist())]
        with zipfile.ZipFile(str(self.jar), 'w') as archive:
            for name, data in entries:
                archive.writestr(name, data)
        self.assertEqual(original, schema_fingerprint(self.jar))

    def test_v1_policy_upgrade_accepts_crlf_only_changes_without_reauthorizing_new_code(self):
        self.write_jar(config=b'spring:\r\n  datasource: {}\r\n', sql=b'CREATE TABLE t(\r\n id int\r\n)')
        legacy = dict(self.policy)
        del legacy['schemaFingerprintVersion']
        legacy['schemaFingerprint'] = schema_fingerprint(self.jar, 1)
        validate_policy(legacy, self.jar, 'ecs')
        upgraded = upgrade_policy(legacy, self.jar, 'ecs')
        self.assertEqual(upgraded['schemaFingerprintVersion'], 2)
        for key in legacy:
            if key != 'schemaFingerprint':
                self.assertEqual(legacy[key], upgraded[key])
        self.write_jar(config=b'spring:\n  datasource: {}\n', sql=b'CREATE TABLE t(\n id int\n)')
        with self.assertRaisesRegex(RuntimeError, 'changed'):
            validate_policy(legacy, self.jar, 'ecs') # Legacy rules remain strict until explicitly upgraded.
        validate_policy(upgraded, self.jar, 'ecs')
        with self.assertRaisesRegex(RuntimeError, 'changed'):
            upgrade_policy(legacy, self.jar, 'ecs') # Incoming different bytes cannot renew baseline approval.

    def test_every_text_resource_type_normalizes_crlf_but_preserves_content(self):
        for extension in ['sql', 'yml', 'yaml', 'properties', 'xml']:
            with self.subTest(extension=extension):
                def jar_with(data):
                    with zipfile.ZipFile(str(self.jar), 'w') as z:
                        z.writestr('BOOT-INF/classes/contract.' + extension, data)
                jar_with(b'line1\r\nline2\r\n')
                raw = schema_fingerprint(self.jar, 1)
                normalized = schema_fingerprint(self.jar, 2)
                jar_with(b'line1\nline2\n')
                self.assertNotEqual(raw, schema_fingerprint(self.jar, 1))
                self.assertEqual(normalized, schema_fingerprint(self.jar, 2))
                for changed in [b'line1\nline3\n', b'line1\n line2\n', b'line1\rline2\n']:
                    jar_with(changed)
                    self.assertNotEqual(normalized, schema_fingerprint(self.jar, 2))

    def test_class_bytecode_is_never_newline_normalized(self):
        self.write_jar(entity=b'jakarta/persistence/Entity;\r\n')
        original = schema_fingerprint(self.jar, 2)
        self.write_jar(entity=b'jakarta/persistence/Entity;\n')
        self.assertNotEqual(original, schema_fingerprint(self.jar, 2))

    def test_unknown_fingerprint_version_fails_closed(self):
        for version in [0, 3, True, '2', 2.0]:
            policy = dict(self.policy, schemaFingerprintVersion=version)
            with self.subTest(version=version), self.assertRaisesRegex(RuntimeError, 'version'):
                validate_policy(policy, self.jar, 'ecs')

    def test_already_upgraded_policy_is_not_silently_replaced(self):
        with self.assertRaisesRegex(RuntimeError, 'already upgraded'):
            upgrade_policy(self.policy, self.jar, 'ecs')


class PolicyUpgradeFileTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.app = self.root/'app'
        self.current = self.app/'releases'/'reviewed-baseline'
        self.current.mkdir(parents=True)
        (self.app/'current').symlink_to(self.current)
        self.jar = self.current/'portra-backend.jar'
        with zipfile.ZipFile(str(self.jar), 'w') as z:
            z.writestr('BOOT-INF/classes/application.yml', b'spring:\r\n  datasource: {}\r\n')
        self.policy = dict(enabled=True, repository='yueyue0218/Camera', host='ecs',
                           schemaFingerprint=schema_fingerprint(self.jar, 1),
                           databaseIdentity='reviewed-db', backupEvidence='reviewed-backup',
                           initialServiceState='active', previousJarCompatibleAfterMigration=False,
                           localHealthUrl='http://127.0.0.1:8080/demands',
                           publicHealthUrl='https://portra.example/service-packages')
        self.target = self.root/'automatic-backend.json'
        self.target.write_text(json.dumps(self.policy))
        self.target.chmod(0o640)
        self.original_bytes = self.target.read_bytes()
        spec = importlib.util.spec_from_file_location('enable_auto', Path(__file__).with_name('enable-automatic-backend.py'))
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)

    def run_upgrade(self, fail_health=False):
        def health(url):
            if fail_health:
                raise RuntimeError('health failed')
        helpers = SimpleNamespace(load_receipt=lambda p: json.loads(p.read_text()), health=health)
        def command(args, **kwargs):
            return 'ecs' if args == ['hostname'] else 'active'
        with patch.object(self.module, 'release_helpers', return_value=helpers), \
             patch.object(self.module.subprocess, 'check_output', side_effect=command), \
             patch.object(self.module.os, 'chown') as chown:
            self.module.upgrade_fingerprint(self.app, self.current, self.target)
            return chown.call_args

    def test_atomic_upgrade_backs_up_policy_and_preserves_other_permissions_and_settings(self):
        meta = self.target.stat()
        args = self.run_upgrade()
        updated = json.loads(self.target.read_text())
        expected = upgrade_policy(self.policy, self.jar, 'ecs')
        self.assertEqual(updated, expected)
        self.assertEqual(self.target.stat().st_mode & 0o777, 0o640)
        self.assertEqual(args[0][1:], (meta.st_uid, meta.st_gid))
        backups = list(self.root.glob('automatic-backend.v1-*.json'))
        self.assertEqual(len(backups), 1)
        self.assertEqual(json.loads(backups[0].read_text()), self.policy)
        self.assertEqual(backups[0].stat().st_mode & 0o777, 0o600)
        self.assertFalse(list(self.root.glob('.automatic-backend-v2-*')))

    def test_unhealthy_baseline_leaves_policy_untouched(self):
        with self.assertRaisesRegex(RuntimeError, 'health failed'):
            self.run_upgrade(fail_health=True)
        self.assertEqual(self.target.read_bytes(), self.original_bytes)
        self.assertFalse(list(self.root.glob('automatic-backend.v1-*')))

    def test_unrecognized_current_jar_cannot_renew_authorization(self):
        with zipfile.ZipFile(str(self.jar), 'w') as z:
            z.writestr('BOOT-INF/classes/application.yml', b'spring: changed')
        with self.assertRaisesRegex(RuntimeError, 'changed'):
            self.run_upgrade()
        self.assertEqual(self.target.read_bytes(), self.original_bytes)


if __name__ == '__main__':
    unittest.main(verbosity=2)
