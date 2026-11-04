#!/usr/bin/python3
"""Validate environment supplied by systemd without printing its values."""
import os,base64,sys
e=os.environ
errors=[]
def require(name):
    v=e.get(name,'')
    if not v.strip() or v.startswith(('REPLACE','CHANGE','TODO')): errors.append(name+': missing/placeholder')
    return v
for n in ('SPRING_DATASOURCE_PASSWORD','JWT_SECRET','SMS_CODE_PEPPER','SMS_DYPNS_ROLE_NAME','SMS_SIGN_NAME','SMS_LOGIN_TEMPLATE_ID','SMS_REAUTH_TEMPLATE_ID','SPRING_MAIL_HOST','SPRING_MAIL_USERNAME','SPRING_MAIL_PASSWORD'):
    require(n)
for n in ('PHONE_ENCRYPTION_KEY','PHONE_LOOKUP_HMAC_KEY'):
    try:
        if len(base64.b64decode(require(n),validate=True))!=32: raise ValueError()
    except Exception: errors.append(n+': must be Base64 of 32 bytes')
for n in ('JWT_SECRET','SMS_CODE_PEPPER'):
    if len(e.get(n,'').encode())<32: errors.append(n+': require at least 32 bytes')
secrets=[e.get(n,'') for n in ('JWT_SECRET','PHONE_ENCRYPTION_KEY','PHONE_LOOKUP_HMAC_KEY','SMS_CODE_PEPPER')]
if len(set(secrets))!=4: errors.append('Identity/JWT/SMS secrets must be independent')
for n,want in {'SMS_PROVIDER':'dypns','SMS_STAGING_DYPNS_ENABLED':'true','SMS_STAGING_ALIYUN_ENABLED':'false','SMS_DYPNS_ENDPOINT':'dypnsapi.aliyuncs.com','SMS_CODE_TTL':'5m','SMS_RESEND_COOLDOWN':'60s','PORTRA_INDEPENDENT_KEYS_REVIEWED':'yes','PORTRA_PNVS_RAM_ROLE_REVIEWED':'yes','PORTRA_PRIVACY_VERSION_REVIEWED':'2026-10-29-v1','PORTRA_SMTP_REVIEWED':'yes'}.items():
    if e.get(n)!=want: errors.append(n+': missing or unexpected value')
if e.get('SMS_REAUTH_SCHEME_NAME') not in (None,'','默认方案'): errors.append('Custom-code mode uses the default scheme for both purposes')
for n in ('CAMERA_DEMO_BYPASS_CODE','JAVA_TOOL_OPTIONS','_JAVA_OPTIONS','JDK_JAVA_OPTIONS','SPRING_APPLICATION_JSON','SPRING_PROFILES_INCLUDE','SPRING_CONFIG_IMPORT','SPRING_CONFIG_LOCATION','SPRING_CONFIG_ADDITIONAL_LOCATION','SMS_ACCESS_KEY_ID','SMS_ACCESS_KEY_SECRET','ALIBABA_CLOUD_ACCESS_KEY_ID','ALIBABA_CLOUD_ACCESS_KEY_SECRET'):
    if e.get(n): errors.append(n+': forbidden override/static credential')
if e.get('SPRING_PROFILES_ACTIVE') not in (None,'','staging,integration','integration,staging'): errors.append('SPRING_PROFILES_ACTIVE: require staging,integration')
for n,v in e.items():
    # Do not let EnvironmentFile override the reviewed non-secret application config.
    if n.startswith(('SERVER_','CAMERA_','FILE_STORAGE_','SPRING_JPA_','SPRING_SQL_','SPRING_DATASOURCE_','SPRING_CONFIG_','SPRING_PROFILES_')) and n not in ('SPRING_DATASOURCE_PASSWORD','SPRING_PROFILES_ACTIVE'):
        errors.append(n+': remove conflicting override; fixed config owns this setting')
if errors:
    print('\n'.join('BLOCK: '+x for x in sorted(set(errors)))); sys.exit(1)
print('ENVIRONMENT_FORMAT_PASS: values redacted; operator attestations are not external-service tests')
