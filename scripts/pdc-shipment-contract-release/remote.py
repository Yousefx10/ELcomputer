#!/usr/bin/env python3
"""Read-only inspection/archives; mutation requires the exact new PDP seal.

Independent shipment-contract release, application-only schema90. No SQL, packages, provider requests, Caddy operation, runtime edit or recovery.
"""
import argparse,datetime,hashlib,http.client,importlib.util,json,os,pathlib,pwd,re,shlex,shutil,socket,stat,subprocess,sys,tarfile,time

def sha(path):return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def command(argv,timeout=30):return subprocess.check_output(argv,text=True,timeout=timeout,stderr=subprocess.PIPE).strip()
def metadata(path):
    p=pathlib.Path(path);s=p.lstat();assert stat.S_ISREG(s.st_mode)
    return {'sha256':sha(p),'mode':stat.S_IMODE(s.st_mode),'uid':s.st_uid,'gid':s.st_gid,'bytes':s.st_size}
def save(path,value):
    with path.open('x') as out:json.dump(value,out);out.write('\n');out.flush();os.fsync(out.fileno())
    path.chmod(0o600)
def paths(p):
    t=p['target'];root=pathlib.Path(t['root']);assert re.fullmatch('/srv/[a-z][a-z0-9-]{2,24}',str(root))
    assert root.name==t['service'] and re.fullmatch('[a-z][a-z0-9-]{2,24}',t['user'])
    assert 1024<=t['port']<=65535 and 1024<=t['candidate_port']<=65535 and t['port']!=t['candidate_port']
    for path in [root,root/'releases',root/'shared',root/'shared/uploads',root/'shared/private']:
        assert path.is_dir() and not path.is_symlink()
    assert t['packing_dir']==str(root/'shared/private/packing-videos') and t['documents_dir']==str(root/'shared/private/shipping-documents')
    assert p['release_id']=='preflight' or re.fullmatch('[a-f0-9]{16}',p['release_id'])
    assert pathlib.Path('/etc/machine-id').read_text().strip()==t['machine_id'] and os.geteuid()==0
    return t,root,pathlib.Path('/var/lib/pdc-shipment-contract-releases')/p['release_id']
def service(name):
    v=dict(line.split('=',1) for line in command(['systemctl','show',name,'--property=ActiveState,SubState,MainPID,NRestarts,ExecMainStartTimestampMonotonic']).splitlines())
    assert v['ActiveState']=='active' and v['SubState']=='running' and v['NRestarts']=='0'
    v['cwd']=os.readlink('/proc/'+v['MainPID']+'/cwd');return v
def env_values(raw):
    values={}
    for line in raw.decode().splitlines():
        if line.strip() and not line.lstrip().startswith('#'):
            key,value=line.split('=',1);parsed=shlex.split(value);assert re.fullmatch('[A-Z][A-Z0-9_]*',key) and key not in values and len(parsed)<=1
            values[key]=parsed[0] if parsed else ''
    return values
def tree(root):
    files={}
    for path in sorted(root.rglob('*')):
        assert not path.is_symlink()
        if path.is_file():files[str(path.relative_to(root))]={'sha256':sha(path),'bytes':path.stat().st_size}
        else:assert path.is_dir()
    return files
def recovery_files(p):
    t,root,_=paths(p);current=(root/'current').resolve()
    files=[pathlib.Path('/etc')/t['service']/'runtime.env',pathlib.Path('/etc/systemd/system')/(t['service']+'.service'),pathlib.Path('/etc/caddy/Caddyfile'),pathlib.Path('/etc/systemd/system/caddy.service'),pathlib.Path(t['probe_path']),pathlib.Path(t['extractor']),current/'VERIFIED.json',current/'OUTPUT-INVENTORY.json']
    return files+sorted(pathlib.Path('/etc/systemd/system',t['service']+'.service.d').glob('*.conf'))
def verify_output(release,entries):
    for e in entries:
        path=release/e['path'];assert path.resolve().is_relative_to(release)
        s=path.lstat()
        if e['type']=='file':assert stat.S_ISREG(s.st_mode) and stat.S_IMODE(s.st_mode)==e['mode'] and s.st_size==e['size'] and sha(path)==e['sha256']
        elif e['type']=='link':assert path.is_symlink() and os.readlink(path)==e['target']
        else:assert stat.S_ISDIR(s.st_mode) and stat.S_IMODE(s.st_mode)==e['mode']
    actual={str(f.relative_to(release)) for f in release.rglob('*')}
    assert actual=={e['path'] for e in entries if e['path']}|{'VERIFIED.json','OUTPUT-INVENTORY.json'}
def inspect(p):
    t,root,stage=paths(p);assert (root/'current').is_symlink();release=(root/'current').resolve();assert release.parent==root/'releases'
    env=pathlib.Path('/etc')/t['service']/'runtime.env';m=metadata(env);assert m['mode']==0o600 and m['uid']==0
    values=env_values(env.read_bytes());assert values['NODE_ENV']=='production'
    assert values['NUXT_PUBLIC_SUPABASE_URL']=='https://'+t['project_ref']+'.supabase.co'
    for key in ['HOST','NITRO_HOST']:assert values[key]=='127.0.0.1'
    for key in ['PORT','NITRO_PORT']:assert values[key]==str(t['port'])
    assert values.get('NUXT_PUBLIC_PURCHASING_ENABLED','false')=='false'
    for key in ['NUXT_PAYMOB_ENABLED','NUXT_PAYMOB_LIVE_REQUESTS_ENABLED','NUXT_SHIPPING_LIVE_REQUESTS_ENABLED','PDC_LIVE_REQUESTS_ENABLED']:assert values[key]=='false'
    assert values['NUXT_UPLOADS_DIR']==str(root/'shared/uploads') and values['NUXT_PACKING_VIDEOS_DIR']==t['packing_dir'] and values['NUXT_SHIPPING_DOCUMENTS_DIR']==t['documents_dir'] and values['NUXT_PACKING_VIDEO_PROBE_PATH']==t['probe_path']
    assert command([t['node'],'--version'])=='v22.23.1'
    account=pwd.getpwnam(t['user'])
    for name in [str(root/'shared/private'),t['packing_dir'],t['documents_dir']]:
        path=pathlib.Path(name);s=path.lstat();assert stat.S_ISDIR(s.st_mode) and s.st_uid==account.pw_uid and stat.S_IMODE(s.st_mode)==0o700
    nuxt=service(t['service']+'.service');assert nuxt['cwd']==str(release);caddy=service('caddy.service')
    running=dict(part.decode().split('=',1) for part in pathlib.Path('/proc/'+nuxt['MainPID']+'/environ').read_bytes().split(b'\0') if part)
    assert all(running.get(key)==value for key,value in values.items())
    entries=json.loads((release/'OUTPUT-INVENTORY.json').read_text());verify_output(release,entries)
    media=tree(root/'shared/uploads');private=tree(root/'shared/private');assets=tree(release/'public/_nuxt');assets.pop('builds/latest.json',None)
    return {'observed_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'current':str(release),'verified':json.loads((release/'VERIFIED.json').read_text()),'nuxt':nuxt,'caddy':caddy,'recovery_files':{str(f):metadata(f) for f in recovery_files(p)},'media':{'files':len(media),'bytes':sum(v['bytes'] for v in media.values()),'sha256':digest(media)},'private_files':{'files':len(private),'sha256':digest(private)},'assets':assets,'free_bytes':shutil.disk_usage(root).free,'production_writes':0}
def stable(v):return {k:x for k,x in v.items() if k not in ['observed_utc','free_bytes','production_writes']}
def baseline(p):
    current=inspect(p);assert stable(current)==stable(p['before']),'Current target drift'
    assert current['free_bytes']>max(1024**3,p['archive_bytes']*8)
    return current
def prepare(p):
    current=baseline(p);t,root,stage=paths(p);stage.parent.mkdir(mode=0o700,exist_ok=True);assert not stage.parent.is_symlink();stage.mkdir(mode=0o700)
    save(stage/'plan.json',p);save(stage/'before.json',current)
    with (stage/'runtime.env.before').open('xb') as out:out.write((pathlib.Path('/etc')/t['service']/'runtime.env').read_bytes());out.flush();os.fsync(out.fileno())
    return {'staging':str(stage)}
def stage_release(p):
    baseline(p);t,root,stage=paths(p);assert sha(stage/'release.tar.gz')==p['archive_sha256'];entries=json.loads((stage/'inventory.json').read_text());assert digest(entries)==p['inventory_sha256']
    assert metadata(t['extractor'])==p['before']['recovery_files'][t['extractor']]
    s=importlib.util.spec_from_file_location('retained_extractor',t['extractor']);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
    destination=root/'releases'/p['release_id'];m.extract_release(stage/'release.tar.gz',destination,entries)
    save(destination/'OUTPUT-INVENTORY.json',entries);save(destination/'VERIFIED.json',{'archive_sha256':p['archive_sha256'],'commit':p['application_commit'],'plan_sha256':p['seal']});verify_output(destination,entries)
    for name,value in p['before']['assets'].items():assert sha(destination/'public/_nuxt'/name)==value['sha256']
    save(stage/'staged.json',{'release':str(destination)});return {'release':str(destination)}
def probe(port,path,expected):
    c=http.client.HTTPConnection('127.0.0.1',port,timeout=5)
    try:c.request('GET',path);r=c.getresponse();data=r.read(8*1024*1024+1);assert len(data)<=8*1024*1024;return r.status==expected,data
    finally:c.close()
def candidate(p,after=True):
    assert after is True
    baseline(p);t,root,stage=paths(p);assert (stage/'staged.json').is_file();release=root/'releases'/p['release_id'];entries=json.loads((stage/'inventory.json').read_text());assert digest(entries)==p['inventory_sha256'];verify_output(release,entries);unit='pdc-shipment-contract-candidate-90-'+p['release_id'];port=t['candidate_port']
    with socket.socket() as s:s.bind(('127.0.0.1',port))
    raw=(pathlib.Path('/etc')/t['service']/'runtime.env').read_bytes();candidate_raw,n=re.subn(rb'^(PORT|NITRO_PORT)=.*$',lambda m:m.group(1)+b'="'+str(port).encode()+b'"',raw,flags=re.M);assert n==2
    env=stage/('candidate90.env' if after else 'candidate.env')
    with env.open('xb') as out:out.write(candidate_raw);out.flush();os.fsync(out.fileno())
    env.chmod(0o600)
    args=['systemd-run','--quiet','--unit='+unit,'--property=User='+t['user'],'--property=Group='+t['user'],'--property=NoNewPrivileges=true','--property=PrivateTmp=true','--property=ProtectHome=true','--property=ProtectSystem=strict','--property=RestrictSUIDSGID=true','--property=UMask=0027','--property=WorkingDirectory='+str(release),'--property=EnvironmentFile='+str(env),t['node'],str(release/'server/index.mjs')]
    subprocess.run(args,check=True,timeout=30,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    try:
        ready=False
        for _ in range(30):
            try:
                if probe(port,'/api/admin-products/list',401)[0]:ready=True;break
            except (OSError,http.client.HTTPException):pass
            time.sleep(0.5)
        assert ready
        assert probe(port,'/api/storefront/content',200)[0]
        assert probe(port,'/api/admin-shipping/settings',401)[0]
        ok,data=probe(port,'/api/payments/capabilities',200);assert ok and json.loads(data)['card']['available'] is False
        assert stable(inspect(p))==stable(p['before'])
        save(stage/'candidate90-pass.json',{'port':port,'ready':True,'schema':90,'migration_sha256':p['migration_sha256'],'plan_sha256':p['seal'],'archive_sha256':p['archive_sha256'],'inventory_sha256':p['inventory_sha256'],'existing_release_unchanged':True});return {'candidate':'PASS','current_unchanged':True}
    finally:subprocess.run(['systemctl','stop',unit+'.service'],check=True,timeout=30,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
def activate(p,database):
    baseline(p);t,root,stage=paths(p);assert (stage/'candidate90-pass.json').is_file()
    assert database['plan_sha256']==p['seal'] and database['schema']==90 and database['migration_sha256']==p['migration_sha256'] and database['preservation']=='PASS' and database['read_only'] is True and database['database_writes']==0
    assert re.fullmatch('[a-f0-9]{64}',database['state_sha256'])
    assert database['state_sha256']==p['database_state_sha256']
    candidate_proof=json.loads((stage/'candidate90-pass.json').read_text());assert candidate_proof['schema']==90 and candidate_proof['ready'] and candidate_proof['migration_sha256']==p['migration_sha256']
    assert candidate_proof['plan_sha256']==p['seal'] and candidate_proof['archive_sha256']==p['archive_sha256'] and candidate_proof['inventory_sha256']==p['inventory_sha256'] and candidate_proof['existing_release_unchanged'] is True
    entries=json.loads((stage/'inventory.json').read_text());assert digest(entries)==p['inventory_sha256'];verify_output(root/'releases'/p['release_id'],entries)
    verified=json.loads((root/'releases'/p['release_id']/'VERIFIED.json').read_text());assert verified=={'archive_sha256':p['archive_sha256'],'commit':p['application_commit'],'plan_sha256':p['seal']}
    save(stage/'database-readonly-verified.json',database);save(stage/'activation-intent.json',{'old':p['before']['current'],'new':str(root/'releases'/p['release_id'])})
    link=root/('current.pdc-shipment-contract-'+p['release_id']);assert not link.exists() and not link.is_symlink();link.symlink_to(root/'releases'/p['release_id']);link.replace(root/'current')
    subprocess.run(['systemctl','restart',t['service']+'.service'],check=True,timeout=60,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    ready=False
    for _ in range(30):
        try:
            if probe(t['port'],'/api/admin-products/list',401)[0]:ready=True;break
        except (OSError,http.client.HTTPException):pass
        time.sleep(0.5)
    assert ready
    after=inspect(p);assert after['current']==str(root/'releases'/p['release_id']) and after['nuxt']['MainPID']!=p['before']['nuxt']['MainPID']
    assert after['caddy']==p['before']['caddy'] and after['media']==p['before']['media'] and after['private_files']==p['before']['private_files']
    for path,value in p['before']['recovery_files'].items():assert metadata(path)==value
    save(stage/'activated.json',after);return after
def main():
    os.umask(0o077);a=argparse.ArgumentParser();a.add_argument('mode',choices=['inspect','assets','recovery','prepare','stage','candidate90','activate']);a.add_argument('payload');args=a.parse_args();payload=json.loads(args.payload);p=payload['plan']
    if args.mode not in ['inspect','assets','recovery']:
        assert p['format']==7 and p['schema_version']==90 and p['migrations']==[] and type(p['database_writes']) is int and p['database_writes']==0
        seal=p.pop('seal');assert digest(p)==seal and payload.get('approved')==seal;p['seal']=seal
        assert p['scope']=={'milestone':'pdc_shipment_contract','schema':'90 unchanged','database_writes':False,'payment_availability_change':False,'runtime_change':False,'caddy_change':False,'provider_calls':False,'public_checkout':False,'signup':False}
    if args.mode in ['assets','recovery']:
        baseline(p);t,root,stage=paths(p)
        with tarfile.open(fileobj=sys.stdout.buffer,mode='w|gz') as archive:
            files=sorted((root/'current/public/_nuxt').rglob('*')) if args.mode=='assets' else recovery_files(p)
            for path in files:
                assert not path.is_symlink()
                if not path.is_file():continue
                name=str(path.relative_to(root/'current/public')) if args.mode=='assets' else str(path).lstrip('/')
                if name!='_nuxt/builds/latest.json':archive.add(path,arcname=name,recursive=False)
        return
    result=activate(p,payload.get('database',{})) if args.mode=='activate' else candidate(p,after=True) if args.mode=='candidate90' else globals()[{'stage':'stage_release'}.get(args.mode,args.mode)](p)
    print(json.dumps(result))
if __name__=='__main__':
    try:main()
    except Exception as error:
        print(json.dumps({'result':'STOP','error_type':type(error).__name__,'message':'Preserve evidence; no automatic retry or rollback.'}));raise SystemExit(1)
