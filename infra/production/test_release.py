import importlib.util
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('deploy',Path(__file__).with_name('deploy-backend.py'))
d=importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)
SHA='a'*40
HASH='b'*64
OLD='c'*64


def receipt():
    return dict(revision=SHA,jarSha256=HASH,previousJarSha256=OLD,host='test-host',expiresAtEpoch=time.time()+600,
                productionDatabaseVerified=True,backupRestoreVerified=True,incrementalSchemaApproved=True,
                appProtocolPassed=True,backupEvidence='existing-reviewed-backup',databaseIdentity='production-uuid/database',
                localHealthUrl='http://127.0.0.1:8080/health',publicHealthUrl='https://portra.example/health')


class ReleaseTests(unittest.TestCase):
    def activation_scenario(self, mode, initial_state='active'):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);app=root/'app';old=app/'releases/old';old.mkdir(parents=True)
            (old/'portra-backend.jar').write_bytes(b'old')
            incoming=root/'incoming';(incoming/SHA).mkdir(parents=True);(incoming/SHA/'backend.jar').write_bytes(b'new')
            web=root/'web';web.mkdir();(web/'index.html').write_bytes(b'web')
            uploads=root/'uploads';uploads.mkdir();(uploads/'photo').write_bytes(b'photo')
            state=root/'state';state.mkdir();live={'target':old,'pid':'100' if initial_state=='active' else '0','state':initial_state}
            original_resolve=Path.resolve;original_link=Path.is_symlink;original_read=Path.read_bytes;original_digest=d.digest
            def resolve(p,*a,**kw):
                if p==app/'current':return live['target']
                if p==app/'app.jar':return live['target']/'portra-backend.jar'
                return original_resolve(p,*a,**kw)
            def symlink(p):return True if p in (app/'current',app/'app.jar') else original_link(p)
            def read(p):return b'java\0-jar\0/opt/portra/app/app.jar\0' if str(p).replace('\\','/').startswith('/proc/') else original_read(p)
            def digest(p):return original_digest(resolve(p)) if p==app/'app.jar' else original_digest(p)
            def link(target,p):
                self.assertIn(p,[app/'current',app/'app.jar'])
                if p==app/'current':live['target']=target
            def command(*args):
                if args[0]=='hostname':return 'test-host'
                if args[:2]==('systemctl','is-active'):return 'active'
                if args[:2]==('systemctl','show'):return live['state'] if '--property=ActiveState' in args else live['pid']
                if args[0]=='chgrp':return ''
                if args[0]=='sudo':live['pid']=str(int(live['pid'])+1);live['state']='active';return ''
                raise AssertionError(args)
            def health(url):
                if mode!='success' and live['target']!=old:raise RuntimeError('unhealthy new backend')
            r=receipt();r.update(jarSha256=digest(incoming/SHA/'backend.jar'),previousJarSha256=digest(old/'portra-backend.jar'),previousJarCompatibleAfterMigration=mode=='compatible',initialServiceState=initial_state)
            with patch.multiple(d,APP=app,WEB=web,UPLOADS=uploads,STATE=state,INCOMING=incoming),patch.object(d,'load_receipt',return_value=r),patch.object(d,'run',side_effect=command),patch.object(d,'link',side_effect=link),patch.object(d,'digest',side_effect=digest),patch.object(d,'health',side_effect=health),patch.object(d.time,'sleep'),patch.object(Path,'resolve',resolve),patch.object(Path,'is_symlink',symlink),patch.object(Path,'read_bytes',read):
                if mode=='success':d.deploy(SHA,r['jarSha256'])
                else:
                    with self.assertRaisesRegex(RuntimeError,'unhealthy'):d.deploy(SHA,r['jarSha256'])
            result=json.loads((state/('backend-release-'+SHA+'.json')).read_text())
            self.assertEqual((web/'index.html').read_bytes(),b'web');self.assertEqual((uploads/'photo').read_bytes(),b'photo')
            if mode=='success':
                self.assertEqual(result['status'],'BACKEND_HEALTH_PASS_APP_ACCEPTANCE_PENDING')
                self.assertTrue(result['webUnchanged']);self.assertTrue(result['existingUploadsPreserved'])
                self.assertEqual(live['target'],app/'releases'/SHA)
            else:
                self.assertEqual(result['status'],'FAILED_STOPPED_PIPELINE')
                self.assertEqual(result['rollback'],'COMPATIBLE_PREVIOUS_RESTORED' if mode=='compatible' else 'NOT_AUTHORIZED_COMPATIBLE_BINARY_REQUIRED')
                self.assertEqual(live['target'],old if mode=='compatible' else app/'releases'/SHA)

    def test_success_tracks_version_pid_hash_and_preserves_web_uploads(self):self.activation_scenario('success')
    def test_approved_maintenance_stopped_backend_activates_without_starting_old_jar(self):self.activation_scenario('success','inactive')
    def test_unhealthy_release_rolls_back_only_with_explicit_compatibility(self):self.activation_scenario('compatible')
    def test_unhealthy_release_never_implicitly_restores_old_main(self):self.activation_scenario('incompatible')

    def test_health_requires_success_status_and_expected_payload(self):
        from unittest.mock import MagicMock
        for body,valid in [(b'{"code":200}',True),(b'{"status":"UP"}',True),(b'{"code":50001}',False),(b'{"status":"DOWN"}',False),(b'not-json',False)]:
            response=MagicMock();response.status=200;response.read.return_value=body
            opener=MagicMock();opener.open.return_value.__enter__.return_value=response
            with self.subTest(body=body),patch.object(d.urllib.request,'build_opener',return_value=opener):
                if valid:d.health('http://127.0.0.1:8080/health')
                else:
                    with self.assertRaises((RuntimeError,ValueError)):d.health('http://127.0.0.1:8080/health')

    def test_exact_artifact_and_baseline_required(self):
        for key,value in [('revision','d'*40),('jarSha256','e'*64),('previousJarSha256','f'*64),
                          ('host','another-host'),('expiresAtEpoch',0)]:
            r=receipt();r[key]=value
            with self.subTest(key=key), patch.object(d,'run',return_value='test-host'), self.assertRaises(RuntimeError):
                d.validate_receipt(r,SHA,HASH,OLD)

    def test_each_database_backup_and_app_gate_is_required(self):
        for key in ('productionDatabaseVerified','backupRestoreVerified','incrementalSchemaApproved','appProtocolPassed','backupEvidence','databaseIdentity'):
            r=receipt();r[key]=False
            with self.subTest(key=key), patch.object(d,'run',return_value='test-host'), self.assertRaises(RuntimeError):
                d.validate_receipt(r,SHA,HASH,OLD)

    def test_valid_receipt_and_http_boundaries(self):
        with patch.object(d,'run',return_value='test-host'):
            d.validate_receipt(receipt(),SHA,HASH,OLD)
            for key,value in [('localHealthUrl','http://127.0.0.1:8081/health'),('publicHealthUrl','http://portra.example/health')]:
                r=receipt();r[key]=value
                with self.subTest(key=key), self.assertRaises(RuntimeError):d.validate_receipt(r,SHA,HASH,OLD)

    def test_asset_inventory_detects_changed_deleted_and_added_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'index.html').write_text('original');(root/'assets').mkdir();(root/'assets/a.js').write_text('a')
            before=d.inventory(root)
            self.assertEqual(before,d.inventory(root))
            (root/'assets/a.js').write_text('changed');self.assertNotEqual(before,d.inventory(root))
            (root/'assets/a.js').unlink();self.assertNotEqual(before,d.inventory(root))
            (root/'assets/a.js').write_text('a');(root/'assets/b.js').write_text('b');self.assertNotEqual(before,d.inventory(root))

    def test_invalid_or_mismatched_upload_stops_before_activation(self):
        with tempfile.TemporaryDirectory() as tmp:
            incoming=Path(tmp);(incoming/SHA).mkdir();(incoming/SHA/'backend.jar').write_bytes(b'wrong')
            with patch.object(d,'INCOMING',incoming),patch.object(d,'load_receipt',return_value=receipt()),patch.object(d,'run') as run:
                with self.assertRaisesRegex(RuntimeError,'hash mismatch'):d.deploy(SHA,HASH)
                run.assert_not_called()

    def test_empty_or_unreadable_preservation_root_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(RuntimeError):d.inventory(Path(tmp))
            with self.assertRaises(RuntimeError):d.inventory(Path(tmp)/'absent')

    def test_failure_does_not_fall_through_and_web_is_read_only(self):
        # Exercise the actual exception/rollback branch without service/filesystem mutations.
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); app=root/'app'; (app/'releases/old').mkdir(parents=True)
            (app/'releases/old/portra-backend.jar').write_bytes(b'old')
            incoming=root/'incoming';(incoming/SHA).mkdir(parents=True);(incoming/SHA/'backend.jar').write_bytes(b'new')
            web=root/'web';web.mkdir();(web/'index.html').write_bytes(b'web-unchanged')
            uploads=root/'uploads';uploads.mkdir();(uploads/'photo').write_bytes(b'user-data')
            state=root/'state';state.mkdir()
            # Windows symlink privileges are not needed: resolve/is_symlink are mocked only for known release links.
            original_resolve=Path.resolve;original_link=Path.is_symlink
            def resolve(p,*a,**kw):
                if p==app/'current':return app/'releases/old'
                if p==app/'app.jar':return app/'releases/old/portra-backend.jar'
                return original_resolve(p,*a,**kw)
            def symlink(p):return True if p in (app/'current',app/'app.jar') else original_link(p)
            r=receipt();r['jarSha256']=d.digest(incoming/SHA/'backend.jar');r['previousJarSha256']=d.digest(app/'releases/old/portra-backend.jar')
            def command(*args):
                if args[0]=='hostname':return 'test-host'
                if args[:2]==('systemctl','is-active'):return 'active'
                if args[:2]==('systemctl','show'):return 'active' if '--property=ActiveState' in args else '100'
                if args[0]=='chgrp':return ''
                if args[0]=='sudo':raise RuntimeError('simulated restart failure')
                raise AssertionError(args)
            with patch.multiple(d,APP=app,WEB=web,UPLOADS=uploads,STATE=state,INCOMING=incoming),patch.object(d,'load_receipt',return_value=r),patch.object(d,'run',side_effect=command),patch.object(d,'link') as link,patch.object(Path,'resolve',resolve),patch.object(Path,'is_symlink',symlink):
                with self.assertRaisesRegex(RuntimeError,'restart failure'):d.deploy(SHA,r['jarSha256'])
                self.assertEqual(link.call_count,2) # No incompatible rollback.
            evidence=json.loads((state/('backend-release-'+SHA+'.json')).read_text())
            self.assertEqual(evidence['status'],'FAILED_STOPPED_PIPELINE')
            self.assertEqual(evidence['rollback'],'NOT_AUTHORIZED_COMPATIBLE_BINARY_REQUIRED')
            self.assertEqual((web/'index.html').read_bytes(),b'web-unchanged')
            self.assertEqual((uploads/'photo').read_bytes(),b'user-data')


if __name__=='__main__':unittest.main(verbosity=2)
