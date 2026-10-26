#!/usr/bin/env python3
"""Guarded frontend-only Turnstile runtime configuration. No Auth enforcement, SQL,
release switch, Caddy change, provider transaction or automatic recovery.
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
    return t,root,pathlib.Path('/var/lib/turnstile-frontend-config')/p.get('seal','unsealed')[:16]
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
def inspect(p,configured=False):
    t,root,stage=paths(p);assert (root/'current').is_symlink();release=(root/'current').resolve();assert release.parent==root/'releases'
    env=pathlib.Path('/etc')/t['service']/'runtime.env';m=metadata(env);assert m['mode']==0o600 and m['uid']==0
    values=env_values(env.read_bytes());assert values['NODE_ENV']=='production'
    assert values['NUXT_PUBLIC_SUPABASE_URL']=='https://'+t['project_ref']+'.supabase.co'
    for key in ['HOST','NITRO_HOST']:assert values[key]=='127.0.0.1'
    for key in ['PORT','NITRO_PORT']:assert values[key]==str(t['port'])
    assert values.get('NUXT_PUBLIC_PURCHASING_ENABLED','false')=='false'
    assert values.get('NUXT_PUBLIC_BETA_PURCHASING_ENABLED','false')=='false'
    assert values.get('NUXT_PUBLIC_RETURNING_CUSTOMER_NOTICE_ENABLED','false')=='false'
    assert values.get('NUXT_PUBLIC_AUTH_CAPTCHA_PROVIDER','')==('turnstile' if configured else '')
    assert values.get('NUXT_PUBLIC_TURNSTILE_SITE_KEY','')==(p['widget']['site_key'] if configured else '')
    assert values.get('NUXT_CONTROLLED_PURCHASE','{}')=='{}'
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

RUNTIME_KEYS=('NUXT_PUBLIC_AUTH_CAPTCHA_PROVIDER','NUXT_PUBLIC_TURNSTILE_SITE_KEY')
SCOPE={'kind':'turnstile_frontend_runtime_only','schema':94,'application_deployment':False,'database_writes':False,'supabase_changes':False,'captcha_enforcement':False,'signup':False,'purchasing':False,'pdc':False,'caddy':False,'automatic_retry':False,'automatic_rollback':False,'app_restarts_max':1}

def patched_runtime(raw,widget):
    assert isinstance(widget,dict) and set(widget)=={'site_key','allowed_hostnames','mode'}
    assert widget['mode']=='managed' and re.fullmatch(r'0x4[A-Za-z0-9_-]{10,100}',widget['site_key'])
    assert isinstance(widget['allowed_hostnames'],list) and widget['allowed_hostnames']
    for host in widget['allowed_hostnames']:assert re.fullmatch(r'[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?',host) and '..' not in host
    assert b'\r' not in raw and b'\x00' not in raw
    before=env_values(raw)
    assert before.get(RUNTIME_KEYS[0],'')=='' and before.get(RUNTIME_KEYS[1],'')==''
    expected={RUNTIME_KEYS[0]:'turnstile',RUNTIME_KEYS[1]:widget['site_key']}
    lines=raw.decode().splitlines(keepends=True);seen=set();result=[]
    for line in lines:
        key=line.split('=',1)[0]
        if key in expected:
            assert key not in seen;seen.add(key);result.append(key+'="'+expected[key]+'"\n')
        else:result.append(line)
    if result and not result[-1].endswith('\n'):result[-1]+='\n'
    for key in RUNTIME_KEYS:
        if key not in seen:result.append(key+'="'+expected[key]+'"\n')
    proposed=''.join(result).encode();after=env_values(proposed)
    assert {k:v for k,v in before.items() if k not in RUNTIME_KEYS}=={k:v for k,v in after.items() if k not in RUNTIME_KEYS}
    assert all(after[k]==v for k,v in expected.items())
    return proposed

def configuration(p):
    t,root,stage=paths(p);path=pathlib.Path('/etc')/t['service']/'runtime.env'
    raw=path.read_bytes();proposed=patched_runtime(raw,p['widget'])
    return path,raw,proposed

def preview(p):
    before=inspect(p);path,raw,proposed=configuration(p)
    assert before['verified']==p['deployed_verified']
    assert path.stat().st_gid==0
    assert p['target']['domain'] in p['widget']['allowed_hostnames']
    return {'before':before,'runtime_file':str(path),'before_sha256':hashlib.sha256(raw).hexdigest(),'proposed_sha256':hashlib.sha256(proposed).hexdigest(),'proposed_bytes':len(proposed),'changed_keys':list(RUNTIME_KEYS),'target_writes':0}

def unchanged(p):
    assert stable(inspect(p))==stable(p['before']),'Target drift'
    path,raw,proposed=configuration(p)
    assert hashlib.sha256(raw).hexdigest()==p['runtime']['before_sha256']
    assert hashlib.sha256(proposed).hexdigest()==p['runtime']['proposed_sha256']
    assert len(proposed)==p['runtime']['proposed_bytes']
    return path,raw,proposed

def prepare(p):
    path,raw,proposed=unchanged(p);t,root,stage=paths(p)
    stage.parent.mkdir(mode=0o700,exist_ok=True);assert not stage.parent.is_symlink()
    stage.mkdir(mode=0o700)
    save(stage/'plan.json',p)
    with (stage/'runtime.env.before').open('xb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
    return {'staging':str(stage),'runtime_unchanged':True}

def probe(port,path,expected):
    c=http.client.HTTPConnection('127.0.0.1',port,timeout=5)
    try:c.request('GET',path);r=c.getresponse();body=r.read(8*1024*1024+1);assert len(body)<=8*1024*1024;assert r.status==expected;return body
    finally:c.close()

def candidate(p):
    path,raw,proposed=unchanged(p);t,root,stage=paths(p);assert (stage/'plan.json').is_file()
    port=t['candidate_port'];unit='turnstile-frontend-candidate-'+p['seal'][:16]
    with socket.socket() as s:s.bind(('127.0.0.1',port))
    candidate_raw,n=re.subn(rb'^(PORT|NITRO_PORT)=.*$',lambda m:m.group(1)+b'="'+str(port).encode()+b'"',proposed,flags=re.M);assert n==2
    with (stage/'candidate.env').open('xb') as f:f.write(candidate_raw);f.flush();os.fsync(f.fileno())
    args=['systemd-run','--quiet','--unit='+unit,'--property=User='+t['user'],'--property=Group='+t['user'],'--property=NoNewPrivileges=true','--property=PrivateTmp=true','--property=ProtectHome=true','--property=ProtectSystem=strict','--property=RestrictSUIDSGID=true','--property=UMask=0027','--property=WorkingDirectory='+p['before']['current'],'--property=EnvironmentFile='+str(stage/'candidate.env'),t['node'],p['before']['current']+'/server/index.mjs']
    subprocess.run(args,check=True,timeout=30,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    try:
        ready=False
        for _ in range(30):
            try:probe(port,'/api/admin-products/list',401);ready=True;break
            except (OSError,http.client.HTTPException):time.sleep(0.5)
        assert ready;checks=[]
        for path in ['/login','/ar/login','/dashboard/login']:
            body=probe(port,path,200);assert p['widget']['site_key'].encode() in body and b'authCaptchaProvider' in body;checks.append({'path':path,'status':200,'public_configuration_present':True})
        for path in ['/api/account/history','/api/checkout/shipping']:probe(port,path,401);checks.append({'path':path,'status':401})
        data=json.loads(probe(port,'/api/payments/capabilities',200));assert data['purchase']['available'] is False and data['card']['available'] is False
        unchanged(p);save(stage/'candidate-pass.json',{'result':'PASS','seal':p['seal'],'checks':checks,'current_release_unchanged':True,'provider_calls':0})
        return {'result':'PASS','checks':checks,'current_release_unchanged':True}
    finally:subprocess.run(['systemctl','stop',unit+'.service'],check=True,timeout=30,stdout=subprocess.PIPE,stderr=subprocess.PIPE)

def activate(p,database):
    path,raw,proposed=unchanged(p);t,root,stage=paths(p)
    proof=json.loads((stage/'candidate-pass.json').read_text());assert proof['result']=='PASS' and proof['seal']==p['seal'] and proof['current_release_unchanged']
    assert database=={'seal':p['seal'],'state_sha256':p['database_state_sha256'],'schema':94,'read_only':True}
    save(stage/'activation-intent.json',{'seal':p['seal'],'runtime_sha256':p['runtime']['proposed_sha256'],'app_restarts_max':1,'application_release_unchanged':p['release_id']})
    temp=path.with_name('runtime.env.turnstile-'+p['seal'][:16])
    fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'wb') as f:f.write(proposed);f.flush();os.fsync(f.fileno())
    os.chown(temp,0,0);assert sha(temp)==p['runtime']['proposed_sha256'];os.replace(temp,path)
    directory=os.open(path.parent,os.O_DIRECTORY);os.fsync(directory);os.close(directory)
    save(stage/'runtime-written.json',metadata(path));save(stage/'restart-intent.json',{'attempt':1,'service':t['service']})
    subprocess.run(['systemctl','restart',t['service']+'.service'],check=True,timeout=60,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    ready=False
    for _ in range(30):
        try:probe(t['port'],'/api/admin-products/list',401);ready=True;break
        except (OSError,http.client.HTTPException):time.sleep(0.5)
    assert ready;after=inspect(p,configured=True)
    assert after['current']==p['before']['current'] and after['verified']==p['before']['verified']
    assert after['nuxt']['MainPID']!=p['before']['nuxt']['MainPID'] and after['caddy']==p['before']['caddy']
    for key in ['media','private_files','assets']:assert after[key]==p['before'][key]
    for file,before in p['before']['recovery_files'].items():
        if file==str(path):assert after['recovery_files'][file]=={**before,'sha256':p['runtime']['proposed_sha256'],'bytes':p['runtime']['proposed_bytes']}
        else:assert after['recovery_files'][file]==before
    save(stage/'activated.json',after);return after

def main():
    os.umask(0o077)
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['preview','prepare','candidate','activate']);parser.add_argument('payload');args=parser.parse_args();payload=json.loads(args.payload);p=payload['plan']
    if args.mode!='preview':
        seal=p.pop('seal');assert digest(p)==seal and payload.get('approved')==seal;p['seal']=seal
        assert p['format']==13 and p['scope']==SCOPE
        age=(datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(p['backup_verified_utc'].replace('Z','+00:00'))).total_seconds();assert 0<=age<=6*3600
    result=activate(p,payload.get('database')) if args.mode=='activate' else globals()[args.mode](p)
    print(json.dumps(result))

if __name__=='__main__':
    try:main()
    except Exception as e:print(json.dumps({'result':'STOP','error_type':type(e).__name__,'automatic_retry':False,'automatic_rollback':False}));raise SystemExit(1)
