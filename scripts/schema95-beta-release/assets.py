"""Build a separate retained-client bundle; never rewrite the frozen application archive."""
import hashlib,importlib.util,json,pathlib,sys,tarfile
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def inventory(archive):
 entries=[]
 with tarfile.open(archive) as t:
  for m in t:
   p=pathlib.PurePosixPath(m.name);assert p.parts[0]=='application'
   e={'path':'/'.join(p.parts[1:]),'mode':m.mode}
   if m.isdir():e['type']='directory'
   elif m.isfile():e.update(type='file',size=m.size,sha256=hashlib.sha256(t.extractfile(m).read()).hexdigest())
   else:
    assert m.issym();e.update(type='link',mode=0o777,target=m.linkname,sha256=hashlib.sha256(m.linkname.encode()).hexdigest())
   entries.append(e)
 return entries
def save(path,value):
 with path.open('x') as f:json.dump(value,f,indent=2);f.write('\n')
 path.chmod(0o600)
def main():
 spec=json.loads(pathlib.Path(sys.argv[1]).read_text());work=pathlib.Path(sys.argv[2]);work.mkdir(mode=0o700)
 archive=pathlib.Path(spec['artifact_dir'])/'application.tar.gz';assert sha(archive)=='81becf54218a8e144137f2bdce7df1eed6bcc07745924c0167fcd7435aae37ff'
 previous=pathlib.Path(spec['previous_archive']);assert sha(previous)==spec['expected_deployed_verified']['archive_sha256']
 baseline=json.loads(pathlib.Path(spec['baseline_runtime_file']).read_text());assert baseline['verified']==spec['expected_deployed_verified']
 s=importlib.util.spec_from_file_location('remote',pathlib.Path(__file__).with_name('remote.py'));r=importlib.util.module_from_spec(s);s.loader.exec_module(r)
 base=inventory(archive);r.extract_release(archive,work/'readback',base);save(work/'base-inventory.json',base)
 missing=[];compat=work/'retained-build';compat.mkdir(mode=0o755)
 with tarfile.open(previous) as old:
  for name,e in baseline['assets'].items():
   path='public/_nuxt/'+name;target=work/'readback'/path
   if target.exists():assert sha(target)==e['sha256'];continue
   m=old.getmember('.output/'+path);assert m.isfile() and m.size==e['bytes'];data=old.extractfile(m).read();assert hashlib.sha256(data).hexdigest()==e['sha256']
   dest=compat/path;dest.parent.mkdir(parents=True,exist_ok=True,mode=0o755)
   with dest.open('xb') as f:f.write(data)
   dest.chmod(0o644);missing.append(name)
 with tarfile.open(work/'compatibility.tar.gz','w:gz') as tar:tar.add(compat,arcname='application')
 (work/'compatibility.tar.gz').chmod(0o600);entries=inventory(work/'compatibility.tar.gz')
 r.extract_release(work/'compatibility.tar.gz',work/'retained-readback',entries);r.merge_assets(work/'readback',work/'retained-readback',entries,baseline['assets']);save(work/'compatibility-inventory.json',entries)
 save(work/'asset-preservation.json',{'result':'PASS','frozen_archive_sha256':sha(archive),'retained_previous_archive_sha256':sha(previous),'retained_missing_files':len(missing),'companion_archive_sha256':sha(work/'compatibility.tar.gz'),'overwritten_files':0,'production_writes':0})
 save(work/'spec.private.json',{**spec,'base_inventory_file':str(work/'base-inventory.json'),'compatibility_inventory_file':str(work/'compatibility-inventory.json'),'compatibility_archive':str(work/'compatibility.tar.gz')})
 print(json.dumps({'result':'RETAINED_ASSETS_PASS','additional_files':len(missing),'application_archive_unchanged':True}))
if __name__=='__main__':main()
