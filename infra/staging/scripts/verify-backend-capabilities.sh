#!/usr/bin/env bash
# Offline artifact floor, not a substitute for configuration/behavior acceptance.
set -euo pipefail
python3 - "${1:?backend JAR path is required}" <<'PY'
import io, pathlib, sys, zipfile

prefix = 'BOOT-INF/classes/com/action/camera/'
required = {
    'auth/sms/dypns/DypnsSmsSender.class': [b'ecs_ram_role', b'setDisableIMDSv1', b'REAUTH'],
    'auth/config/StagingSmsConfiguration.class': [b'isStagingDypnsEnabled'],
    'auth/config/SmsProperties.class': [b'reauthTemplateId', b'reauthSchemeName', b'dypnsRoleName'],
    'auth/sms/SmsCloudVerifier.class': [b'verifyCode'],
    'auth/service/PhoneSmsService.class': [b'SmsCloudVerifier'],
    'privacy/controller/PrivacyController.class': [],
    'privacy/service/PrivacyRequestInterceptor.class': [b'requireBusinessConsent'],
    'privacy/service/PrivacyConsentService.class': [b'WITHDRAWN', b'NOT_RECORDED', b'ACCOUNT_CONSENT_REQUIRED_ALL_CLIENTS_V1'],
    'account/service/SelfAccountClosureService.class': [b'REAUTH'],
    'common/ErrorCode.class': [b'PRIVACY_CONSENT_REQUIRED'],
    'demand/controller/DemandInterestController.class': [],
    'demand/service/DemandInterestService.class': [b'DEMAND'],
    'servicepackage/domain/ServicePackageInterest.class': [b'targetType', b'demandId'],
    'servicepackage/repository/ServicePackageInterestRepository.class': [
        b"i.targetType = 'SERVICE_PACKAGE' order by",
        b"i.targetType = 'SERVICE_PACKAGE' and i.createdAt",
        b'findByUserIdAndDemandIdAndTargetType'],
}
dependencies = {
    'dypnsapi20170525-2.0.0.jar': 'com/aliyun/dypnsapi20170525/Client.class',
    'credentials-java-1.0.8.jar': 'com/aliyun/credentials/Client.class',
    'dysmsapi20170525-4.6.0.jar': 'com/aliyun/dysmsapi20170525/Client.class',
}
try:
    with zipfile.ZipFile(sys.argv[1]) as jar:
        names = jar.namelist()
        if len(names) != len(set(names)):
            raise ValueError('duplicate archive entries')
        for name in names:
            if pathlib.PurePosixPath(name).name in {
                'application-local.yml', 'application-local.yaml', 'application-local.properties'
            }:
                raise ValueError('developer override packaged')
        for name, markers in required.items():
            data = jar.read(prefix + name)
            if not data.startswith(b'\xca\xfe\xba\xbe') or any(m not in data for m in markers):
                raise ValueError('capability missing: ' + name)
        for name, entry in dependencies.items():
            with zipfile.ZipFile(io.BytesIO(jar.read('BOOT-INF/lib/' + name))) as library:
                if not library.read(entry).startswith(b'\xca\xfe\xba\xbe'):
                    raise ValueError('invalid SDK: ' + name)
        for name in ['add_account_cancellation_requests.sql', 'add_privacy_rights_and_consent.sql',
                     'add_demand_interest_targets.sql', 'add_report_result_feedback.sql']:
            if not jar.read('BOOT-INF/classes/db/migration/' + name).strip():
                raise ValueError('empty migration: ' + name)
except (OSError, KeyError, ValueError, zipfile.BadZipFile) as error:
    print('BACKEND_CAPABILITIES=FAIL: ' + str(error), file=sys.stderr)
    sys.exit(1)
print('BACKEND_CAPABILITIES=PASS (structural floor only; runtime acceptance still required)')
PY
