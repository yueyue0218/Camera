#!/usr/bin/python3
"""Read-only localhost checks; no SMS sends, registration, tokens, or business writes."""
import json,urllib.request,subprocess
def require(condition, message):
    if not condition: raise SystemExit('BLOCK: '+message)
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
listeners=subprocess.check_output(['ss','-H','-ltn','sport = :8081'],text=True).splitlines()
require(len(listeners)==1 and listeners[0].split()[3]=='127.0.0.1:8081', '8081 must listen on IPv4 loopback only')
for path in ('/service-packages?page=1&size=1','/demands?page=1&size=1'):
    with opener.open('http://127.0.0.1:8081'+path,timeout=10) as response:
        require(response.status==200, 'HTTP status must be 200')
        body=json.load(response)
    require(body.get('code')==200 and isinstance(body.get('data'),dict), 'Public DB-backed read failed')
    require(body['data'].get('total')==0, 'Expected an empty integration catalog')
    print('PASS public empty catalog: '+path.split('?')[0])
with opener.open('http://127.0.0.1:8081/auth/session',timeout=10) as response:
    body=json.load(response)
require(body.get('code')==40101, 'Anonymous session must be rejected (HTTP 200 alone is not health)')
print('PASS: anonymous auth denied; loopback binding; public DB reads. SMS/login/consent flow NOT tested.')
