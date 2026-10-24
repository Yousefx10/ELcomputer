"""Read-only preflight or one explicitly approved inbound-only Caddy reload."""
import base64,datetime,hashlib,http.client,json,os,pathlib,shlex,stat,subprocess,sys

def sha(value): return hashlib.sha256(value).hexdigest()
def stable(value): return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def save(path, data):
    with path.open('xb') as out: out.write(data); out.flush(); os.fsync(out.fileno())
    path.chmod(0o600)
def service(name):
    result = dict(line.split('=',1) for line in subprocess.check_output(['systemctl','show',name,'--property=MainPID,ActiveState,SubState,NRestarts'],text=True,timeout=8).splitlines())
    assert result['ActiveState']=='active' and result['SubState']=='running' and result['NRestarts']=='0'
    return result
def snapshot(p, expected_caddy):
    t=p['target']; root=pathlib.Path(t['root']); current=(root/'current').resolve()
    assert os.geteuid()==0 and pathlib.Path('/etc/machine-id').read_text().strip()==t['machine_id']
    assert str(current)==p['expected_release'] and current.parent==root/'releases'
    assert sha((current/'server/chunks/nitro/nitro.mjs').read_bytes())==p['expected_nitro_sha256']
    assert json.loads((current/'VERIFIED.json').read_text())['archive_sha256']==p['expected_archive_sha256']
    config=pathlib.Path('/etc/caddy/Caddyfile'); s=config.lstat(); assert stat.S_ISREG(s.st_mode) and s.st_uid==0 and not s.st_mode & 0o022
    assert sha(config.read_bytes())==expected_caddy
    runtime=pathlib.Path('/etc')/t['service']/'runtime.env'; assert sha(runtime.read_bytes())==p['expected_runtime_sha256']
    app=service(t['service']); caddy=service('caddy')
    assert app==p['expected_service'] and caddy==p['expected_caddy_service']
    assert os.readlink('/proc/'+app['MainPID']+'/cwd')==str(current)
    env=dict(item.decode().split('=',1) for item in pathlib.Path('/proc/'+app['MainPID']+'/environ').read_bytes().split(b'\0') if item)
    for key in ['NUXT_PUBLIC_PURCHASING_ENABLED','NUXT_PAYMOB_ENABLED','NUXT_PAYMOB_LIVE_REQUESTS_ENABLED','NUXT_SHIPPING_LIVE_REQUESTS_ENABLED','PDC_LIVE_REQUESTS_ENABLED']: assert env.get(key,'false')=='false'
    c=http.client.HTTPConnection('127.0.0.1',t['port'],timeout=5)
    try: c.request('GET','/api/admin-products/list'); response=c.getresponse(); assert response.status==401; response.read(8192)
    finally: c.close()
    return {'release':str(current),'service':app,'caddy':caddy,'caddy_sha256':expected_caddy,'runtime_unchanged':True,'gates_closed':True,'provider_calls':0}

def main():
    os.umask(0o077); q=json.load(sys.stdin); p=q['plan']; body={k:v for k,v in p.items() if k!='seal'}
    assert sha(stable(body).encode())==p['seal'] and p['format']=='pdc-inbound-only/v1'
    assert p['scope']=={'application_deployment':False,'runtime_changes':False,'database_writes':False,'provider_calls':False,'provider_registration':False,'caddy_reloads':1,'unauthenticated_denial_probes':1}
    before=snapshot(p,p['baseline_caddy_sha256'])
    if q['mode']=='check': print(json.dumps({'result':'READ_ONLY_CHECK_PASS',**before})); return
    assert q['mode']=='apply' and q.get('approved')==p['seal']
    raw=base64.b64decode(q['candidate']); addition=q['addition'].encode(); baseline=pathlib.Path('/etc/caddy/Caddyfile').read_bytes()
    assert sha(raw)==p['candidate_caddy_sha256'] and sha(addition)==p['addition_sha256']
    anchor=b'        @commerce path '; assert baseline.count(anchor)==1 and b'@pdc_webhook' not in baseline
    assert raw==baseline.replace(anchor,addition+anchor,1)
    folder=pathlib.Path('/var/lib/pdc-webhook-ingress')/p['seal'][:16]
    folder.parent.mkdir(mode=0o700,exist_ok=True); assert not folder.parent.is_symlink(); folder.mkdir(mode=0o700)
    save(folder/'Caddyfile.before',baseline); save(folder/'Caddyfile.candidate',raw); save(folder/'plan.json',(stable(p)+'\n').encode())
    executable=os.readlink('/proc/'+before['caddy']['MainPID']+'/exe'); assert executable.startswith('/') and '(deleted)' not in executable
    assert subprocess.check_output([executable,'version'],text=True,timeout=8).startswith(p['caddy_version']+' ')
    checked=subprocess.run([executable,'validate','--adapter','caddyfile','--config',str(folder/'Caddyfile.candidate')],capture_output=True,timeout=20)
    save(folder/'validation.private.log',checked.stdout+checked.stderr); assert checked.returncode==0
    snapshot(p,p['baseline_caddy_sha256'])
    save(folder/'execution-intent.json',(stable({'seal':p['seal'],'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'automatic_retry':False})+'\n').encode())
    config=pathlib.Path('/etc/caddy/Caddyfile'); previous=config.stat(); temporary=config.with_name('Caddyfile.pdc-'+p['seal'][:16]); save(temporary,raw)
    os.chmod(temporary,stat.S_IMODE(previous.st_mode)); os.chown(temporary,previous.st_uid,previous.st_gid); os.replace(temporary,config)
    fd=os.open(str(config.parent),os.O_RDONLY); os.fsync(fd); os.close(fd)
    save(folder/'reload-intent.json',b'{"reloads":1,"automatic_retry":false}\n')
    reload=subprocess.run(['systemctl','reload','caddy'],capture_output=True,timeout=30); save(folder/'reload.private.log',reload.stdout+reload.stderr); assert reload.returncode==0
    after=snapshot(p,p['candidate_caddy_sha256'])
    c=http.client.HTTPSConnection(p['target']['domain'],timeout=8)
    try:
        # Specifically approved auth-denial probe. No credential or valid callback.
        c.request('POST','/api/webhooks/pdc',body=b'{}',headers={'Content-Type':'application/json'})
        response=c.getresponse(); assert response.status==401; response.read(8192)
    finally: c.close()
    result={'result':'INBOUND_INGRESS_PASS','seal':p['seal'],'post_without_secret':401,'provider_registration':False,'authenticated_callbacks':0,'database_writes':0,**after}
    save(folder/'completed.json',(stable(result)+'\n').encode()); print(json.dumps(result))

if __name__=='__main__':
    try: main()
    except Exception as error:
        print(json.dumps({'result':'STOP','error_type':type(error).__name__,'instruction':'Preserve staged evidence. No automatic retry, reload or rollback.'})); raise SystemExit(1)
