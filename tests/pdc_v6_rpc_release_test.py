"""Owned filesystem/phase fault tests. No systemd, SSH, SQL or network service."""
import hashlib,importlib.util,json,pathlib,tempfile,unittest
from unittest.mock import patch
s=importlib.util.spec_from_file_location('pdp_remote','scripts/pdc-v6-rpc-release/remote.py');r=importlib.util.module_from_spec(s);s.loader.exec_module(r)
class PdcV6RpcReleaseTests(unittest.TestCase):
 def test_missing_or_different_approval_never_reaches_target(self):
  for mode in ['prepare','stage','candidate89','activate']:
   for body in [{'plan':{}},{'plan':{'seal':'a'*64},'approved':'b'*64}]:
    with self.subTest(mode=mode,body=body),patch.object(r.sys,'argv',['remote',mode,json.dumps(body)]),patch.object(r,'paths',side_effect=AssertionError('target touched')) as touched:
     with self.assertRaises((KeyError,AssertionError)):r.main()
     touched.assert_not_called()
 def test_scope_cannot_add_a_provider_or_runtime_action(self):
  p={'format':6,'schema_version':90,'migrations':[{'filename':'20261022150000_pdc_lookup_rpc_access.sql','sha256':'c'*64}],'migration_sha256':'c'*64,'database_writes':1,'scope':{'milestone':'pdc_v6_rpc_access','schema':'89 to 90; two original server RPC grants','database_writes':True,'payment_availability_change':False,'runtime_change':False,'caddy_change':False,'provider_calls':True,'public_checkout':False,'signup':False}};p['seal']=r.digest(p)
  for mode in ['prepare','stage','candidate89','activate']:
   with patch.object(r.sys,'argv',['remote',mode,json.dumps({'plan':p,'approved':p['seal']})]),patch.object(r,'paths') as touched:
    with self.assertRaises((KeyError,AssertionError)):r.main()
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
   root=pathlib.Path(directory).resolve();stage=root/'stage';stage.mkdir();p={'seal':'a'*64,'database_state_sha256':'b'*64,'migration_sha256':'c'*64};t={}
   with patch.object(r,'baseline'),patch.object(r,'paths',return_value=(t,root,stage)),patch.object(r.subprocess,'run') as command:
    with self.assertRaises(AssertionError):r.activate(p,{})
    (stage/'candidate-pass.json').write_text('{}')
    with self.assertRaises((KeyError,AssertionError)):r.activate(p,{'schema':87})
    command.assert_not_called();self.assertFalse((stage/'activation-intent.json').exists())
 def test_activation_fault_keeps_evidence_and_never_rolls_back_or_retries(self):
  with tempfile.TemporaryDirectory() as directory:
   root=pathlib.Path(directory).resolve();stage=root/'stage';stage.mkdir();(stage/'candidate-pass.json').write_text('{}');(stage/'candidate90-pass.json').write_text(json.dumps({'schema':90,'ready':True,'migration_sha256':'c'*64,'plan_sha256':'a'*64,'archive_sha256':'d'*64,'inventory_sha256':r.digest([]),'existing_release_unchanged':True}));(stage/'inventory.json').write_text('[]');(root/'releases/old').mkdir(parents=True);(root/'releases/new').mkdir();(root/'current').symlink_to(root/'releases/old')
   p={'seal':'a'*64,'database_state_sha256':'b'*64,'migration_sha256':'c'*64,'release_id':'new','inventory_sha256':r.digest([]),'archive_sha256':'d'*64,'application_commit':'e'*40,'before':{'current':str(root/'releases/old')}};t={'service':'owned'}
   (root/'releases/new/OUTPUT-INVENTORY.json').write_text('[]');(root/'releases/new/VERIFIED.json').write_text(json.dumps({'archive_sha256':p['archive_sha256'],'commit':p['application_commit'],'plan_sha256':p['seal']}))
   sql={'plan_sha256':p['seal'],'schema':90,'migration_sha256':p['migration_sha256'],'preservation':'PASS','read_only':True,'migrations_applied':1,'state_sha256':p['database_state_sha256']}
   with patch.object(r,'baseline'),patch.object(r,'paths',return_value=(t,root,stage)),patch.object(r.subprocess,'run',side_effect=RuntimeError('owned restart failure')) as command:
    with self.assertRaises(RuntimeError):r.activate(p,sql)
    self.assertEqual(command.call_count,1);self.assertEqual((root/'current').resolve(),root/'releases/new');self.assertTrue((stage/'activation-intent.json').is_file());self.assertTrue((stage/'database-readonly-verified.json').is_file())
    with self.assertRaises(FileExistsError):r.activate(p,sql)
    self.assertEqual(command.call_count,1)
 def test_environment_parser_rejects_duplicate_definitions_and_never_sources_shell(self):
  with self.assertRaises(AssertionError):r.env_values(b'PORT=1\nPORT=2\n')
  with self.assertRaises(AssertionError):r.env_values(b'INVALID_KEY=x y\n')
  self.assertEqual(r.env_values(b'KEY="$(touch /must-not-run)"\n')['KEY'],'$(touch /must-not-run)')

 def test_migration_plan_schema_or_write_scope_never_reaches_target(self):
  scope={'milestone':'pdc_v6_rpc_access','schema':'89 to 90; two original server RPC grants','database_writes':True,'payment_availability_change':False,'runtime_change':False,'caddy_change':False,'provider_calls':False,'public_checkout':False,'signup':False}
  for field,value in [('format',0),('format',3),('format',2),('schema_version',89),('migrations',[{'version':'89'}]),('database_writes',0),('database_writes',False)]:
   p={'format':6,'schema_version':90,'migrations':[{'filename':'20261022150000_pdc_lookup_rpc_access.sql','sha256':'c'*64}],'migration_sha256':'c'*64,'database_writes':1,'scope':scope};p[field]=value;p['seal']=r.digest(p)
   with patch.object(r.sys,'argv',['remote','prepare',json.dumps({'plan':p,'approved':p['seal']})]),patch.object(r,'paths') as touched:
    with self.assertRaises((KeyError,AssertionError)):r.main()
    touched.assert_not_called()
 def test_candidate_requires_an_explicit_boolean_phase(self):
  with patch.object(r,'baseline') as target:
   with self.assertRaises(AssertionError):r.candidate({},after=88)
   target.assert_not_called()
 def test_state_and_candidate_proof_must_match_the_approved_plan(self):
  with tempfile.TemporaryDirectory() as directory:
   root=pathlib.Path(directory).resolve();stage=root/'stage';stage.mkdir()
   p={'seal':'a'*64,'database_state_sha256':'b'*64,'migration_sha256':'c'*64,'archive_sha256':'d'*64,'inventory_sha256':'e'*64}
   proof={'schema':90,'ready':True,'migration_sha256':p['migration_sha256'],'plan_sha256':p['seal'],'archive_sha256':p['archive_sha256'],'inventory_sha256':p['inventory_sha256'],'existing_release_unchanged':True}
   sql={'plan_sha256':p['seal'],'schema':90,'migration_sha256':p['migration_sha256'],'preservation':'PASS','read_only':True,'migrations_applied':1,'state_sha256':p['database_state_sha256']}
   for field,value in [('read_only',False),('migrations_applied',0),('state_sha256','f'*64)]:
    (stage/'candidate90-pass.json').write_text(json.dumps(proof));bad={**sql,field:value}
    with patch.object(r,'baseline'),patch.object(r,'paths',return_value=({},root,stage)),patch.object(r.subprocess,'run') as command:
     with self.assertRaises(AssertionError):r.activate(p,bad)
     command.assert_not_called();self.assertFalse((stage/'activation-intent.json').exists())
   for field in ['plan_sha256','archive_sha256','inventory_sha256']:
    (stage/'candidate90-pass.json').write_text(json.dumps({**proof,field:'f'*64}))
    with patch.object(r,'baseline'),patch.object(r,'paths',return_value=({},root,stage)),patch.object(r.subprocess,'run') as command:
     with self.assertRaises(AssertionError):r.activate(p,sql)
     command.assert_not_called();self.assertFalse((stage/'activation-intent.json').exists())

if __name__=='__main__':unittest.main()
