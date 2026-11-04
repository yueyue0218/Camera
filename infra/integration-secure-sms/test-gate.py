"""Focused local gate tests; fake fixtures only, no network/server/filesystem mutation."""
import os, runpy, unittest, contextlib, io, base64
from pathlib import Path
from unittest.mock import patch

class GateTests(unittest.TestCase):
    def config(self):
        return dict(SPRING_DATASOURCE_PASSWORD='test-db-only',JWT_SECRET='j'*32,
            PHONE_ENCRYPTION_KEY=base64.b64encode(b'e'*32).decode(),
            PHONE_LOOKUP_HMAC_KEY=base64.b64encode(b'h'*32).decode(),SMS_CODE_PEPPER='p'*32,
            SMS_PROVIDER='dypns',SMS_STAGING_DYPNS_ENABLED='true',SMS_STAGING_ALIYUN_ENABLED='false',
            SMS_DYPNS_ROLE_NAME='PortraSmsEcsRole',SMS_DYPNS_ENDPOINT='dypnsapi.aliyuncs.com',
            SMS_SIGN_NAME='恒创联众',SMS_LOGIN_TEMPLATE_ID='100001',SMS_REAUTH_TEMPLATE_ID='100001',
            SMS_REAUTH_SCHEME_NAME='默认方案',SMS_CODE_TTL='5m',SMS_RESEND_COOLDOWN='60s',
            SPRING_MAIL_HOST='smtp.invalid',SPRING_MAIL_USERNAME='fake',SPRING_MAIL_PASSWORD='fake',
            PORTRA_INDEPENDENT_KEYS_REVIEWED='yes',PORTRA_PNVS_RAM_ROLE_REVIEWED='yes',
            PORTRA_PRIVACY_VERSION_REVIEWED='2026-10-29-v1',PORTRA_SMTP_REVIEWED='yes')
    def run_gate(self, config):
        with patch.dict(os.environ,config,clear=True), contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(Path(__file__).with_name('check-environment.py')),run_name='__main__')
    def test_default_scheme_and_same_template_allowed(self): self.run_gate(self.config())
    def test_scheme_may_be_omitted(self):
        c=self.config(); del c['SMS_REAUTH_SCHEME_NAME']; self.run_gate(c)
    def test_reauth_template_still_required(self):
        c=self.config(); c['SMS_REAUTH_TEMPLATE_ID']=''
        with self.assertRaises(SystemExit): self.run_gate(c)
    def test_overrides_and_static_credentials_still_forbidden(self):
        for key,value in [('CAMERA_DEMO_BYPASS_CODE','123456'),('SPRING_DATASOURCE_URL','jdbc:mysql://other/db'),('JAVA_TOOL_OPTIONS','-Dtest=1'),('SMS_ACCESS_KEY_ID','fake')]:
            with self.subTest(key=key):
                c=self.config(); c[key]=value
                with self.assertRaises(SystemExit): self.run_gate(c)
    def test_smtp_privacy_and_key_gates_remain(self):
        for key in ['SPRING_MAIL_PASSWORD','PORTRA_PRIVACY_VERSION_REVIEWED','PHONE_ENCRYPTION_KEY','SMS_CODE_PEPPER']:
            with self.subTest(key=key):
                c=self.config(); c[key]=''
                with self.assertRaises(SystemExit): self.run_gate(c)
    def test_different_scheme_rejected_in_default_mode(self):
        c=self.config(); c['SMS_REAUTH_SCHEME_NAME']='different'
        with self.assertRaises(SystemExit): self.run_gate(c)

if __name__=='__main__': unittest.main()
