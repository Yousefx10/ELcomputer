import importlib.util,json,os,pathlib,subprocess,unittest
s=importlib.util.spec_from_file_location('recovery',pathlib.Path(__file__).with_name('remote.py'));r=importlib.util.module_from_spec(s);s.loader.exec_module(r)
BEFORE='route {\n        respond @private "Not found" 404\n        reverse_proxy 127.0.0.1:3000\n}\n'
class Patch(unittest.TestCase):
 def test_only_asset_block_added(self):
  root='/srv/cedar-store';release='a'*16;v=r.patch(BEFORE,root,release);block=r.assets_block(root+'/current/public',root+'/releases/'+release+'/public');self.assertEqual(v.replace(block,'',1),BEFORE)
 def test_api_paths_never_in_added_block(self):
  b=r.assets_block('/srv/cedar-store/current/public','/srv/cedar-store/releases/'+'a'*16+'/public');self.assertNotIn('/api/',b);self.assertIn('method GET HEAD',b);self.assertIn('path /_nuxt/*',b)
 def test_both_file_servers_have_explicit_roots(self):
  b=r.assets_block('/srv/cedar-store/current/public','/srv/cedar-store/releases/'+'a'*16+'/public');self.assertEqual(b.count('file_server {'),2);self.assertEqual(b.count('                    root '),2);self.assertNotIn('root *',b)
 def test_unexpected_anchor_denied(self):
  with self.assertRaises(AssertionError):r.patch('route {}','/srv/cedar-store','a'*16)
 def test_duplicate_anchor_denied(self):
  with self.assertRaises(AssertionError):r.patch(BEFORE+BEFORE,'/srv/cedar-store','a'*16)
 def test_reapplication_denied(self):
  with self.assertRaises(AssertionError):r.patch(r.patch(BEFORE,'/srv/cedar-store','a'*16),'/srv/cedar-store','a'*16)
 def test_invalid_root_denied(self):
  for root in ['/etc','/srv/store/../private','/srv/cedar-store\nfile_server /']:
   with self.assertRaises(AssertionError):r.patch(BEFORE,root,'a'*16)
 def test_other_deployment_supported(self):
  v=r.patch(BEFORE,'/srv/pine-store','b'*16);self.assertIn('/srv/pine-store/current/public',v);self.assertNotIn('cedar',v)
 def test_no_migration_or_money_authority(self):
  self.assertEqual(r.SCOPE['migrations'],0);self.assertEqual(r.SCOPE['database_writes'],0);self.assertEqual(r.SCOPE['provider_calls'],0);self.assertFalse(r.SCOPE['purchasing'])
 def test_actual_candidate_adapter_has_only_loopback_listeners(self):
  cfg=r.candidate_config({'target':{'root':'/srv/cedar-store'}},pathlib.Path('/srv/cedar-store/releases/'+'a'*16),[3100,3101])
  result=subprocess.run([os.environ['CADDY_REVIEW_BINARY'],'adapt','--adapter','caddyfile','--config','-'],input=cfg,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True)
  value=json.loads(result.stdout);servers=value['apps']['http']['servers'];self.assertTrue(servers)
  for server in servers.values():self.assertEqual(server['listen'],['127.0.0.1:3101'])
  self.assertTrue(value['admin']['disabled']);self.assertFalse(value['admin']['config']['persist']);self.assertNotIn('tls',value.get('apps',{}))
if __name__=='__main__':unittest.main()
