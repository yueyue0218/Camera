import copy
import tempfile
import unittest
import zipfile
from pathlib import Path

from automatic_backend import schema_fingerprint, validate_policy


class AutomaticBackendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.jar = Path(self.tmp.name)/'app.jar'
        self.write_jar()
        self.policy = dict(enabled=True, repository='yueyue0218/Camera', host='ecs',
                           schemaFingerprint=schema_fingerprint(self.jar),
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


if __name__ == '__main__':
    unittest.main(verbosity=2)
