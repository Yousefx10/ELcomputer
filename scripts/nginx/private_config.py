"""Private Nginx snapshot/shadow helpers, reused from the reviewed launch.

No runtime, database, reload, export or deployment entry point.
"""

import glob,hashlib,os,pathlib,re,stat

H=lambda data:hashlib.sha256(data.encode() if isinstance(data,str) else data).hexdigest()

class GateError(Exception):pass

def require(value,code):
 if not value:raise GateError(code)

def private_write(path,data):
 if isinstance(data,str):data=data.encode()
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())

def walk(nodes):
 for node in nodes:
  yield node
  yield from walk(node['children'])

def loaded_names(dump):
 names=re.findall(r'^# configuration file (.+):$',dump.decode(),re.M)
 require(names,'CONFIGURATION_INDEX')
 return sorted(set(names))

def fingerprint(path):
 s=path.stat()
 return (s.st_dev,s.st_ino,s.st_size,s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_mtime_ns)

def read_baseline(names,spec):
 expected={row['file_id']:row for row in spec['protected_configurations']}
 require(len(names)==len(expected),'CONFIGURATION_COUNT')
 contents={};metadata={}
 for name in names:
  require(name.startswith('/') and os.path.normpath(name)==name,'CONFIGURATION_PATH')
  path=pathlib.Path(name);before=fingerprint(path);raw=path.read_bytes();after=fingerprint(path)
  require(before==after,'CONFIGURATION_CHANGED_DURING_READ')
  row=expected.pop(H(name),None)
  require(row is not None,'UNREVIEWED_CONFIGURATION')
  require(H(raw)==row['sha256'] and len(raw)==row['bytes'] and before[3]==row['uid'] and oct(before[5])==row['mode'],'CONFIGURATION_HASH_OR_METADATA_DRIFT')
  require(stat.S_ISREG(path.stat().st_mode),'CONFIGURATION_NOT_REGULAR')
  contents[name]=raw.decode();metadata[name]=before
 require(not expected,'CONFIGURATION_MISSING')
 return contents,metadata

def shadow_tree(contents,candidate,main,shadow,parse,config_prefix=None):
 """Clone loaded files privately; mirror other siblings to preserve relative paths."""
 require(not shadow.exists(),'SHADOW_ALREADY_EXISTS');shadow.mkdir(mode=0o700)
 clones={name:shadow/name.lstrip('/') for name in contents}
 parents={pathlib.Path('/')}
 for name in contents:parents.update(pathlib.Path(name).parents)
 for parent in sorted(parents,key=lambda p:len(p.parts)):
  dest=shadow/str(parent).lstrip('/');dest.mkdir(mode=0o700,parents=True,exist_ok=True)
 # Relative certificate/auth/module file references retain their original targets.
 # Loaded configuration includes themselves are always rewritten to private clones.
 for parent in sorted(parents,key=str):
  dest=shadow/str(parent).lstrip('/')
  for entry in parent.iterdir():
   target=dest/entry.name
   if entry in parents or str(entry) in contents or os.path.lexists(target):continue
   target.symlink_to(str(entry))
 config_prefix=pathlib.Path('/etc/nginx') if config_prefix is None else pathlib.Path(config_prefix)
 for name,original in contents.items():
  text=candidate if name==main else original;edits=[]
  for node in walk(parse(text)):
   if node['name']!='include':continue
   require(len(node['args'])==1 and '$' not in node['args'][0],'UNSUPPORTED_INCLUDE')
   arg=node['args'][0];pattern=arg if arg.startswith('/') else str(config_prefix/arg)
   matches=sorted(os.path.normpath(path) for path in glob.glob(pattern))
   require(all(m in clones for m in matches),'INCLUDE_NOT_IN_REVIEWED_INDEX')
   # nginx permits an empty glob, but not a missing exact include.
   require(matches or glob.has_magic(pattern),'EXACT_INCLUDE_MISSING')
   replacement='\n'.join('include "'+str(clones[m]).replace('\\','\\\\').replace('"','\\"')+'";' for m in matches)
   edits.append((node['start'],node['end'],replacement or '# reviewed empty include glob\n'))
  for start,end,value in sorted(edits,reverse=True):text=text[:start]+value+text[end:]
  private_write(clones[name],text)
 return clones
