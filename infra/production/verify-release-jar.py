"""Fail closed if final security protocol / Alibaba SMS bytecode is missing."""
import hashlib, json, sys, zipfile
from pathlib import Path
required = ['auth/sms/aliyun/AliyunSdkSmsGateway', 'auth/sms/aliyun/AliyunSmsSender',
            'auth/sms/dypns/DypnsSmsSender', 'auth/service/PhoneSmsService',
            'auth/dto/VerifySmsCodeRequest', 'privacy/service/PrivacyConsentService']
jar = Path(sys.argv[1])
with zipfile.ZipFile(jar) as z:
    entries = {name:z.read('BOOT-INF/classes/com/action/camera/'+name+'.class') for name in required}
    assert b'challengeId' in entries['auth/dto/VerifySmsCodeRequest']
    assert b'ACCOUNT_CONSENT_REQUIRED_ALL_CLIENTS_V1' in entries['privacy/service/PrivacyConsentService']
    assert b'SendSmsRequest' in entries['auth/sms/aliyun/AliyunSdkSmsGateway']
    assert b'SendSmsVerifyCodeRequest' in entries['auth/sms/dypns/DypnsSmsSender']
print(json.dumps({'jarSha256':hashlib.sha256(jar.read_bytes()).hexdigest(),
                  'classes':{k:hashlib.sha256(v).hexdigest() for k,v in entries.items()}}, indent=2))
