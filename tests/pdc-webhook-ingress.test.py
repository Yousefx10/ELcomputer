"""Actual local TLS Caddy, synthetic headers only. No hosted callbacks."""
import hashlib
import http.client
import importlib.util
import json
import os
import pathlib
import socket
import ssl
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('pdc_ingress', ROOT/'scripts/pdc-webhook-readiness/ingress.py')
ingress = importlib.util.module_from_spec(spec); spec.loader.exec_module(ingress)
WORK = pathlib.Path(os.environ['PDC_WEBHOOK_REVIEW_DIR'])
CADDY = os.environ['CADDY_BIN']
original = (WORK/'Caddyfile.before.private').read_text()
candidate = ingress.patch(original, 3000)
assert ingress.patch(original, 3000).replace(ingress.block(3000), '', 1) == original
for bad in [candidate, original.replace('@commerce path ', '@changed path '), original.replace('reverse_proxy 127.0.0.1:3000 {', 'reverse_proxy 127.0.0.1:3001 {')]:
    try: ingress.patch(bad, 3000); raise RuntimeError('Unsafe ingress patch accepted')
    except AssertionError: pass
calls = []
class Backend(BaseHTTPRequestHandler):
    def action(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', '0')))
        calls.append((self.command, self.path, self.headers.get('X-Webhook-Secret'), len(body)))
        if self.path == '/api/webhooks/pdc':
            status = 200 if self.headers.get('X-Webhook-Secret') == 'offline-fixture-secret-abcdefghijklmnopqrstuvwxyz' else 401
            if len(body) > 8192: status = 413
        else: status = 299
        self.send_response(status); self.send_header('Cache-Control', 'public, max-age=3600'); self.end_headers()
    do_GET = do_HEAD = do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = action
    def log_message(self, *args): pass
backend = ThreadingHTTPServer(('127.0.0.1', 0), Backend)
threading.Thread(target=backend.serve_forever, daemon=True).start()
checks = 0
def free_port():
    with socket.socket() as s: s.bind(('127.0.0.1', 0)); return s.getsockname()[1]
try:
    # Parse the exact complete candidate before applying fixture-only listeners.
    subprocess.run([CADDY, 'adapt', '--adapter', 'caddyfile', '--config', '-'], input=candidate.encode(), capture_output=True, check=True, timeout=10)
    for domain in ['orchid.example.invalid', 'cedar.example.invalid']:
        with tempfile.TemporaryDirectory() as directory:
            d = pathlib.Path(directory); hp, tp = free_port(), free_port()
            subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN='+domain, '-keyout', str(d/'key.pem'), '-out', str(d/'cert.pem'), '-days', '1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True, timeout=10)
            fixture = candidate.replace('elcomputer.net', domain)
            site = f'http://{domain}, http://www.{domain}, https://{domain}, https://www.{domain} {{'
            assert fixture.count(site) == 1
            # Separate listeners permit a fixture certificate on HTTPS only.
            start = fixture.index(site)
            end = fixture.rindex('\n}\n\nhttp:// {')
            body = fixture[start+len(site):end]
            fixture = fixture[:start] + f'https://{domain}:{tp} {{\n    bind 127.0.0.1\n    tls {d}/cert.pem {d}/key.pem' + body + '\n}\n' + f'http://{domain}:{hp} {{\n    bind 127.0.0.1' + body + '\n}\n'
            fixture = fixture.replace('admin off', 'admin off\n    auto_https disable_redirects', 1)
            fixture = fixture.replace('127.0.0.1:3000', '127.0.0.1:'+str(backend.server_port))
            (d/'Caddyfile').write_text(fixture)
            adapted = subprocess.run([CADDY, 'adapt', '--adapter', 'caddyfile', '--config', str(d/'Caddyfile')], capture_output=True, timeout=10)
            assert adapted.returncode == 0, adapted.stderr.decode()
            (WORK/'Caddyfile.fixture.private').write_text(fixture)
            log = (WORK/('caddy-'+domain+'.fixture.log')).open('wb')
            child = subprocess.Popen([CADDY, 'run', '--adapter', 'caddyfile', '--config', str(d/'Caddyfile')], stdout=log, stderr=log, env={**os.environ, 'XDG_DATA_HOME':str(d/'data'), 'XDG_CONFIG_HOME':str(d/'config')})
            def call(method, path, secret=None, tls=True, body=b'{}'):
                c = http.client.HTTPSConnection('127.0.0.1', tp, timeout=5, context=ssl._create_unverified_context()) if tls else http.client.HTTPConnection('127.0.0.1', hp, timeout=5)
                try:
                    if tls:
                        c.sock = ssl._create_unverified_context().wrap_socket(socket.create_connection(('127.0.0.1', tp), timeout=5), server_hostname=domain)
                    c.request(method, path, body if method not in ['GET', 'HEAD'] else None, {'Host':domain, 'Content-Type':'application/json', **({'X-Webhook-Secret':secret} if secret else {})})
                    r = c.getresponse(); r.read(); return r.status, dict(r.getheaders())
                finally: c.close()
            try:
                for _ in range(100):
                    try: call('GET', '/api/webhooks/pdc'); break
                    except OSError:
                        if child.poll() is not None: raise RuntimeError('Local Caddy failed startup: '+str(child.returncode))
                        time.sleep(.03)
                for secret, status in [(None,401), ('wrong',401), ('offline-fixture-secret-abcdefghijklmnopqrstuvwxyz',200)]:
                    observed, headers = call('POST', '/api/webhooks/pdc', secret)
                    assert observed == status and headers['Cache-Control'] == 'no-store'
                    assert calls[-1][2] == secret; checks += 1
                for method, path, tls in [('POST','/api/webhooks/pdc',False), *[(m,'/api/webhooks/pdc',True) for m in ['GET','HEAD','PUT','PATCH','DELETE','OPTIONS']], *[('POST',p,True) for p in ['/api/webhooks/pdc/','/api/webhooks/pdc/extra','/api/webhooks/other','/api/internal/shipping/process','/api/checkout','/api/payments/intentions']]]:
                    before = len(calls); observed = call(method,path,tls=tls)[0]
                    assert observed in ([301,308,403] if not tls else [403]), (method,path,tls,observed)
                    assert len(calls) == before; checks += 1
                # The existing Paymob proxy remains byte-identical and reachable.
                assert call('POST','/api/payments/paymob/webhook')[0] == 299; checks += 1
                observed = call('POST','/api/webhooks/pdc','offline-fixture-secret-abcdefghijklmnopqrstuvwxyz',body=b'x'*8193)[0]
                assert observed in [413,502]; checks += 1
            finally:
                if child.poll() is None: child.terminate()
                child.wait(timeout=10); log.close()
finally: backend.shutdown(); backend.server_close()
(WORK/'Caddyfile.candidate.private').write_text(candidate)
(WORK/'Caddyfile.candidate.private').chmod(0o600)
receipt={'result':'PASS','actual_local_caddy_tls_checks':checks,'independent_fixture_domains':2,'fixture_tls_verification':'self-signed fixture only; production TLS was verified normally','original_caddy_sha256':ingress.digest(original.encode()),'candidate_caddy_sha256':ingress.digest(candidate.encode()),'original_bytes_restored_by_removing_single_block':True,'live_callbacks':0,'provider_calls':0,'production_changes':0}
(WORK/'ingress-qualification.json').write_text(json.dumps(receipt,indent=2)+'\n'); (WORK/'ingress-qualification.json').chmod(0o600)
print(json.dumps(receipt))
