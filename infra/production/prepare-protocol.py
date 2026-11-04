"""Extract the existing final JAR for isolated protocol tests. Never rebuild candidate."""
from pathlib import Path
import hashlib, json, os, sys, zipfile
import xml.etree.ElementTree as ET
root = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
out.mkdir(parents=True, exist_ok=True)
jar = root / 'backend/target/camera-0.0.1-SNAPSHOT.jar'
with zipfile.ZipFile(jar) as z:
    for name in z.namelist():
        if name.startswith('BOOT-INF/classes/') and not name.endswith('/'):
            target = out/'jar-classes'/name.removeprefix('BOOT-INF/classes/')
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(z.read(name))
    required = ['auth/sms/aliyun/AliyunSdkSmsGateway','auth/sms/aliyun/AliyunSmsSender',
                'auth/sms/dypns/DypnsSmsSender','auth/dto/VerifySmsCodeRequest','privacy/service/PrivacyConsentService']
    classes = {n: hashlib.sha256(z.read('BOOT-INF/classes/com/action/camera/'+n+'.class')).hexdigest() for n in required}
report = next((root/'backend/target/surefire-reports').glob('TEST-*.xml'))
props = {p.attrib['name']:p.attrib['value'] for p in ET.parse(report).getroot().find('properties')}
cp = props['java.class.path'].split(os.pathsep)
# JAR bytecode comes first; the existing test config supplies only isolated H2 configuration.
cp = [str(out/'jar-classes')] + [p for p in cp if Path(p).resolve() != root/'backend/target/classes']
# Spring config must use test resources instead of application.yml embedded in the JAR.
config = out/'config'
config.mkdir(exist_ok=True)
(config/'application.yml').write_bytes((root/'backend/src/test/resources/application.yml').read_bytes())
(out/'classpath.txt').write_text(os.pathsep.join(cp),encoding='utf-8')
(out/'jar-evidence.json').write_text(json.dumps({'jarSha256':hashlib.sha256(jar.read_bytes()).hexdigest(),'requiredClasses':classes},indent=2),encoding='utf-8')
print('EXISTING_JAR_EXTRACTED; required classes present; no candidate writes')
