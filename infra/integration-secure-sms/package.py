"""Package an already-built, committed candidate. Never deploys, runs SQL or tests."""
from pathlib import Path
import sys, subprocess, zipfile, hashlib, json, os, tarfile, shutil

templates=Path(__file__).resolve().parent
repo=templates.parents[1]
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
if subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=repo,text=True).strip():
    raise SystemExit('Commit all tracked changes before packaging')
output=Path(sys.argv[1]).resolve()
output.mkdir(parents=True,exist_ok=False)
bundle=output/'bundle'; bundle.mkdir()
for p in templates.iterdir():
    if p.name in ('package.py','README.md','test-gate.py') or not p.is_file(): continue
    text=p.read_text(encoding='utf-8').replace('@COMMIT@',commit).replace('@SHORT_COMMIT@',commit[:8])
    (bundle/p.name).write_text(text,encoding='utf-8',newline='\n')
jar=repo/'backend/target/camera-0.0.1-SNAPSHOT.jar'
shutil.copyfile(jar,bundle/'application.jar')
with zipfile.ZipFile(jar) as z:
    for name in z.namelist():
        if name.startswith(('BOOT-INF/classes/','BOOT-INF/lib/')) and not name.endswith('/'):
            p=bundle/'runtime'/name; p.parent.mkdir(parents=True,exist_ok=True); p.write_bytes(z.read(name))
(bundle/'validator').mkdir()
cp=os.pathsep.join([str(bundle/'runtime/BOOT-INF/classes'),str(bundle/'runtime/BOOT-INF/lib/*')])
subprocess.run(['javac','--release','17','-encoding','UTF-8','-cp',cp,'-d',str(bundle/'validator'),str(bundle/'ValidateJpa.java')],check=True)
shutil.copyfile(repo/'backend/src/main/resources/db/migration/V20261103__sms_challenge_binding.sql',bundle/'REVIEW_ONLY_sms_challenge_binding.sql')
shutil.copyfile(templates/'README.md',bundle/'README.md')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
provenance={'commit':commit,'base_commit':'0603d42acdc8097ca634668c087e0a4cd861b894','jar_sha256':sha(jar),
    'code_mode':'SERVER_GENERATED_LOCAL_CHALLENGE','cloud_check_api_used':False,'server_actions':'NONE',
    'migration':'REVIEW_ONLY_sms_challenge_binding.sql; manual approval required; not executed',
    'expected_jpa_entities':38,'live_mysql_validation':'NOT_RUN','ready_to_start_8081':False}
(bundle/'PROVENANCE.json').write_text(json.dumps(provenance,indent=2),encoding='utf-8')
(bundle/'SHA256SUMS').write_text(''.join(sha(p)+'  '+p.relative_to(bundle).as_posix()+'\n' for p in sorted(bundle.rglob('*')) if p.is_file() and p.name!='SHA256SUMS'),encoding='utf-8')
archive=output/f'portra-8081-{commit[:8]}.tar.gz'
with tarfile.open(archive,'w:gz') as t:
    for p in sorted(bundle.rglob('*')):
        if p.is_file(): t.add(p,arcname=p.relative_to(bundle).as_posix(),recursive=False)
(output/'PACKAGE_SHA256SUMS').write_text(sha(archive)+'  '+archive.name+'\n',encoding='utf-8')
print(json.dumps(provenance,indent=2)); print('PACKAGE_SHA256='+sha(archive))
