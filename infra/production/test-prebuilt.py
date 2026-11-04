import hashlib,importlib.util,json,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('prebuilt',Path(__file__).with_name('verify-prebuilt.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class TestPrebuilt(unittest.TestCase):
    def test_exact_jar_manifest_tree_and_evidence(self):
        jar=b'tested-jar';sha=hashlib.sha256(jar).hexdigest();tree='a'*40
        manifest=json.dumps({'jarSha256':sha,'backendTree':tree,'tests':{'passed':952,'failed':0,'skipped':2}}).encode();mh=hashlib.sha256(manifest).hexdigest()
        m.verify(jar,manifest,sha,mh,tree)
        for args in [(b'changed',manifest,sha,mh,tree),(jar,manifest+b' ',sha,mh,tree),(jar,manifest,sha,mh,'b'*40)]:
            with self.subTest(args=args),self.assertRaises(ValueError):m.verify(*args)
if __name__=='__main__':unittest.main(verbosity=2)
