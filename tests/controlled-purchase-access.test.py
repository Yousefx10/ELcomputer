import importlib.util
import pathlib
import os
import unittest
import tempfile
import subprocess
import threading
import socket
import http.client
import time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
ROOT=pathlib.Path(__file__).resolve().parents[1]
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
prepare=module('controlled_access',ROOT/'scripts/controlled-purchase-access/prepare.py')
old=module('existing_access_fixtures',ROOT/'tests/customer-access.test.py')

class ControlledAccess(unittest.TestCase):
    def test_exact_paths_methods_auth_forwarding_and_preserved_holds(self):
        calls=[]
        class Backend(BaseHTTPRequestHandler):
            def action(self):
                calls.append((self.command,self.path,self.headers.get('Authorization')))
                self.send_response(401 if self.headers.get('Authorization')!='Bearer fixture-only' else 200)
                self.send_header('Cache-Control','public, max-age=3600');self.end_headers()
            do_GET=do_HEAD=do_POST=do_PUT=do_PATCH=do_DELETE=action
            def log_message(self,*a):pass
        backend=ThreadingHTTPServer(('127.0.0.1',0),Backend)
        threading.Thread(target=backend.serve_forever,daemon=True).start()
        try:
            for domain in ['orchid.example.invalid','cedar.example.invalid']:
                with tempfile.TemporaryDirectory() as directory:
                    base=pathlib.Path(directory)
                    with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
                    before=old.prepare.patch(old.configuration(domain,backend.server_port,port))
                    candidate=prepare.patch(before)
                    block=candidate[candidate.index('        # Controlled purchase only;'):candidate.index('        @dormant path_regexp dormant ')]
                    self.assertEqual(candidate.replace(block,''),before)
                    with self.assertRaises(AssertionError):prepare.patch(candidate)
                    config=base/'Caddyfile';config.write_text(candidate)
                    subprocess.run([os.environ['CADDY_BIN'],'adapt','--config',str(config),'--adapter','caddyfile'],check=True,capture_output=True)
                    child=subprocess.Popen([os.environ['CADDY_BIN'],'run','--config',str(config),'--adapter','caddyfile'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env={**os.environ,'XDG_DATA_HOME':str(base/'data'),'XDG_CONFIG_HOME':str(base/'config')})
                    def call(path,method='GET',auth=False):
                        c=http.client.HTTPConnection('127.0.0.1',port,timeout=3)
                        try:
                            c.request(method,path,headers={'Host':domain,**({'Authorization':'Bearer fixture-only'} if auth else {})});r=c.getresponse();r.read();return r.status,dict(r.getheaders())
                        finally:c.close()
                    try:
                        for i in range(100):
                            try:call('/');break
                            except OSError:time.sleep(.03)
                        for method,path in [('GET','/account/controlled-purchase'),('HEAD','/ar/account/controlled-purchase'),('GET','/api/checkout/controlled'),('POST','/api/checkout/controlled'),('POST','/api/payments/paymob/webhook'),('POST','/api/payments/paymob/webhook?hmac=synthetic-signature')]:
                            self.assertEqual(call(path,method)[0],401)
                            status,headers=call(path,method,True);self.assertEqual(status,200);self.assertEqual(headers['Cache-Control'],'private, no-store')
                        for method,path in [('GET','/checkout'),('GET','/ar/checkout'),('GET','/cart'),('GET','/signup'),('POST','/api/checkout'),('POST','/api/checkout/quote'),('GET','/api/payments/capabilities'),('POST','/api/payments/intentions'),('GET','/api/payments/paymob/webhook'),('POST','/api/webhooks/pdc'),('POST','/api/internal/shipping/process'),('PUT','/api/checkout/controlled'),('GET','/api/checkout/controlled/extra'),('GET','/account/controlled-purchase/extra'),('POST','/account/controlled-purchase')]:
                            count=len(calls);self.assertEqual(call(path,method)[0],403,(method,path));self.assertEqual(len(calls),count)
                    finally:child.terminate();child.wait(timeout=10)
        finally:backend.shutdown();backend.server_close()
if __name__=='__main__':unittest.main()
