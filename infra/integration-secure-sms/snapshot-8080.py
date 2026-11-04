#!/usr/bin/python3
"""Only reads existing service state and an anonymous session endpoint."""
import subprocess,json,urllib.request,urllib.error
props=('ActiveState','SubState','MainPID','ExecMainStartTimestampMonotonic','NRestarts')
args=['systemctl','show','portra-backend.service']
for p in props: args+=['-p',p]
state=dict(line.split('=',1) for line in subprocess.check_output(args,text=True).splitlines())
if state.get('ActiveState')!='active' or state.get('SubState')!='running' or int(state.get('MainPID','0'))<=0:
    raise SystemExit('BLOCK: existing 8080 service is not active/running; do not alter it')
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
try:
    response=opener.open('http://127.0.0.1:8080/auth/session',timeout=5)
except urllib.error.HTTPError as error:
    response=error
with response:
    body=response.read(65536)
    state['anonymous_http_status']=response.status
try: state['anonymous_business_code']=json.loads(body).get('code')
except (ValueError,AttributeError): state['anonymous_business_code']=None
if state['anonymous_http_status']>=500: raise SystemExit('BLOCK: existing 8080 endpoint returned server error')
print(json.dumps(state,sort_keys=True))
