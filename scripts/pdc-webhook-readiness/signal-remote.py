"""One separately approved signal reload of the already installed candidate."""
import datetime,hashlib,http.client,json,os,pathlib,signal,subprocess,sys,time

def sha(data):return hashlib.sha256(data).hexdigest()
def stable(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def save(path,data):
    with path.open('xb') as out:out.write(data);out.flush();os.fsync(out.fileno())
    path.chmod(0o600)
def main():
    os.umask(0o077);q=json.load(sys.stdin);p=q['plan'];old=q['parent_plan']
    assert sha(stable({k:v for k,v in p.items() if k!='seal'}).encode())==p['seal']
    assert sha(stable({k:v for k,v in old.items() if k!='seal'}).encode())==old['seal']==p['parent_seal']
    assert p['format']=='pdc-installed-candidate-signal/v1'
    assert p['scope']=={'config_file_writes':0,'service_restarts':0,'signals':1,'unauthenticated_denial_probes':1,'authenticated_callbacks':0,'provider_calls':0,'database_writes':0,'provider_registration':False}
    assert sha(q['snapshot_source'].encode())==old['tools_sha256']['remote.py']
    namespace={'__name__':'sealed_ingress_snapshot'};exec(compile(q['snapshot_source'],'sealed-ingress-snapshot.py','exec'),namespace)
    snapshot=namespace['snapshot'];before=snapshot(old,old['candidate_caddy_sha256'])
    pid=int(before['caddy']['MainPID']);cmd=[x.decode() for x in pathlib.Path('/proc/'+str(pid)+'/cmdline').read_bytes().split(b'\0') if x]
    assert cmd==p['expected_caddy_command'] and cmd[1:] == ['run','--config','/etc/caddy/Caddyfile','--adapter','caddyfile']
    assert os.readlink('/proc/'+str(pid)+'/exe')==cmd[0]
    assert subprocess.check_output(['systemctl','show','caddy','--property=CanReload','--value'],text=True,timeout=8).strip()=='no'
    assert 'admin off' in pathlib.Path('/etc/caddy/Caddyfile').read_text()
    parent=pathlib.Path('/var/lib/pdc-webhook-ingress')/old['seal'][:16]
    assert not (parent/'completed.json').exists()
    assert sha((parent/'Caddyfile.before').read_bytes())==old['baseline_caddy_sha256']
    assert sha((parent/'Caddyfile.candidate').read_bytes())==old['candidate_caddy_sha256']
    assert sha((parent/'reload.private.log').read_bytes())==p['failed_reload_log_sha256']
    assert sha((parent/'validation.private.log').read_bytes())==p['validation_log_sha256']
    assert subprocess.check_output([cmd[0],'version'],text=True,timeout=8).startswith(old['caddy_version']+' ')
    latest=subprocess.check_output(['journalctl','-u','caddy.service','_PID='+str(pid),'-n','1','--output=json','--no-pager'],text=True,timeout=8).strip().splitlines()
    assert latest;cursor=json.loads(latest[-1])['__CURSOR']
    if q['mode']=='check':print(json.dumps({'result':'SIGNAL_READ_ONLY_CHECK_PASS','signal_sent':False,'config_pending_on_disk':True,'journal_confirmation_available':True,**before}));return
    assert q['mode']=='apply' and q.get('approved')==p['seal']
    folder=pathlib.Path('/var/lib/pdc-webhook-signal')/p['seal'][:16]
    folder.parent.mkdir(mode=0o700,exist_ok=True);assert not folder.parent.is_symlink();folder.mkdir(mode=0o700)
    save(folder/'plan.json',(stable(p)+'\n').encode())
    snapshot(old,old['candidate_caddy_sha256'])
    save(folder/'signal-intent.json',(stable({'signal':'SIGUSR1','pid':pid,'attempt':1,'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'journal_cursor':cursor,'automatic_retry':False})+'\n').encode())
    os.kill(pid,signal.SIGUSR1)
    confirmed=False;lines='';deadline=time.monotonic()+15
    while time.monotonic()<deadline:
        lines=subprocess.check_output(['journalctl','-u','caddy.service','_PID='+str(pid),'--after-cursor='+cursor,'-n','200','--output=json','--no-pager'],text=True,timeout=5)
        if any('successfully reloaded config from file' in json.loads(line).get('MESSAGE','') for line in lines.splitlines() if line.startswith('{')):confirmed=True;break
        time.sleep(.25)
    save(folder/'reload-journal.private.log',lines.encode());assert confirmed
    after=snapshot(old,old['candidate_caddy_sha256'])
    save(folder/'denial-probe-intent.json',b'{"method":"POST","path":"/api/webhooks/pdc","credential":false,"attempt":1}\n')
    c=http.client.HTTPSConnection(old['target']['domain'],timeout=8)
    try:
        c.request('POST','/api/webhooks/pdc',body=b'{}',headers={'Content-Type':'application/json'})
        response=c.getresponse();assert response.status==401;response.read(8192)
    finally:c.close()
    result={'result':'INBOUND_INGRESS_PASS','seal':p['seal'],'signal':'SIGUSR1','signals_sent':1,'reload_confirmed_by_journal':True,'post_without_secret':401,'configuration_file_writes':0,'service_restarts':0,'authenticated_callbacks':0,'database_writes':0,'provider_registration':False,**after}
    save(folder/'completed.json',(stable(result)+'\n').encode());print(json.dumps(result))

if __name__=='__main__':
    try:main()
    except Exception as error:print(json.dumps({'result':'STOP','error_type':type(error).__name__,'instruction':'No automatic retry, second signal, restart or rollback.'}));raise SystemExit(1)
