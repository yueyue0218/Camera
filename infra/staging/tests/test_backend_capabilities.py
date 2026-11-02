"""Offline regression tests. Never invoke deployment, SSH, MySQL or SMS."""
import ast
import io
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / 'infra/staging/scripts'
SOURCE = (SCRIPTS / 'verify-backend-capabilities.sh').read_text().split("<<'PY'\n", 1)[1].rsplit('\nPY', 1)[0]


class BackendCapabilitiesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'candidate.jar'
        self.entries = {}
        values = {}
        for node in ast.parse(SOURCE).body:
            if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
                try:
                    values[node.targets[0].id] = ast.literal_eval(node.value)
                except ValueError:
                    pass
        for name, markers in values['required'].items():
            self.entries[values['prefix'] + name] = b'\xca\xfe\xba\xbe' + b' '.join(markers)
        for name, entry in values['dependencies'].items():
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, 'w') as jar:
                jar.writestr(entry, b'\xca\xfe\xba\xbe')
            self.entries['BOOT-INF/lib/' + name] = buffer.getvalue()
        for name in ['add_account_cancellation_requests.sql', 'add_privacy_rights_and_consent.sql',
                     'add_demand_interest_targets.sql', 'add_report_result_feedback.sql']:
            self.entries['BOOT-INF/classes/db/migration/' + name] = b'-- fixture'

    def check(self, expected):
        with zipfile.ZipFile(self.path, 'w') as jar:
            for name, data in self.entries.items():
                jar.writestr(name, data)
        result = subprocess.run([sys.executable, '-', str(self.path)], input=SOURCE, text=True, capture_output=True)
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)

    def test_complete_structure_is_accepted(self):
        self.check(0)

    def test_missing_privacy_is_rejected(self):
        del self.entries['BOOT-INF/classes/com/action/camera/privacy/controller/PrivacyController.class']
        self.check(1)

    def test_header_dependent_legacy_privacy_is_rejected(self):
        name = 'BOOT-INF/classes/com/action/camera/privacy/service/PrivacyConsentService.class'
        self.entries[name] = self.entries[name].replace(b'ACCOUNT_CONSENT_REQUIRED_ALL_CLIENTS_V1', b'')
        self.check(1)

    def test_missing_pnvs_dependency_is_rejected(self):
        del self.entries['BOOT-INF/lib/dypnsapi20170525-2.0.0.jar']
        self.check(1)

    def test_fake_sdk_filename_is_rejected(self):
        self.entries['BOOT-INF/lib/credentials-java-1.0.8.jar'] = b'not a library'
        self.check(1)

    def test_old_unfiltered_interest_query_is_rejected(self):
        name = 'BOOT-INF/classes/com/action/camera/servicepackage/repository/ServicePackageInterestRepository.class'
        self.entries[name] = self.entries[name].replace(b"i.targetType = 'SERVICE_PACKAGE'", b'1 = 1')
        self.check(1)

    def test_missing_report_migration_is_rejected(self):
        del self.entries['BOOT-INF/classes/db/migration/add_report_result_feedback.sql']
        self.check(1)

    def test_local_configuration_is_rejected(self):
        self.entries['BOOT-INF/classes/application-local.yml'] = b'secret: fixture'
        self.check(1)

    def test_corrupt_archive_is_rejected(self):
        self.path.write_bytes(b'not a jar')
        result = subprocess.run([sys.executable, '-', str(self.path)], input=SOURCE, text=True, capture_output=True)
        self.assertEqual(result.returncode, 1)

    def test_all_entry_points_guard_before_live_switch(self):
        for name in ['deploy-application.sh', 'deploy-backend.sh']:
            text = (SCRIPTS / name).read_text()
            self.assertLess(text.index('bash "$capability_check" "$source_jar"'), text.index('install -d'))
            self.assertIn('bash "$capability_check" "$previous_', text)
        text = (SCRIPTS / 'rollback-backend.sh').read_text()
        self.assertLess(text.index('bash "$capability_check"'), text.index('atomic_link "$previous_target"'))
        self.assertIn('verify-backend-capabilities.sh install-deployment-scripts.sh',
                      (SCRIPTS / 'install-deployment-scripts.sh').read_text())


if __name__ == '__main__':
    unittest.main()
