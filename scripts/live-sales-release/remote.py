#!/usr/bin/env python3
"""Read-only inspect/assets/recovery; other modes need the exact sealed approval.

No packages, decoder build, Caddy operation, SQL, provider call or automatic recovery.
"""
import argparse, datetime, hashlib, http.client, importlib.util, json, os, pathlib, pwd, re, shlex, shutil, socket, stat, subprocess, sys, tarfile, time

def sha(path): return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
def digest(value): return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def command(argv,timeout=20): return subprocess.check_output(argv,text=True,timeout=timeout,stderr=subprocess.PIPE).strip()
def metadata(path):
    p=pathlib.Path(path); s=p.lstat(); assert stat.S_ISREG(s.st_mode)
    return {'sha256':sha(p),'mode':stat.S_IMODE(s.st_mode),'uid':s.st_uid,'gid':s.st_gid,'bytes':s.st_size}
def paths(p):
    t=p['target']; root=pathlib.Path(t['root'])
    assert re.fullmatch('/srv/[a-z][a-z0-9-]{2,24}',str(root))
    assert root.name==t['service'] and re.fullmatch('[a-z][a-z0-9-]{2,24}',t['user'])
    for path in [root,root/'releases',root/'shared',root/'shared/uploads',root/'shared/private',pathlib.Path(t['packing_dir'])]:
        assert path.is_dir() and not path.is_symlink()
    assert t['packing_dir']==str(root/'shared/private/packing-videos')
    assert t['documents_dir']==str(root/'shared/private/shipping-documents')
    assert p['release_id']=='preflight' or re.fullmatch('[a-f0-9]{16}',p['release_id'])
    assert pathlib.Path('/etc/machine-id').read_text().strip()==t['machine_id'] and os.geteuid()==0
    return t,root,pathlib.Path('/var/lib/live-sales-releases')/p['release_id']
def env_values(raw):
    result={}
    for line in raw.decode().splitlines():
        if line.strip() and not line.lstrip().startswith('#'):
            key,value=line.split('=',1); parsed=shlex.split(value)
            assert re.fullmatch('[A-Z][A-Z0-9_]*',key) and key not in result and len(parsed)<=1
            result[key]=parsed[0] if parsed else ''
    return result
def additions(t): return ('NUXT_SHIPPING_DOCUMENTS_DIR="'+t['documents_dir']+'"\nNUXT_PAYMOB_LIVE_REQUESTS_ENABLED="false"\n').encode()
def service(name):
    values=dict(line.split('=',1) for line in command(['systemctl','show',name,'--property=ActiveState,SubState,MainPID,NRestarts,ExecMainStartTimestampMonotonic']).splitlines())
    assert values['ActiveState']=='active' and values['SubState']=='running' and values['NRestarts']=='0'
    values['cwd']=os.readlink('/proc/'+values['MainPID']+'/cwd'); return values
def tree(root):
    files={}
    for path in sorted(root.rglob('*')):
        assert not path.is_symlink()
        if path.is_file(): files[str(path.relative_to(root))]={'sha256':sha(path),'bytes':path.stat().st_size}
        else: assert path.is_dir()
    return files
def recovery_files(p):
    t,root,_=paths(p); current=(root/'current').resolve()
    files=[pathlib.Path('/etc')/t['service']/'runtime.env',pathlib.Path('/etc/systemd/system')/(t['service']+'.service'),pathlib.Path('/etc/caddy/Caddyfile'),pathlib.Path('/etc/systemd/system/caddy.service'),pathlib.Path(t['extractor']),current/'VERIFIED.json',current/'OUTPUT-INVENTORY.json']
    files+=sorted(pathlib.Path('/etc/systemd/system',t['service']+'.service.d').glob('*.conf'))
    return files
def inspect(p):
    t,root,stage=paths(p); current=root/'current'; assert current.is_symlink()
    release=current.resolve(); assert release.parent==root/'releases'
    env=pathlib.Path('/etc')/t['service']/'runtime.env'; m=metadata(env); assert m['uid']==0 and m['mode']==0o600
    raw=env.read_bytes(); values=env_values(raw)
    assert values['NODE_ENV']=='production' and values['NUXT_PUBLIC_SUPABASE_URL']=='https://'+t['project_ref']+'.supabase.co'
    for key in ['HOST','NITRO_HOST']: assert values[key]=='127.0.0.1'
    for key in ['PORT','NITRO_PORT']: assert values[key]==str(t['port'])
    for key in ['NUXT_PAYMOB_ENABLED','NUXT_SHIPPING_LIVE_REQUESTS_ENABLED','PDC_LIVE_REQUESTS_ENABLED']: assert values[key]=='false'
    assert not any(key in values for key in ['NUXT_SHIPPING_DOCUMENTS_DIR','NUXT_PAYMOB_LIVE_REQUESTS_ENABLED'])
    assert values['NUXT_PACKING_VIDEOS_DIR']==t['packing_dir'] and values['NUXT_PACKING_VIDEO_PROBE_PATH']==t['probe_path']
    assert values['NUXT_UPLOADS_DIR']==str(root/'shared/uploads')
    assert command([t['node'],'--version'])=='v22.23.1'
    account=pwd.getpwnam(t['user'])
    for path in [root/'shared/private',pathlib.Path(t['packing_dir'])]:
        s=path.stat(); assert s.st_uid==account.pw_uid and stat.S_IMODE(s.st_mode)==0o700
    assert not pathlib.Path(t['documents_dir']).exists() and not pathlib.Path(t['documents_dir']).is_symlink()
    drop=pathlib.Path('/etc/systemd/system',t['service']+'.service.d/live-sales-documents.conf'); assert not drop.exists() and not drop.is_symlink()
    nuxt=service(t['service']+'.service'); assert nuxt['cwd']==str(release)
    caddy=service('caddy.service')
    # Bind all retained output bytes, not only the two entry points.
    inventory=json.loads((release/'OUTPUT-INVENTORY.json').read_text())
    for entry in inventory:
        path=release/entry['path']; assert path.resolve().is_relative_to(release)
        if entry['type']=='file': assert not path.is_symlink() and sha(path)==entry['sha256']
        elif entry['type']=='link': assert path.is_symlink() and os.readlink(path)==entry['target']
        else: assert path.is_dir() and not path.is_symlink()
    media=tree(root/'shared/uploads'); private=tree(root/'shared/private')
    assets=tree(release/'public/_nuxt'); assets.pop('builds/latest.json',None)
    updated=raw+(b'' if raw.endswith(b'\n') else b'\n')+additions(t)
    return {'observed_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'current':str(release),
      'verified':json.loads((release/'VERIFIED.json').read_text()),'nuxt':nuxt,'caddy':caddy,
      'recovery_files':{str(path):metadata(path) for path in recovery_files(p)},
      'updated_env_sha256':hashlib.sha256(updated).hexdigest(),'probe_sha256':sha(t['probe_path']),
      'media':{'files':len(media),'bytes':sum(v['bytes'] for v in media.values()),'sha256':digest(media)},
      'private_files':{'files':len(private),'sha256':digest(private)},'assets':assets,
      'free_bytes':shutil.disk_usage(root).free,'node_version':'22.23.1','production_writes':0}
def stable(state): return {k:v for k,v in state.items() if k not in ['observed_utc','free_bytes','production_writes']}
def baseline(p):
    state=inspect(p); assert stable(state)==stable(p['before']),'Runtime drift; preserve evidence'
    assert state['free_bytes']>max(1024**3,p['archive_bytes']*8)
    return state
def save(path,value):
    with path.open('x') as out: json.dump(value,out);out.write('\n');out.flush();os.fsync(out.fileno())
    path.chmod(0o600)
def prepare(p):
    current=baseline(p);t,root,stage=paths(p)
    stage.parent.mkdir(mode=0o700,exist_ok=True);assert not stage.parent.is_symlink();stage.mkdir(mode=0o700)
    save(stage/'plan.json',p);save(stage/'live-before.json',current)
    # Original credentials stay root-only on this host, never in release output.
    for path in recovery_files(p):
        if path.name=='runtime.env':
            with (stage/'runtime.env.before').open('xb') as out:out.write(path.read_bytes());out.flush();os.fsync(out.fileno())
    return {'staging':str(stage)}
def stage_release(p):
    baseline(p);t,root,stage=paths(p);assert sha(stage/'release.tar.gz')==p['archive_sha256']
    entries=json.loads((stage/'inventory.json').read_text());assert digest(entries)==p['inventory_sha256']
    spec=importlib.util.spec_from_file_location('retained_extractor',t['extractor']);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    destination=root/'releases'/p['release_id'];module.extract_release(stage/'release.tar.gz',destination,entries)
    save(destination/'OUTPUT-INVENTORY.json',entries);save(destination/'VERIFIED.json',{'archive_sha256':p['archive_sha256'],'commit':p['application_commit'],'plan_sha256':p['seal']})
    save(stage/'staged.json',{'release':str(destination)});return {'release':str(destination)}
def provision(p):
    baseline(p);t,root,stage=paths(p);assert (stage/'staged.json').is_file()
    account=pwd.getpwnam(t['user']);private=pathlib.Path(t['documents_dir']);private.mkdir(mode=0o700);os.chown(private,account.pw_uid,account.pw_gid)
    env=pathlib.Path('/etc')/t['service']/'runtime.env';raw=env.read_bytes();updated=raw+(b'' if raw.endswith(b'\n') else b'\n')+additions(t)
    assert hashlib.sha256(updated).hexdigest()==p['before']['updated_env_sha256']
    temporary=env.with_name('runtime.env.live-sales-'+p['release_id'])
    with temporary.open('xb') as out:out.write(updated);out.flush();os.fsync(out.fileno())
    temporary.chmod(0o600);temporary.replace(env)
    drop=pathlib.Path('/etc/systemd/system',t['service']+'.service.d/live-sales-documents.conf')
    with drop.open('x') as out:out.write('[Service]\nReadWritePaths='+t['documents_dir']+'\n')
    drop.chmod(0o644)
    subprocess.run(['systemd-analyze','verify','/etc/systemd/system/'+t['service']+'.service'],check=True,timeout=30,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    subprocess.run(['systemctl','daemon-reload'],check=True,timeout=30)
    save(stage/'provisioned.json',{'env_sha256':sha(env),'documents_dir':str(private)})
    return {'private_documents':'provisioned','decoder_unchanged':sha(t['probe_path'])==p['before']['probe_sha256']}
def probe_http(port):
    connection=http.client.HTTPConnection('127.0.0.1',port,timeout=3)
    try:connection.request('GET','/api/admin-products/list');response=connection.getresponse();response.read();return response.status==401
    finally:connection.close()
def sandbox(t):
    return ['--property=User='+t['user'],'--property=Group='+t['user'],'--property=NoNewPrivileges=true','--property=PrivateTmp=true','--property=ProtectHome=true','--property=ProtectSystem=strict','--property=RestrictSUIDSGID=true','--property=ReadWritePaths='+t['root']+'/shared/uploads '+t['packing_dir']+' '+t['documents_dir'],'--property=UMask=0027']
def candidate(p):
    t,root,stage=paths(p);assert (stage/'provisioned.json').is_file();release=root/'releases'/p['release_id'];unit='live-sales-candidate-'+p['release_id'];port=t['candidate_port']
    with socket.socket() as check:check.bind(('127.0.0.1',port))
    raw=(pathlib.Path('/etc')/t['service']/'runtime.env').read_bytes()
    assert sha(pathlib.Path('/etc')/t['service']/'runtime.env')==p['before']['updated_env_sha256']
    env=stage/'candidate.env'
    with env.open('xb') as out:out.write(raw+('\nPORT="'+str(port)+'"\nNITRO_PORT="'+str(port)+'"\n').encode())
    subprocess.run(['systemd-run','--quiet','--unit='+unit,*sandbox(t),'--property=WorkingDirectory='+str(release),'--property=EnvironmentFile='+str(env),t['node'],str(release/'server/index.mjs')],check=True,timeout=30)
    try:
        ready=False
        for _ in range(30):
            try:
                if probe_http(port):ready=True;break
            except (OSError,http.client.HTTPException):pass
            time.sleep(1)
        assert ready,'Private candidate failed'
        script="import pathlib,os; p=pathlib.Path("+repr(t['documents_dir']+'/.probe-'+p['release_id'])+"); f=p.open('xb'); f.write(b'isolated release probe'); f.flush(); os.fsync(f.fileno()); f.close(); assert p.read_bytes()==b'isolated release probe'; p.unlink()"
        subprocess.run(['systemd-run','--quiet','--wait','--collect','--unit='+unit+'-files',*sandbox(t),'/usr/bin/python3','-c',script],check=True,timeout=30,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        save(stage/'candidate-pass.json',{'port':port,'ready':True,'private_file_probe':'PASS'});return {'candidate':'PASS','existing_current':str((root/'current').resolve())}
    finally:subprocess.run(['systemctl','stop',unit+'.service'],check=True,timeout=30)
def activate(p):
    t,root,stage=paths(p);assert (stage/'candidate-pass.json').is_file()
    assert str((root/'current').resolve())==p['before']['current']
    assert service(t['service']+'.service')==p['before']['nuxt'] and service('caddy.service')==p['before']['caddy']
    for path,m in p['before']['recovery_files'].items():
        if path.endswith('/runtime.env'):assert sha(path)==p['before']['updated_env_sha256']
        else:assert metadata(path)==m
    save(stage/'activation-intent.json',{'old':p['before']['current'],'new':str(root/'releases'/p['release_id'])})
    link=root/('current.live-sales-'+p['release_id']);assert not link.exists() and not link.is_symlink();link.symlink_to(root/'releases'/p['release_id']);link.replace(root/'current')
    subprocess.run(['systemctl','restart',t['service']+'.service'],check=True,timeout=60)
    ready=False
    for _ in range(30):
        try:
            if probe_http(t['port']):ready=True;break
        except (OSError,http.client.HTTPException):pass
        time.sleep(1)
    assert ready,'STOP; preserve artifacts for reviewed recovery'
    state=service(t['service']+'.service');assert state['cwd']==str(root/'releases'/p['release_id']) and state['MainPID']!=p['before']['nuxt']['MainPID']
    assert service('caddy.service')==p['before']['caddy']
    media=tree(root/'shared/uploads');assert digest(media)==p['before']['media']['sha256']
    assert metadata('/etc/caddy/Caddyfile')==p['before']['recovery_files']['/etc/caddy/Caddyfile']
    save(stage/'activated.json',{'current':state['cwd'],'nuxt':state,'caddy_unchanged':True})
    return {'activated':True,'current':state['cwd'],'nuxt':state,'caddy_unchanged':True}
def main():
    os.umask(0o077);a=argparse.ArgumentParser();a.add_argument('mode',choices=['inspect','assets','recovery','prepare','stage','provision','candidate','activate']);a.add_argument('plan');a.add_argument('--approved');args=a.parse_args();p=json.loads(args.plan)
    if args.mode not in ['inspect','assets','recovery']:
        seal=p.pop('seal');assert digest(p)==seal and args.approved==seal,'Exact owner approval required';p['seal']=seal
    if args.mode in ['assets','recovery']:
        t,root,_=paths(p)
        with tarfile.open(fileobj=sys.stdout.buffer,mode='w|gz') as archive:
            files=sorted((root/'current/public/_nuxt').rglob('*')) if args.mode=='assets' else recovery_files(p)
            for path in files:
                assert not path.is_symlink()
                if not path.is_file():continue
                name=str(path.relative_to(root/'current/public')) if args.mode=='assets' else str(path).lstrip('/')
                if name!='_nuxt/builds/latest.json':archive.add(path,arcname=name,recursive=False)
        return
    print(json.dumps(globals()[{'stage':'stage_release'}.get(args.mode,args.mode)](p)))
if __name__=='__main__':
    try:main()
    except Exception as error:
        print(json.dumps({'result':'STOP','error_type':type(error).__name__,'message':'Preserve evidence; no automatic retry or recovery.'}));raise SystemExit(1)
