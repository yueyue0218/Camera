"""Bind the previously tested JAR to the exact backend tree of this release."""
import hashlib,json,subprocess,sys
from pathlib import Path

def verify(jar,manifest,expected_jar,expected_manifest,tree):
    if hashlib.sha256(jar).hexdigest()!=expected_jar:raise ValueError('JAR differs from approved tested artifact')
    if hashlib.sha256(manifest).hexdigest()!=expected_manifest:raise ValueError('Build manifest differs from approval')
    record=json.loads(manifest)
    if record.get('jarSha256')!=expected_jar or record.get('backendTree')!=tree:
        raise ValueError('Tested JAR does not match release backend source tree')
    if record.get('tests')!={'passed':952,'failed':0,'skipped':2}:
        raise ValueError('Expected frozen candidate test evidence missing')
    return record

if __name__=='__main__':
    jar,manifest,expected_jar,expected_manifest=sys.argv[1:]
    tree=subprocess.check_output(['git','rev-parse','HEAD:backend'],universal_newlines=True).strip()
    verify(Path(jar).read_bytes(),Path(manifest).read_bytes(),expected_jar,expected_manifest,tree)
    print('PASS approved immutable JAR, build manifest and exact backend tree')
