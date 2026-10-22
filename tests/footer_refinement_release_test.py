"""Owned filesystem/phase fault tests. No systemd, SSH, SQL or network service."""
import hashlib,importlib.util,json,pathlib,tempfile,unittest
from unittest.mock import patch
s=importlib.util.spec_from_file_location('footer_remote','scripts/footer-refinement-release/remote.py');r=importlib.util.module_from_spec(s);s.loader.exec_module(r)
class FooterReleaseTests(unittest.TestCase):
 def test_missing_or_different_approval_never_reaches_target(self):
  for mode in ['prepare','stage','candidate','activate']:
   for body in [{'plan':{}},{'plan':{'seal':'a'*64},'approved':'b'*64}]:
    with self.subTest(mode=mode,body=body),patch.object(r.sys,'argv',['remote',mode,json.dumps(body)]),patch.object(r,'paths',side_effect=AssertionError('target touched')) as touched:
     with self.assertRaises((KeyError,AssertionError)):r.main()
     touched.assert_not_called()
 def test_scope_cannot_add_a_provider_or_runtime_action(self):
  p={'scope':{'schema':'88 unchanged','database_writes':False,'payment_availability_change':False,'runtime_change':False,'caddy_change':False,'provider_calls':True,'public_checkout':False,'signup':False}};p['seal']=r.digest(p)
  for mode in ['prepare','stage','candidate','activate']:
   with patch.object(r.sys,'argv',['remote',mode,json.dumps({'plan':p,'approved':p['seal']})]),patch.object(r,'paths') as touched:
    with self.assertRaises(AssertionError):r.main()
    touched.assert_not_called()
 def test_output_rejects_extra_file_hash_mode_and_escaping_link(self):
  with tempfile.TemporaryDirectory() as directory:
   root=pathlib.Path(directory).resolve();(root/'server').mkdir();(root/'server').chmod(0o755);f=root/'server/index.mjs';f.write_bytes(b'owned');f.chmod(0o644)
   for name in ['VERIFIED.json','OUTPUT-INVENTORY.json']:(root/name).write_text('{}')
   entries=[{'path':'server','type':'directory','mode':0o755},{'path':'server/index.mjs','type':'file','mode':0o644,'size':5,'sha256':r.sha(f)}]
   r.verify_output(root,entries)
   (root/'extra').write_text('extra')
   with self.assertRaises(AssertionError):r.verify_output(root,entries)
   (root/'extra').unlink();f.write_bytes(b'other')
   with self.assertRaises(AssertionError):r.verify_output(root,entries)
   f.write_bytes(b'owned');f.chmod(0o666)
   with self.assertRaises(AssertionError):r.verify_output(root,entries)
   f.unlink();f.symlink_to('/tmp')
   with self.assertRaises(AssertionError):r.verify_output(root,entries)
 def test_activation_refuses_missing_candidate_or_uncommitted_database(self):
  with tempfile.TemporaryDirectory() as directory:
   root=pathlib.Path(directory).resolve();stage=root/'stage';stage.mkdir();p={'seal':'a'*64,'database_state_sha256':'b'*64};t={}
   with patch.object(r,'baseline'),patch.object(r,'paths',return_value=(t,root,stage)),patch.object(r.subprocess,'run') as command:
    with self.assertRaises(AssertionError):r.activate(p,{})
    (stage/'candidate-pass.json').write_text('{}')
    with self.assertRaises((KeyError,AssertionError)):r.activate(p,{'schema':87})
    command.assert_not_called();self.assertFalse((stage/'activation-intent.json').exists())
 def test_activation_fault_keeps_evidence_and_never_rolls_back_or_retries(self):
  with tempfile.TemporaryDirectory() as directory:
   root=pathlib.Path(directory).resolve();stage=root/'stage';stage.mkdir();(stage/'candidate-pass.json').write_text('{}');(root/'releases/old').mkdir(parents=True);(root/'releases/new').mkdir();(root/'current').symlink_to(root/'releases/old')
   p={'seal':'a'*64,'database_state_sha256':'b'*64,'release_id':'new','before':{'current':str(root/'releases/old')}};t={'service':'owned'}
   sql={'plan_sha256':p['seal'],'schema':88,'read_only':True,'state_sha256':p['database_state_sha256']}
   with patch.object(r,'baseline'),patch.object(r,'paths',return_value=(t,root,stage)),patch.object(r.subprocess,'run',side_effect=RuntimeError('owned restart failure')) as command:
    with self.assertRaises(RuntimeError):r.activate(p,sql)
    self.assertEqual(command.call_count,1);self.assertEqual((root/'current').resolve(),root/'releases/new');self.assertTrue((stage/'activation-intent.json').is_file());self.assertTrue((stage/'database-readonly-verified.json').is_file())
    with self.assertRaises(FileExistsError):r.activate(p,sql)
    self.assertEqual(command.call_count,1)
 def test_environment_parser_rejects_duplicate_definitions_and_never_sources_shell(self):
  with self.assertRaises(AssertionError):r.env_values(b'PORT=1\nPORT=2\n')
  with self.assertRaises(AssertionError):r.env_values(b'INVALID_KEY=x y\n')
  self.assertEqual(r.env_values(b'KEY="$(touch /must-not-run)"\n')['KEY'],'$(touch /must-not-run)')
if __name__=='__main__':unittest.main()
