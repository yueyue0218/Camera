#!/usr/bin/python3
"""No SMS/email sends, no credential retrieval or logging. Endpoint/role checks only."""
import os,ssl,socket,smtplib,urllib.request,sys
e=os.environ
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
try:
    request=urllib.request.Request('http://100.100.100.200/latest/api/token',method='PUT',headers={'X-aliyun-ecs-metadata-token-ttl-seconds':'60'})
    with opener.open(request,timeout=5) as response: token=response.read(4096).decode()
    # Listing role names only; never request the per-role credentials endpoint.
    request=urllib.request.Request('http://100.100.100.200/latest/meta-data/ram/security-credentials/',headers={'X-aliyun-ecs-metadata-token':token})
    with opener.open(request,timeout=5) as response: names=response.read(8192).decode().splitlines()
    if e['SMS_DYPNS_ROLE_NAME'] not in names: raise ValueError('role mismatch')
    print('PASS: IMDSv2 configured role attached (no credentials fetched)')
except Exception:
    print('BLOCK: ECS IMDSv2/role attachment check failed; no secrets displayed'); sys.exit(1)
try:
    host=e['SMS_DYPNS_ENDPOINT']
    with socket.create_connection((host,443),timeout=5) as raw:
        with ssl.create_default_context().wrap_socket(raw,server_hostname=host): pass
    print('PASS: PNVS endpoint DNS/TLS reachable; API/template permissions still require operator review')
except Exception:
    print('BLOCK: PNVS endpoint DNS/TLS check failed'); sys.exit(1)
try:
    with smtplib.SMTP(e['SPRING_MAIL_HOST'],int(e.get('SPRING_MAIL_PORT','587')),timeout=5) as smtp:
        smtp.ehlo(); smtp.starttls(context=ssl.create_default_context()); smtp.ehlo()
    print('PASS: SMTP STARTTLS reachable; no login or email send performed')
except Exception:
    print('BLOCK: SMTP STARTTLS check failed'); sys.exit(1)
