"""One SIGUSR1 against local Caddy with admin off. No production signal/callback."""
import http.client,json,os,pathlib,signal,socket,ssl,subprocess,tempfile,threading,time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer

WORK=pathlib.Path(os.environ['PDC_WEBHOOK_REVIEW_DIR']);CADDY=os.environ['CADDY_BIN']
base=(WORK/'Caddyfile.before.private').read_text();candidate=(WORK/'Caddyfile.candidate.private').read_text()
secret='offline-signal-fixture-secret-abcdefghijklmnopqrstuvwxyz'
class Backend(BaseHTTPRequestHandler):
    def action(self):
        self.rfile.read(int(self.headers.get('content-length','0')))
        status=(200 if self.headers.get('X-Webhook-Secret')==secret else 401) if self.path=='/api/webhooks/pdc' else 299
        self.send_response(status);self.end_headers()
    do_GET=do_POST=action
    def log_message(self,*args):pass
backend=ThreadingHTTPServer(('127.0.0.1',0),Backend);threading.Thread(target=backend.serve_forever,daemon=True).start()
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
checks=[];domain='reload-fixture.example.invalid'
try:
    with tempfile.TemporaryDirectory() as folder:
        d=pathlib.Path(folder)
        subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-subj','/CN='+domain,'-keyout',str(d/'key.pem'),'-out',str(d/'cert.pem'),'-days','1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True,timeout=10)
        def fixture(raw):
            raw=raw.replace('elcomputer.net',domain)
            site=f'http://{domain}, http://www.{domain}, https://{domain}, https://www.{domain} {{'
            start=raw.index(site);end=raw.rindex('\n}\n\nhttp:// {');body=raw[start+len(site):end]
            raw=raw[:start]+f'https://{domain}:{port} {{\n    bind 127.0.0.1\n    tls {d}/cert.pem {d}/key.pem'+body+'\n}\n'
            return raw.replace('admin off','admin off\n    auto_https disable_redirects',1).replace('127.0.0.1:3000','127.0.0.1:'+str(backend.server_port))
        config=d/'Caddyfile';config.write_text(fixture(base));log=(WORK/'signal-fixture.private.log').open('wb')
        child=subprocess.Popen([CADDY,'run','--config',str(config),'--adapter','caddyfile'],stdout=log,stderr=log,env={**os.environ,'XDG_DATA_HOME':str(d/'data'),'XDG_CONFIG_HOME':str(d/'config')})
        pid=child.pid
        def call(method,path,credential=None):
            c=http.client.HTTPSConnection('127.0.0.1',port,timeout=5,context=ssl._create_unverified_context())
            try:
                c.sock=ssl._create_unverified_context().wrap_socket(socket.create_connection(('127.0.0.1',port),timeout=5),server_hostname=domain)
                c.request(method,path,b'{}' if method=='POST' else None,{'Host':domain,'Content-Type':'application/json',**({'X-Webhook-Secret':credential} if credential else {})})
                r=c.getresponse();r.read();return r.status
            finally:c.close()
        try:
            ready=False
            for _ in range(100):
                try:ready=call('POST','/api/webhooks/pdc')==403
                except OSError:pass
                if ready:break
                if child.poll() is not None:raise RuntimeError('Fixture startup failed')
                time.sleep(.05)
            assert ready;checks.append('baseline_post_403')
            assert call('POST','/api/payments/paymob/webhook')==299;checks.append('baseline_paymob_route')
            config.write_text(fixture(candidate))
            os.kill(pid,signal.SIGUSR1)
            reloaded=False
            for _ in range(100):
                reloaded=call('POST','/api/webhooks/pdc')==401
                if reloaded:break
                if child.poll() is not None:raise RuntimeError('Signal stopped the fixture')
                time.sleep(.05)
            assert reloaded and child.poll() is None and child.pid==pid;checks+=['post_401_after_one_signal','same_process_pid']
            assert call('POST','/api/webhooks/pdc','wrong')==401;checks.append('wrong_secret_401')
            assert call('POST','/api/webhooks/pdc',secret)==200;checks.append('fixture_secret_200')
            for path in ['/api/webhooks/pdc/','/api/webhooks/other','/api/internal/shipping/process','/api/checkout']:
                assert call('POST',path,secret)==403;checks.append('held_'+path)
            assert call('GET','/api/webhooks/pdc')==403;checks.append('get_still_403')
            assert call('POST','/api/payments/paymob/webhook')==299;checks.append('paymob_route_preserved')
        finally:
            if child.poll() is None:child.terminate()
            child.wait(timeout=10);log.close()
finally:backend.shutdown();backend.server_close()
messages=[]
for line in (WORK/'signal-fixture.private.log').read_text().splitlines():
    try:
        entry=json.loads(line)
        if 'reload' in entry.get('msg','').lower():messages.append(entry['msg'])
    except ValueError:pass
result={'result':'PASS','signal':'SIGUSR1','signals_sent':1,'checks':checks,'checks_passed':len(checks),'admin_api':'off','process_restarts':0,'provider_calls':0,'production_signals':0,'production_callbacks':0,'reload_log_messages':messages}
(WORK/'signal-qualification.json').write_text(json.dumps(result,indent=2)+'\n');(WORK/'signal-qualification.json').chmod(0o600)
print(json.dumps(result))
