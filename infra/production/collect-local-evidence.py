"""Collect only this task's local patch and results. No commits, pushes or deployment."""
from pathlib import Path
import hashlib,json,subprocess,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[4]
candidate=Path(__file__).resolve().parents[2]
out=candidate/'docs/production/evidence'
out.mkdir(parents=True,exist_ok=True)
changed=[
 'harmony/entry/src/main/ets/model/ApiModels.ets',
 'harmony/entry/src/main/ets/network/ApiService.ets',
 'harmony/entry/src/main/ets/pages/LoginPage.ets',
 'harmony/entry/src/main/ets/privacy/PrivacyApi.ets',
 'harmony/entry/src/main/ets/privacy/PrivacySettingsPage.ets',
 'harmony/tests/network.test.cjs','harmony/tests/privacy-settings-behavior.test.cjs']
new=['harmony/tests/login-challenge.test.cjs','harmony/tests/challenge-real-backend.cjs']
patch=subprocess.check_output(['git','-C',str(root),'diff','--binary','--']+changed)
for name in new:
    result=subprocess.run(['git','-C',str(root),'diff','--no-index','--binary','--','/dev/null',name],capture_output=True)
    if result.returncode not in (0,1):raise RuntimeError('Cannot collect new test patch')
    patch+=result.stdout
(out/'harmony-challengeId.patch').write_bytes(patch)
source_hashes={name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in changed+new}
(out/'app-source-sha256.json').write_text(json.dumps(source_hashes,indent=2)+'\n',encoding='utf-8')
for source,target in [
 (root/'output/backend-only-app-tests.log','app-tests.log'),
 (root/'output/backend-only-app-build.log','app-build.log'),
 (root/'output/portra-protocol-test/app-protocol-result.json','app-real-protocol.json'),
 (root/'output/portra-protocol-test/release-jar-check.json','jar-class-check.json'),
 (candidate/'test-release.log','release-tests.log')]:
    (out/target).write_bytes(source.read_bytes())
backend=root/'output/portra-backend-final-candidate/backend'
totals={k:0 for k in ('tests','failures','errors','skipped')}
for report in (backend/'target/surefire-reports').glob('TEST-*.xml'):
    suite=ET.parse(report).getroot()
    for key in totals:totals[key]+=int(suite.get(key,0))
jar_hash=hashlib.sha256((backend/'target/camera-0.0.1-SNAPSHOT.jar').read_bytes()).hexdigest()
assert jar_hash=='c855e73e0a5a579a910e3d266d2a3c9dfbac6bf71440be37cc38e532ab1432b3'
assert totals==dict(tests=954,failures=0,errors=0,skipped=2)
(out/'backend-existing-evidence.json').write_text(json.dumps({'jarSha256':jar_hash,'existingSurefire':totals,'rerun':False},indent=2)+'\n',encoding='utf-8')
print('LOCAL_PATCH_AND_EVIDENCE_COLLECTED; existing JAR and 952 PASS / 2 SKIP preserved')
