import importlib.util,json,pathlib,tempfile,unittest,subprocess
from unittest.mock import patch

path=pathlib.Path(__file__).resolve().parents[1]/'scripts/turnstile-runtime/remote.py'
spec=importlib.util.spec_from_file_location('turnstile_runtime',path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
WIDGET={'site_key':'0x4'+'A'*20,'allowed_hostnames':['shop.example.invalid'],'mode':'managed'}
RAW=b'# existing private runtime\nNODE_ENV="production"\nSERVER_SECRET="private-synthetic-value"\nNUXT_PUBLIC_PURCHASING_ENABLED="false"\nPDC_LIVE_REQUESTS_ENABLED="false"\n'

class RuntimePatchTests(unittest.TestCase):
 def test_only_two_public_fields_are_added(self):
  result=m.patched_runtime(RAW,WIDGET);self.assertTrue(result.startswith(RAW))
  before=m.env_values(RAW);after=m.env_values(result)
  self.assertEqual({k:v for k,v in after.items() if k not in m.RUNTIME_KEYS},before)
  self.assertEqual(after[m.RUNTIME_KEYS[0]],'turnstile');self.assertEqual(after[m.RUNTIME_KEYS[1]],WIDGET['site_key'])
 def test_existing_empty_values_and_missing_final_newline_are_handled(self):
  raw=RAW+b'NUXT_PUBLIC_AUTH_CAPTCHA_PROVIDER=""\nNUXT_PUBLIC_TURNSTILE_SITE_KEY=""'
  result=m.patched_runtime(raw,WIDGET);self.assertEqual(result.count(b'NUXT_PUBLIC_AUTH_CAPTCHA_PROVIDER='),1)
  self.assertEqual(result.count(b'NUXT_PUBLIC_TURNSTILE_SITE_KEY='),1);self.assertEqual(m.env_values(result)['SERVER_SECRET'],'private-synthetic-value')
 def test_already_configured_values_and_duplicate_keys_stop(self):
  with self.assertRaises(AssertionError):m.patched_runtime(m.patched_runtime(RAW,WIDGET),WIDGET)
  with self.assertRaises(AssertionError):m.patched_runtime(RAW+b'NODE_ENV="test"\n',WIDGET)
 def test_secret_key_extra_fields_injection_and_wrong_widget_mode_stop(self):
  for widget in [{**WIDGET,'secret_key':'never-accepted'},{**WIDGET,'site_key':'bad\nOTHER=true'},{**WIDGET,'allowed_hostnames':['https://shop.example.invalid']},{**WIDGET,'mode':'invisible'}]:
   with self.assertRaises(AssertionError):m.patched_runtime(RAW,widget)
 def test_unexpected_line_endings_stop_without_rewriting_private_bytes(self):
  with self.assertRaises(AssertionError):m.patched_runtime(RAW.replace(b'\n',b'\r\n'),WIDGET)
 def test_atomic_activation_restarts_only_once_and_preserves_other_configuration(self):
  self.activate_fixture(False)
 def test_failed_restart_keeps_stop_evidence_without_automatic_rollback(self):
  self.activate_fixture(True)
 def activate_fixture(self,fail):
  with tempfile.TemporaryDirectory() as directory:
   root=pathlib.Path(directory);stage=root/'stage';stage.mkdir();runtime=root/'runtime.env';runtime.write_bytes(RAW);runtime.chmod(0o600)
   proposed=m.patched_runtime(RAW,WIDGET);before=m.metadata(runtime);seal='a'*64
   p={'seal':seal,'release_id':'b'*16,'runtime':{'proposed_sha256':m.hashlib.sha256(proposed).hexdigest(),'proposed_bytes':len(proposed)},'database_state_sha256':'c'*64,'before':{'current':str(root),'verified':{},'nuxt':{'MainPID':'1'},'caddy':{},'media':{},'private_files':{},'assets':{},'recovery_files':{str(runtime):before}}}
   (stage/'candidate-pass.json').write_text(json.dumps({'result':'PASS','seal':seal,'current_release_unchanged':True}))
   database={'seal':seal,'state_sha256':'c'*64,'schema':94,'read_only':True};commands=[]
   def run(args,**kwargs):
    commands.append(args)
    if fail:raise subprocess.CalledProcessError(1,args)
    return subprocess.CompletedProcess(args,0)
   def inspect(*args,**kwargs):return {**p['before'],'nuxt':{'MainPID':'2'},'recovery_files':{str(runtime):m.metadata(runtime)}}
   with patch.object(m,'unchanged',return_value=(runtime,RAW,proposed)),patch.object(m,'paths',return_value=({'service':'fixture','port':12345},root,stage)),patch.object(m.os,'chown'),patch.object(m.subprocess,'run',side_effect=run),patch.object(m,'probe',return_value=b'{}'),patch.object(m,'inspect',side_effect=inspect):
    if fail:
     with self.assertRaises(subprocess.CalledProcessError):m.activate(p,database)
    else:m.activate(p,database)
    self.assertEqual(runtime.read_bytes(),proposed);self.assertEqual(commands,[['systemctl','restart','fixture.service']])
    self.assertTrue((stage/'activation-intent.json').exists());self.assertTrue((stage/'restart-intent.json').exists())
    with self.assertRaises(FileExistsError):m.activate(p,database)
    self.assertEqual(len(commands),1)

if __name__=='__main__':unittest.main()
