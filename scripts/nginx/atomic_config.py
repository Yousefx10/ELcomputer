"""Replace one reviewed configuration, preserving its symlink and security metadata."""
import base64,hashlib,json,os,pathlib,stat
class GateError(Exception):pass
def require(value,code):
 if not value:raise GateError(code)
def digest(raw):return hashlib.sha256(raw).hexdigest()
def metadata(path):
 s=path.stat();return (s.st_dev,s.st_ino,s.st_size,s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_mtime_ns)
def capture(path,expected):
 path=pathlib.Path(path);resolved=path.resolve(strict=True);link=os.readlink(path) if path.is_symlink() else None
 before=metadata(resolved);raw=resolved.read_bytes()
 require(stat.S_ISREG(resolved.stat().st_mode) and metadata(resolved)==before and digest(raw)==expected,'MAIN_SOURCE_DRIFT')
 attrs={name:os.getxattr(resolved,name) for name in os.listxattr(resolved)}
 require(metadata(resolved)==before,'MAIN_SOURCE_DRIFT')
 return {'path':path,'resolved':resolved,'link':link,'metadata':before,'raw':raw,'attrs':attrs}
def assert_unchanged(snapshot):
 path=snapshot['path'];require(path.resolve(strict=True)==snapshot['resolved'],'MAIN_TARGET_DRIFT')
 require((os.readlink(path) if path.is_symlink() else None)==snapshot['link'],'MAIN_SYMLINK_DRIFT')
 require(metadata(snapshot['resolved'])==snapshot['metadata'] and snapshot['resolved'].read_bytes()==snapshot['raw'],'MAIN_SOURCE_DRIFT')
 require({n:os.getxattr(snapshot['resolved'],n) for n in os.listxattr(snapshot['resolved'])}==snapshot['attrs'],'MAIN_XATTR_DRIFT')
def recovery_metadata(snapshot):
 return {'path':str(snapshot['path']),'resolved_path':str(snapshot['resolved']),'symlink_target':snapshot['link'],'stat_fingerprint':snapshot['metadata'],'source_sha256':digest(snapshot['raw']),'xattrs_base64':{k:base64.b64encode(v).decode() for k,v in snapshot['attrs'].items()}}
def replace_once(snapshot,candidate,token,verify_all,mark):
 require(token.isalnum(),'STAGE_TOKEN')
 path=snapshot['resolved'];parent=os.open(path.parent,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
 leaf='.dashboard-access-'+token+'.pending';fd=None
 try:
  fd=os.open(leaf,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=parent)
  with os.fdopen(fd,'wb',closefd=False) as stream:stream.write(candidate);stream.flush()
  expected=snapshot['metadata'];current=os.fstat(fd)
  if (current.st_uid,current.st_gid)!=(expected[3],expected[4]):os.fchown(fd,expected[3],expected[4])
  os.fchmod(fd,expected[5])
  for name in set(os.listxattr(fd))-set(snapshot['attrs']):os.removexattr(fd,name)
  for name,value in snapshot['attrs'].items():os.setxattr(fd,name,value)
  current=os.fstat(fd)
  require((current.st_uid,current.st_gid,stat.S_IMODE(current.st_mode))==(expected[3],expected[4],expected[5]),'STAGED_SECURITY_METADATA')
  require({n:os.getxattr(fd,n) for n in os.listxattr(fd)}==snapshot['attrs'],'STAGED_XATTR_MISMATCH')
  os.fsync(fd);require((path.parent/leaf).read_bytes()==candidate,'STAGED_BYTES')
  verify_all();assert_unchanged(snapshot)
  mark('replacement-attempted');os.replace(leaf,path.name,src_dir_fd=parent,dst_dir_fd=parent);mark('replacement-acknowledged');os.fsync(parent)
  require(snapshot['path'].resolve(strict=True)==path and (os.readlink(snapshot['path']) if snapshot['path'].is_symlink() else None)==snapshot['link'],'MAIN_SYMLINK_DRIFT')
  require(path.read_bytes()==candidate,'INSTALLED_CANDIDATE_MISMATCH')
  s=path.stat();require((s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))==(expected[3],expected[4],expected[5]),'INSTALLED_SECURITY_METADATA')
  require({n:os.getxattr(path,n) for n in os.listxattr(path)}==snapshot['attrs'],'INSTALLED_XATTR_MISMATCH')
 finally:
  if fd is not None:os.close(fd)
  os.close(parent)
 # Any failure leaves private evidence/staged bytes intact. No retry or restore.
