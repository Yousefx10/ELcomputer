"""New approval only: finish an already migrated/staged95 release, with public assets.
Never replays migration95 or the consumed Beta operator. No runtime/Auth/provider writes.
"""
import datetime,hashlib,http.client,json,os,pathlib,re,signal,socket,ssl,stat,subprocess,sys,time
SCOPE={'kind':'schema95_asset_recovery','schema':95,'migrations':0,'database_writes':0,'runtime_change':False,'auth_change':False,'caddy_asset_route_only':True,'caddy_sigusr1_max':1,'app_restarts_max':1,'candidate_loopback_only':True,'signup':'preserve_open','purchasing':False,'provider_calls':0,'automatic_retry':False,'automatic_rollback':False}
H={}
def sha_bytes(b):return hashlib.sha256(b).hexdigest()
def assets_block(root,fallback):
    assert re.fullmatch('/srv/[a-z][a-z0-9-]{2,24}/current/public',root)
    assert re.fullmatch('/srv/[a-z][a-z0-9-]{2,24}/releases/[a-f0-9]{16}/public',fallback)
    return '''        # schema95 immutable browser assets; API and purchase guards precede this.
        @schema95_assets {
            method GET HEAD
            path /_nuxt/*
        }
        handle @schema95_assets {
            route {
                header Cache-Control "public, max-age=1, must-revalidate"
                @schema95_hashed not path /_nuxt/builds/*
                header @schema95_hashed Cache-Control "public, max-age=31536000, immutable"
                @schema95_meta path /_nuxt/builds/meta/*
                header @schema95_meta Cache-Control "public, max-age=31536000, immutable"
                file_server {
                    root '''+root+'''
                    pass_thru
                }
                file_server {
                    root '''+fallback+'''
                }
            }
        }
'''
def patch(raw,root,release):
    anchor='        respond @private "Not found" 404\n'
    assert raw.count(anchor)==1 and '@schema95_assets' not in raw
    block=assets_block(root+'/current/public',root+'/releases/'+release+'/public')
    result=raw.replace(anchor,anchor+block)
    assert result.replace(block,'',1)==raw
    return result
def helper_source(source):
    n={'__name__':'immutable_readonly_helpers'};exec(compile(source,'retained_helpers.py','exec'),n);return n
def stage(p):return pathlib.Path('/var/lib/schema95-asset-activation')/p['seal'][:16]
def staged(p):
    t,root,_=H['paths'](p);release=root/'releases'/p['release_id'];entries=json.loads((release/'OUTPUT-INVENTORY.json').read_text())
    assert H['digest'](entries)==p['inventory_sha256'];H['verify_output'](release,entries)
    assert json.loads((release/'VERIFIED.json').read_text())==p['staged_verified']
    assert all(e['type']!='link' for e in entries if e['path'].startswith('public/'))
    return release
def process(p):
    pid=p['before']['caddy']['MainPID'];cmd=pathlib.Path('/proc/'+pid+'/cmdline').read_bytes().decode().strip('\0').split('\0')
    assert cmd==[p['caddy_binary'],'run','--config','/etc/caddy/Caddyfile','--adapter','caddyfile']
    assert H['command'](['systemctl','show','caddy.service','--property=CanReload','--value'])=='no'
    assert H['metadata'](p['caddy_binary'])==p['caddy_binary_metadata']
    assert H['command']([p['caddy_binary'],'version'])==p['caddy_version']
    return cmd
def inspect(p):
    core=H['inspect'](p);release=staged(p);process(p)
    # Check the real Caddy identity can read generated public bytes; no permission edits.
    status=dict(line.split(':',1) for line in pathlib.Path('/proc/'+core['caddy']['MainPID']+'/status').read_text().splitlines() if ':' in line)
    uid=int(status['Uid'].split()[1]);gid=int(status['Gid'].split()[1]);groups=[int(v) for v in status['Groups'].split()]
    readfd,writefd=os.pipe();child=os.fork()
    if child==0:
        try:
            os.close(readfd);os.setgroups(groups);os.setgid(gid);os.setuid(uid)
            good=all(os.access(release/'public/_nuxt'/a['name'],os.R_OK) for a in p['http_assets']);os.write(writefd,b'1' if good else b'0')
        finally:os._exit(0)
    os.close(writefd);good=os.read(readfd,1);os.close(readfd);os.waitpid(child,0);assert good==b'1','Caddy cannot read staged public assets'
    code,body=origin_asset(p,p['http_assets'][0]['name']);assert code==200 and sha_bytes(body)==p['http_assets'][0]['sha256']
    core['caddy_public_files_readable']=True;core['caddy_effective_uid']=uid
    return core
def unchanged(p):
    a=inspect(p);assert H['stable'](a)==H['stable'](p['before']),'Production drift'
    return a
def prepare(p):
    unchanged(p);s=stage(p);s.parent.mkdir(mode=0o700,exist_ok=True);assert not s.parent.is_symlink();s.mkdir(mode=0o700)
    raw=pathlib.Path('/etc/caddy/Caddyfile').read_bytes();proposed=patch(raw.decode(),p['target']['root'],p['release_id']).encode();assert sha_bytes(proposed)==p['caddy_after_sha256']
    H['save'](s/'plan.json',p)
    for name,data in [('Caddyfile.before',raw),('Caddyfile.proposed',proposed)]:
        with (s/name).open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
        (s/name).chmod(0o600)
    subprocess.run([p['caddy_binary'],'validate','--adapter','caddyfile','--config',str(s/'Caddyfile.proposed')],check=True,timeout=30,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    H['save'](s/'prepared.json',{'config_validated':True,'application_archive_unchanged':True,'database_writes':0})
    return {'prepared':True,'caddy_validation':'PASS','database_writes':0}
def probe(port,path):
    c=http.client.HTTPConnection('127.0.0.1',port,timeout=8)
    try:c.request('GET',path);r=c.getresponse();b=r.read(8*1024*1024+1);assert len(b)<=8*1024*1024;return r.status,b
    finally:c.close()
def origin_asset(p,name):
    domain=p['target']['domain'];assert re.fullmatch('[a-z0-9.-]+',domain)
    raw=socket.create_connection(('127.0.0.1',443),timeout=8);secure=ssl.create_default_context().wrap_socket(raw,server_hostname=domain)
    conn=http.client.HTTPConnection('127.0.0.1',443,timeout=8);conn.sock=secure
    try:conn.request('GET','/_nuxt/'+name,headers={'Host':domain});response=conn.getresponse();body=response.read(8*1024*1024+1);assert len(body)<=8*1024*1024;return response.status,body
    finally:conn.close()
def unit_start(unit,user,cwd,args,extra=()):
    command=['systemd-run','--quiet','--unit='+unit,'--property=User='+user,'--property=Group='+user,'--property=NoNewPrivileges=true','--property=PrivateTmp=true','--property=ProtectHome=true','--property=ProtectSystem=strict','--property=RestrictSUIDSGID=true','--property=UMask=0027','--property=WorkingDirectory='+str(cwd),*extra,*args]
    subprocess.run(command,check=True,timeout=30,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
def candidate_config(p,release,ports):
    block=assets_block(p['target']['root']+'/current/public',str(release/'public')).replace(p['target']['root']+'/current/public',str(release/'public'))
    return '{\n admin off\n auto_https off\n persist_config off\n default_bind 127.0.0.1\n}\nhttp://127.0.0.1:'+str(ports[1])+' {\n route {\n'+block+'\n reverse_proxy 127.0.0.1:'+str(ports[0])+'\n }\n}\n'
def candidate(p):
    unchanged(p);s=stage(p);assert (s/'prepared.json').is_file();release=staged(p);t=p['target'];ports=[t['candidate_port'],p['asset_candidate_port']]
    for port in ports:
        with socket.socket() as sock:sock.bind(('127.0.0.1',port))
    raw=pathlib.Path('/etc',t['service'],'runtime.env').read_bytes();candidate_raw,n=re.subn(rb'^(PORT|NITRO_PORT)=.*$',lambda m:m.group(1)+b'="'+str(ports[0]).encode()+b'"',raw,flags=re.M);assert n==2
    env=s/'candidate.env'
    with env.open('xb') as f:f.write(candidate_raw)
    env.chmod(0o600)
    cfg=candidate_config(p,release,ports)
    config=s/'candidate.Caddyfile'
    with config.open('x') as f:f.write(cfg)
    config.chmod(0o600)
    app='schema95-asset-app-'+p['seal'][:16];edge='schema95-asset-edge-'+p['seal'][:16];started=[]
    try:
        unit_start(app,t['user'],release,[t['node'],str(release/'server/index.mjs')],['--property=EnvironmentFile='+str(env)]);started.append(app)
        for i in range(30):
            try:
                if probe(ports[0],'/api/admin-products/list')[0]==401:break
            except (OSError,http.client.HTTPException):pass
            time.sleep(0.5)
        else:raise AssertionError('Candidate app readiness')
        for name in ['candidate-data','candidate-config']:(s/name).mkdir(mode=0o700)
        unit_start(edge,'root',s,[p['caddy_binary'],'run','--config',str(config),'--adapter','caddyfile'],['--setenv=XDG_CONFIG_HOME='+str(s/'candidate-config'),'--setenv=XDG_DATA_HOME='+str(s/'candidate-data'),'--property=ReadWritePaths='+str(s/'candidate-config')+' '+str(s/'candidate-data')]);started.append(edge)
        for i in range(30):
            try:
                if probe(ports[1],'/_nuxt/'+p['http_assets'][0]['name'])[0]==200:break
            except (OSError,http.client.HTTPException):pass
            time.sleep(0.5)
        else:raise AssertionError('Candidate static edge readiness')
        for name,status in [('/api/storefront/content',200),('/api/account/history',401),('/api/checkout/controlled',401),('/api/checkout/shipping',401),('/api/payments/status?order_id=00000000-0000-4000-8000-000000000001',401),('/api/admin-shipping/companies/00000000-0000-4000-8000-000000000001/tariffs',401)]:assert probe(ports[0],name)[0]==status,name
        status,body=probe(ports[0],'/api/payments/capabilities');assert status==200;cap=json.loads(body);assert cap['card']['available'] is False and cap['purchase']['available'] is False
        for a in p['http_assets']:
            status,body=probe(ports[1],'/_nuxt/'+a['name']);assert status==200 and sha_bytes(body)==a['sha256']
        unchanged(p);H['save'](s/'candidate-pass.json',{'result':'PASS','seal':p['seal'],'app_and_asset_edge':True,'schema':95,'database_writes':0,'provider_calls':0})
        return {'candidate':'PASS','retained_and_new_assets':'PASS','purchasing_closed':True}
    finally:
        for unit in reversed(started):subprocess.run(['systemctl','stop',unit+'.service'],check=True,timeout=30,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
def activate(p,db):
    unchanged(p);s=stage(p);assert json.loads((s/'candidate-pass.json').read_text())['seal']==p['seal']
    assert db=={'seal':p['seal'],'schema':95,'database_writes':0,'preservation':'PASS'}
    path=pathlib.Path('/etc/caddy/Caddyfile');raw=path.read_bytes();assert sha_bytes(raw)==p['before']['recovery_files'][str(path)]['sha256'];proposed=patch(raw.decode(),p['target']['root'],p['release_id']).encode();assert sha_bytes(proposed)==p['caddy_after_sha256']
    tmp=path.with_name('Caddyfile.schema95-assets-'+p['seal'][:16]);m=H['metadata'](path)
    with tmp.open('xb') as f:f.write(proposed);f.flush();os.fsync(f.fileno())
    os.chmod(tmp,m['mode']);os.chown(tmp,m['uid'],m['gid']);H['save'](s/'edge-reload-intent.json',{'signal':'SIGUSR1','attempt':1});os.replace(tmp,path)
    process(p);os.kill(int(p['before']['caddy']['MainPID']),signal.SIGUSR1)
    # A new-only public asset proves this route loaded; no signal retry is allowed.
    for i in range(30):
        try:
            status,body=origin_asset(p,p['new_only_asset']['name'])
            if status==200 and sha_bytes(body)==p['new_only_asset']['sha256']:break
        except (OSError,http.client.HTTPException):pass
        time.sleep(0.5)
    else:raise AssertionError('New static route not confirmed; no reload retry')
    edge=H['inspect'](p);assert edge['caddy']==p['before']['caddy'] and edge['nuxt']==p['before']['nuxt'] and edge['current']==p['before']['current']
    for key in ['media','private_files']:assert edge[key]==p['before'][key]
    H['save'](s/'edge-active.json',{'new_asset_verified':True,'caddy_pid_unchanged':True,'sha256':p['caddy_after_sha256']})
    root=pathlib.Path(p['target']['root']);H['save'](s/'activation-intent.json',{'old':p['before']['current'],'new':str(staged(p)),'schema':95,'migrations_applied':0})
    link=root/('current.schema95-assets-'+p['seal'][:16]);assert not link.exists() and not link.is_symlink();link.symlink_to(staged(p));link.replace(root/'current')
    H['save'](s/'restart-intent.json',{'attempt':1});subprocess.run(['systemctl','restart',p['target']['service']+'.service'],check=True,timeout=60,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    for i in range(30):
        try:
            if probe(p['target']['port'],'/api/admin-products/list')[0]==401:break
        except (OSError,http.client.HTTPException):pass
        time.sleep(0.5)
    else:raise AssertionError('Main app readiness')
    after=inspect(p);assert after['current']==str(staged(p)) and after['nuxt']['MainPID']!=p['before']['nuxt']['MainPID'];assert after['caddy']==p['before']['caddy']
    assert after['media']==p['before']['media'] and after['private_files']==p['before']['private_files']
    for name,meta in p['before']['recovery_files'].items():
        actual=H['metadata'](name)
        if name=='/etc/caddy/Caddyfile':assert actual=={**meta,'sha256':p['caddy_after_sha256'],'bytes':len(proposed)}
        else:assert actual==meta
    H['save'](s/'completed.json',{'seal':p['seal'],'schema':95,'release':p['release_id'],'migration_replays':0,'caddy_sigusr1':1,'main_restarts':1,'provider_calls':0});return after
def main():
    global H
    os.umask(0o077);q=json.load(sys.stdin);p=q['plan'];H=helper_source(q['helper_source']);mode=q['mode'];assert mode in ['inspect','prepare','candidate','activate']
    if mode!='inspect':
        assert p['scope']==SCOPE;body={k:v for k,v in p.items() if k!='seal'};assert H['digest'](body)==p['seal'] and q['approved']==p['seal']
        assert datetime.datetime.now(datetime.timezone.utc)<=datetime.datetime.fromisoformat(p['expires_utc'].replace('Z','+00:00'))
    out=activate(p,q['database']) if mode=='activate' else globals()[mode](p);print(json.dumps(out))
if __name__=='__main__':
    try:main()
    except Exception as e:print(json.dumps({'result':'STOP','type':type(e).__name__,'message':'Preserve evidence; no automatic retry or rollback.'}));raise SystemExit(1)
