import importlib.util,json,pathlib,tempfile,unittest
from unittest.mock import patch

path=pathlib.Path(__file__).resolve().parents[1]/'scripts/inactive-history-release/remote.py'
spec=importlib.util.spec_from_file_location('inactive_remote',path)
remote=importlib.util.module_from_spec(spec);spec.loader.exec_module(remote)

class InactiveRemoteTests(unittest.TestCase):
    def test_foreign_target_path_refused(self):
        for root in ['/tmp/shop','/srv/../etc','/srv/shop/releases/other']:
            with self.assertRaises(AssertionError):remote.paths({'target':{'root':root}})

    def test_old_schema_or_import_certificate_cannot_activate(self):
        with tempfile.TemporaryDirectory() as directory:
            stage=pathlib.Path(directory);(stage/'candidate-pass.json').write_text('{}')
            plan={'target':{},'seal':'a'*64,'expected_after_schema_sha256':'b'*64}
            good={'plan_sha256':plan['seal'],'schema':94,'read_only':True,'migrations_applied':3,'business_data_writes':0,'preservation':'PASS','after_schema_sha256':'b'*64,'history_rows':0,'claims':0,'auth_security_unchanged':True}
            with patch.object(remote,'baseline',lambda p:None),patch.object(remote,'paths',lambda p:({},stage,stage)):
                for changed in [{'schema':91},{'migrations_applied':0},{'business_data_writes':1},{'history_rows':1},{'claims':1},{'auth_security_unchanged':False},{'after_schema_sha256':'c'*64}]:
                    with self.assertRaises(AssertionError):remote.activate(plan,{**good,**changed})

    def test_remote_requires_exact_scope_and_seal_before_mutation(self):
        payload={'plan':{'format':10,'schema_version':91},'approved':'wrong'}
        with patch('sys.argv',['remote.py','activate',json.dumps(payload)]):
            with self.assertRaises(AssertionError):remote.main()

if __name__=='__main__':unittest.main()
