"""Actual loopback Caddy policy checks; no hosted requests or credentials.

CADDY_BIN=/absolute/caddy python3 tests/customer-access.test.py
"""
import hashlib
import http.client
import importlib.util
import json
import os
import pathlib
import socket
import subprocess
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / file)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


prepare = module('customer_policy', 'scripts/customer-access/prepare.py')
render = module('reinstall_render', 'scripts/clean-reinstall/render.py')
UUID = '12345678-1234-4234-8234-123456789abc'


def configuration(domain, backend, port):
    cfg = {'format': 1, 'domain': domain, 'alias': 'www.' + domain,
           'root': '/srv/storefront', 'service': 'storefront', 'user': 'storefront', 'port': backend,
           'node_version': '22.23.1', 'caddy_version': '2.11.7'}
    mapping = {'format': 1, 'paths': {'/old/': '/products/current'}, 'query_ids': {'7': '/products/current'},
               'held_paths': ['/held/'], 'held_ids': ['8']}
    return render.render(cfg, mapping, port)


class PolicyPreparation(unittest.TestCase):
    def test_only_insertion_preserves_every_original_byte_and_rejects_repeat_or_drift(self):
        original = configuration('orchid.example.invalid', 3000, 8080)
        patched = prepare.patch(original)
        beginning = patched.index('        # Authenticated account services;')
        end = patched.index('        @dormant path_regexp dormant ')
        self.assertEqual(patched[:beginning] + patched[end:], original)
        self.assertIn('127.0.0.1:3000', patched)
        with self.assertRaises(AssertionError): prepare.patch(patched)
        with self.assertRaises(AssertionError): prepare.patch(original.replace('@dormant path_regexp dormant ', '@changed '))
        with tempfile.TemporaryDirectory() as directory:
            file = pathlib.Path(directory) / 'before'; file.write_text(original)
            result = subprocess.run(['python3', str(ROOT/'scripts/customer-access/prepare.py'), str(file), str(file.parent/'out'), '--expected-sha256', '0'*64], capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse((file.parent/'out').exists())


@unittest.skipUnless(os.environ.get('CADDY_BIN'), 'CADDY_BIN required for real proxy test')
class ActualCaddy(unittest.TestCase):
    def test_two_businesses_scoped_methods_private_cache_and_unchanged_held_routes(self):
        calls = []

        class Backend(BaseHTTPRequestHandler):
            def action(self):
                calls.append((self.command, self.path))
                auth = self.headers.get('Authorization')
                data = json.dumps({'method': self.command, 'authorization': auth}).encode()
                self.send_response(200 if auth == 'Bearer fixture-only' else 401)
                self.send_header('Cache-Control', 'public, max-age=3600')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                if self.command != 'HEAD': self.wfile.write(data)
            do_GET = do_HEAD = do_POST = do_PATCH = do_DELETE = do_PUT = do_OPTIONS = action
            def log_message(self, *_): pass

        backend = ThreadingHTTPServer(('127.0.0.1', 0), Backend)
        thread = threading.Thread(target=backend.serve_forever, daemon=True); thread.start()
        try:
            for domain in ['orchid.example.invalid', 'cedar.example.invalid']:
                with self.subTest(domain=domain), tempfile.TemporaryDirectory() as folder:
                    base = pathlib.Path(folder)
                    with socket.socket() as sock: sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
                    candidate = prepare.patch(configuration(domain, backend.server_port, port))
                    config = base/'Caddyfile'; config.write_text(candidate)
                    subprocess.run([os.environ['CADDY_BIN'], 'adapt', '--adapter', 'caddyfile', '--config', str(config)], check=True, capture_output=True, timeout=10)
                    with (base/'caddy.log').open('wb') as log:
                        child = subprocess.Popen([os.environ['CADDY_BIN'], 'run', '--adapter', 'caddyfile', '--config', str(config)], stdout=log, stderr=log, env={**os.environ, 'XDG_DATA_HOME':str(base/'data'), 'XDG_CONFIG_HOME':str(base/'config')})

                        def call(path, method='GET', token='fixture-only', host=domain):
                            connection = http.client.HTTPConnection('127.0.0.1', port, timeout=3)
                            try:
                                connection.request(method, path, headers={'Host': host, **({'Authorization':'Bearer '+token} if token else {})})
                                response = connection.getresponse()
                                return response.status, dict(response.getheaders()), response.read()
                            finally: connection.close()
                        try:
                            for _ in range(100):
                                try: call('/'); break
                                except OSError: time.sleep(.03)
                            policy = json.loads((ROOT/'scripts/customer-access/policy.json').read_text())
                            allowed = [('GET','/api/account/messages'), ('PATCH',f'/api/account/messages/{UUID}/read'), ('POST',f'/api/account/messages/{UUID}/reply'),
                                       ('GET','/api/support/tickets'), ('POST','/api/support/tickets'), ('GET','/api/support/orders'), ('GET','/api/support/unread'),
                                       ('GET',f'/api/support/tickets/{UUID}'), ('PATCH',f'/api/support/tickets/{UUID}/read'), ('PATCH',f'/api/support/tickets/{UUID}'), ('POST',f'/api/support/tickets/{UUID}/messages'),
                                       ('GET','/api/account/after-sales/claims'), ('POST','/api/account/after-sales/claims'), ('GET','/api/account/after-sales/items'),
                                       ('GET',f'/api/account/after-sales/items/{UUID}/evidence'), ('POST',f'/api/account/after-sales/items/{UUID}'), ('GET',f'/api/account/after-sales/claims/{UUID}'),
                                       ('GET',f'/api/account/after-sales/claims/{UUID}/reverse'), ('POST',f'/api/account/after-sales/claims/{UUID}/actions'),
                                       ('GET','/api/customer-users'), ('GET',f'/api/customer-users/{UUID}')]
                            for method, path in allowed:
                                with self.subTest(method=method,path=path):
                                    for token, expected in [(None,401),('fixture-only',200)]:
                                        status, headers, data = call(path, method, token)
                                        self.assertEqual(status, expected)
                                        self.assertEqual(headers.get('Cache-Control'), 'private, no-store')
                                        self.assertEqual(json.loads(data)['authorization'], 'Bearer '+token if token else None)
                            for path in ['/account/messages','/account/support',f'/account/support/{UUID}','/account/after-sales',f'/ar/account/after-sales/{UUID}']:
                                self.assertEqual(call(path)[0],200)
                                self.assertEqual(call(path,'HEAD')[1].get('Cache-Control'),'private, no-store')
                            held = [('GET','/api/customer-private'), ('GET','/api/account/orders'), ('POST','/api/checkout'), ('GET','/api/payments/capabilities'), ('POST','/api/payments/paymob/webhook'), ('POST','/api/webhooks/pdc'),
                                    ('POST','/api/internal/shipping/process'), ('GET','/login'), ('GET','/signup'), ('GET','/checkout'), ('GET','/ar/checkout'), ('GET','/account'),
                                    ('POST',f'/api/support/tickets/{UUID}/attachments'), ('POST',f'/api/account/after-sales/items/{UUID}/evidence'), ('GET',f'/api/account/after-sales/evidence/{UUID}'),
                                    ('GET','/api/account/messages-extra'), ('GET','/api/customer-users-extra'), ('PUT','/api/customer-users'), ('PATCH',f'/api/customer-users/{UUID}'), ('DELETE',f'/api/customer-users/{UUID}'), ('DELETE','/api/support/tickets'), ('POST','/account/messages'),
                                    ('GET','/api/account/messages/%2e%2e/orders'), ('GET','/api/account/messages%2F..%2Forders')]
                            for method, path in held:
                                before=len(calls)
                                self.assertEqual(call(path,method)[0],403,(method,path))
                                self.assertEqual(len(calls),before,'Held request reached upstream')
                            self.assertEqual(call('/private/secret')[0],404)
                            self.assertEqual(call('/old/')[1].get('Location'),'https://'+domain+'/products/current')
                            self.assertEqual(call('/held/')[0],503)
                            self.assertEqual(call('/api/admin-products')[0],200)
                        finally:
                            child.terminate(); child.wait(timeout=10)
        finally:
            backend.shutdown(); backend.server_close(); thread.join()


if __name__ == '__main__': unittest.main()
