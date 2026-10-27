"""Disposable filesystem tests only; never invoke the target inspector or systemd."""
import copy,hashlib,importlib.util,io,json,pathlib,tarfile,tempfile,unittest
s=importlib.util.spec_from_file_location('remote',pathlib.Path(__file__).with_name('remote.py'));r=importlib.util.module_from_spec(s);s.loader.exec_module(r)
class Extraction(unittest.TestCase):
 def fixture(self,root,mutate=lambda x:x):
  items=[('application','dir',b'',0o755),('application/server','dir',b'',0o755),('application/server/index.mjs','file',b'export {}',0o644)]
  items=mutate(items);p=root/'archive.tar.gz'
  with tarfile.open(p,'w:gz') as t:
   for name,kind,data,mode in items:
    m=tarfile.TarInfo(name);m.mode=mode;m.type=tarfile.DIRTYPE if kind=='dir' else tarfile.REGTYPE;m.size=len(data);t.addfile(m,io.BytesIO(data))
  inventory=[{'path':'','type':'directory','mode':0o755},{'path':'server','type':'directory','mode':0o755},{'path':'server/index.mjs','type':'file','mode':0o644,'size':9,'sha256':hashlib.sha256(b'export {}').hexdigest()}]
  return p,inventory
 def test_exact_application_root(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);p,v=self.fixture(root);r.extract_release(p,root/'out',v);self.assertEqual((root/'out/server/index.mjs').read_bytes(),b'export {}')
 def denied(self,mutate=lambda x:x,edit=lambda x:x):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);p,v=self.fixture(root,mutate)
   with self.assertRaises((AssertionError,KeyError)):r.extract_release(p,root/'out',edit(v))
   self.assertFalse((root/'out/server/index.mjs').exists())
 def test_wrong_layout(self):self.denied(lambda rows:[(n.replace('application','wrong',1),*rest) for n,*rest in rows])
 def test_traversal(self):self.denied(lambda rows:rows+[('application/../escape','file',b'x',0o644)])
 def test_duplicate(self):self.denied(lambda rows:rows+[rows[-1]])
 def test_extra_file(self):self.denied(lambda rows:rows+[('application/extra','file',b'x',0o644)])
 def test_missing_file(self):self.denied(lambda rows:rows[:-1])
 def test_wrong_hash(self):self.denied(edit=lambda rows:[{**x,'sha256':'0'*64} if x['type']=='file' else x for x in rows])
 def test_writable_file(self):self.denied(lambda rows:[(n,k,b,0o666 if k=='file' else m) for n,k,b,m in rows])
 def test_environment_duplicate_rejected(self):
  with self.assertRaises(AssertionError):r.env_values(b'A="one"\nA="two"\n')
 def test_accepted_scope_is_inactive95(self):
  self.assertEqual(r.APPLICATION_SCOPE['schema'],'94->95');self.assertFalse(r.APPLICATION_SCOPE['runtime_change']);self.assertFalse(r.APPLICATION_SCOPE['provider_calls']);self.assertEqual(r.APPLICATION_SCOPE['signup'],'preserve_open')
 def test_companion_adds_only_missing_exact_assets(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);destination=root/'dest';destination.mkdir();retained=root/'retained';p=retained/'public/_nuxt/old.js';p.parent.mkdir(parents=True);p.write_bytes(b'old')
   entries=[{'path':'public/_nuxt/old.js','type':'file','sha256':r.sha(p),'size':3,'mode':0o644}];expected={'old.js':{'sha256':r.sha(p),'bytes':3}}
   r.merge_assets(destination,retained,entries,expected);self.assertEqual((destination/'public/_nuxt/old.js').read_bytes(),b'old')
   with self.assertRaises(AssertionError):r.merge_assets(destination,retained,entries,expected)
 def test_companion_cannot_overwrite_or_escape(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);destination=root/'dest';destination.mkdir();retained=root/'retained';retained.mkdir()
   for name in ['server/index.mjs','public/_nuxt/builds/latest.json','public/_nuxt/../../server/evil']:
    with self.assertRaises((AssertionError,KeyError)):r.merge_assets(destination,retained,[{'path':name,'type':'file','sha256':'0'*64,'size':0,'mode':0o644}],{})
if __name__=='__main__':unittest.main()
