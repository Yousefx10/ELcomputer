"""Exact history-route correction only, after approved/verified private import.
No app restart, schema migration, provider request, signup or purchase activation.
"""
import datetime,hashlib,http.client,json,os,pathlib,signal,stat,subprocess,sys,time

def digest(v):return hashlib.sha256(json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def sha(v):return hashlib.sha256(v).hexdigest()
def save(path,value):
    raw=(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False)+'\n').encode()
    with path.open('xb') as out:out.write(raw);out.flush();os.fsync(out.fileno())
    path.chmod(0o600)
def show(name):
    raw=subprocess.check_output(['systemctl','show',name+'.service','--property=ActiveState,SubState,MainPID'],text=True,timeout=10)
    return dict(line.split('=',1) for line in raw.splitlines() if '=' in line)
def check(p):
    target=p['target'];cfg=pathlib.Path(p['ingress']['config_file']);assert cfg==pathlib.Path('/etc/caddy/Caddyfile') and not cfg.is_symlink()
    raw=cfg.read_bytes();assert sha(raw)==p['ingress']['before_sha256']
    current=show(target['service']);caddy=show('caddy')
    assert current['ActiveState']=='active' and current['SubState']=='running' and caddy['ActiveState']=='active'
    assert str((pathlib.Path(target['root'])/'current').resolve())==target['root']+'/releases/'+p['release_id']
    pid=int(caddy['MainPID']);cmd=[x.decode() for x in pathlib.Path('/proc/'+str(pid)+'/cmdline').read_bytes().split(b'\0') if x]
    assert cmd[1:]==['run','--config',str(cfg),'--adapter','caddyfile'] and os.readlink('/proc/'+str(pid)+'/exe')==cmd[0]
    assert subprocess.check_output(['systemctl','show','caddy','--property=CanReload','--value'],text=True,timeout=8).strip()=='no'
    assert 'admin off' in raw.decode()
    return {'config_file':str(cfg),'before_sha256':sha(raw),'caddy':caddy,'application':current,'command':cmd,'config_mode':stat.S_IMODE(cfg.stat().st_mode),'config_uid':cfg.stat().st_uid,'config_gid':cfg.stat().st_gid}
def main():
    os.umask(0o077);q=json.load(sys.stdin);p=q['plan'];assert digest({k:v for k,v in p.items() if k!='seal'})==p['seal']
    before=check(p)
    if q['mode']=='check':print(json.dumps({'result':'HISTORY_INGRESS_READ_ONLY_CHECK_PASS','configuration_writes':0,'signals':0,**before}));return
    assert q['mode']=='apply' and q.get('approved')==p['seal']
    assert p['scope']=={'historical_import':True,'schema_migrations':0,'application_deployments':0,'auth_creation':0,'password_imports':0,'current_profile_updates':0,'current_commerce_writes':0,'automatic_auth_links':0,'provider_calls':0,'public_signup':False,'public_purchasing':False,'caddy_history_routes_only':True,'caddy_signals_max':1,'application_restarts':0,'automatic_retry':False,'automatic_rollback':False,'git_push':False}
    proof=q['import_proof'];assert proof['all_record_totals_currency_dates_items_refunds_addresses_events_equal'] and proof['original_data_preservation']=='PASS' and proof['source_id']==p['source_id']
    raw=q['proposed_text'].encode();assert sha(raw)==p['ingress']['proposed_sha256']
    # Validate without changing runtime or relying on a missing systemd reload.
    subprocess.run([before['command'][0],'adapt','--config','-','--adapter','caddyfile'],input=raw,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=15)
    folder=pathlib.Path('/var/lib/customer-history-import')/p['seal'][:16]
    folder.parent.mkdir(mode=0o700,exist_ok=True);assert not folder.parent.is_symlink();folder.mkdir(mode=0o700)
    save(folder/'plan.json',p);save(folder/'before.json',before)
    (folder/'Caddyfile.before').write_bytes(pathlib.Path(before['config_file']).read_bytes());(folder/'Caddyfile.before').chmod(0o600)
    latest=subprocess.check_output(['journalctl','-u','caddy.service','_PID='+before['caddy']['MainPID'],'-n','1','--output=json','--no-pager'],text=True,timeout=8).strip().splitlines();assert latest
    cursor=json.loads(latest[-1])['__CURSOR'];cfg=pathlib.Path(before['config_file']);temp=cfg.with_name(cfg.name+'.history-'+p['seal'][:16])
    assert not temp.exists() and not temp.is_symlink()
    save(folder/'config-intent.json',{'before':p['ingress']['before_sha256'],'after':p['ingress']['proposed_sha256'],'automatic_retry':False})
    fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,before['config_mode'])
    with os.fdopen(fd,'wb') as out:out.write(raw);out.flush();os.fsync(out.fileno());os.fchown(out.fileno(),before['config_uid'],before['config_gid']);os.fchmod(out.fileno(),before['config_mode'])
    assert sha(cfg.read_bytes())==p['ingress']['before_sha256'];os.replace(temp,cfg)
    parentfd=os.open(cfg.parent,os.O_DIRECTORY)
    try:os.fsync(parentfd)
    finally:os.close(parentfd)
    save(folder/'signal-intent.json',{'signal':'SIGUSR1','pid':before['caddy']['MainPID'],'attempt':1,'journal_cursor':cursor,'utc':datetime.datetime.now(datetime.timezone.utc).isoformat()})
    os.kill(int(before['caddy']['MainPID']),signal.SIGUSR1)
    confirmed=False;lines='';deadline=time.monotonic()+15
    while time.monotonic()<deadline:
        lines=subprocess.check_output(['journalctl','-u','caddy.service','_PID='+before['caddy']['MainPID'],'--after-cursor='+cursor,'-n','200','--output=json','--no-pager'],text=True,timeout=5)
        if any('successfully reloaded config from file' in json.loads(line).get('MESSAGE','') for line in lines.splitlines() if line.startswith('{')):confirmed=True;break
        time.sleep(.25)
    (folder/'reload-journal.private.log').write_text(lines);assert confirmed
    assert sha(cfg.read_bytes())==p['ingress']['proposed_sha256'];assert show('caddy')==before['caddy'];assert show(p['target']['service'])==before['application']
    checks=[]
    for method,path,expected in [('GET','/api/account/history',401),('POST','/api/account/history/claim',401),('GET','/api/account/history/'+p['source_id']+'/1',401),('GET','/checkout',403),('GET','/cart',403),('GET','/login',200)]:
        c=http.client.HTTPSConnection(p['target']['domain'],timeout=10)
        try:c.request(method,path,body=b'{"confirmed":true}' if method=='POST' else None,headers={'Content-Type':'application/json'} if method=='POST' else {});r=c.getresponse();assert r.status==expected;(r.read(2*1024*1024));checks.append({'method':method,'path':path,'status':r.status})
        finally:c.close()
    result={'result':'HISTORY_ONLY_INGRESS_PASS','seal':p['seal'],'signals':1,'caddy_pid_unchanged':True,'application_restarts':0,'configuration_writes':1,'public_checks':checks,'provider_calls':0}
    save(folder/'completed.json',result);print(json.dumps(result))
if __name__=='__main__':
    try:main()
    except Exception as e:print(json.dumps({'result':'STOP','error_type':type(e).__name__,'message':'Preserve receipts; no second signal, retry, restart or automatic rollback.'}));raise SystemExit(1)
