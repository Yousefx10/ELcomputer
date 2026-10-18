"""Actual isolated Nginx requests plus fail-closed rendering/portability tests.

Run with DASHBOARD_REVIEW_NGINX pointing to a local executable. No production
connections or identities. The upstream in this suite is a routing fixture;
separate JS tests exercise the real application authorization handlers.
"""
import contextlib
import http.client
import http.server
import os
import pathlib
import re
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts/nginx'))
from dashboard_access import (AUDIT_API, METHOD_GUARD, PAGE_GUARD, READ_APIS,
                              digest, render)

UUID = '25d1c5ed-213d-4f50-8c1a-0eb18c36262f'


def port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def fixture(host='orchard.example.test', alias='www.orchard.example.test', edge=9101, upstream=9102):
    original = '''# Existing SEO data and configuration must survive verbatim.
map $uri $legacy_target { default ""; /old-product /products/kept; }
server {
 listen 127.0.0.1:EDGE;
 server_name ALIAS owner-internal-alias.test;
 METHOD_GUARD
 PAGE_GUARD
 return 301 https://HOST$request_uri;
}
server {
 listen 127.0.0.1:EDGE;
 server_name HOST store-internal-alias.test;
 METHOD_GUARD
 PAGE_GUARD
 if ($legacy_target != "") { return 301 https://HOST$legacy_target; }
 add_header X-Content-Type-Options nosniff always;
 add_header Content-Security-Policy "frame-ancestors 'self'" always;
 location / { proxy_pass http://127.0.0.1:UPSTREAM; proxy_cache off; proxy_store off; }
 location = /api/storefront/content { proxy_pass http://127.0.0.1:UPSTREAM; }
 location ^~ /products/ { proxy_pass http://127.0.0.1:UPSTREAM; }
 location ^~ /uploads/ { proxy_pass http://127.0.0.1:UPSTREAM; }
 location ~ "/[.]git/" { return 403; }
 location /dashboard/edge-private/ { return 403; }
 location ^~ /api/ { return 403; }
}
server { listen 127.0.0.1:EDGE; server_name unrelated.example.test; return 418; }
'''.replace('METHOD_GUARD', METHOD_GUARD).replace('PAGE_GUARD', PAGE_GUARD)
    for key, value in [('EDGE', edge), ('UPSTREAM', upstream), ('ALIAS', alias), ('HOST', host)]:
        original = original.replace(key, str(value))
    binding = dict(format=1, site_origin='https://' + host, canonical_alias=alias,
                   variable_prefix='orchard_dashboard', source_sha256=digest(original),
                   runtime_upstream='http://127.0.0.1:' + str(upstream))
    return original, binding


class RendererTests(unittest.TestCase):
    def test_two_independent_businesses_preserve_identity_and_public_routes(self):
        for host, alias, prefix, upstream in [('orchard.example.test', 'www.orchard.example.test', 'orchard', 9102),
                                              ('merchant.other.test', 'shop.other.test', 'merchant', 9202)]:
            with self.subTest(host=host):
                original, binding = fixture(host, alias, upstream=upstream)
                binding['variable_prefix'] = prefix
                candidate, result = render(original, binding)
                self.assertEqual(result['canonical_origin'], 'https://' + host)
                self.assertIn('~^' + re.escape(host) + '[|]POST[|]/api/admin-logs$ 0;', candidate)
                self.assertIn('$' + prefix + '_method_denied', candidate)
                self.assertIn('proxy_pass http://127.0.0.1:' + str(upstream), candidate)
                for line in original.splitlines():
                    if any(word in line for word in ('server_name ', 'listen ', 'legacy_target', '/products/', '/uploads/', 'unrelated.example')):
                        self.assertIn(line, candidate)
                for forbidden in ('elcomputer', 'amighioggheqddyypgcl', '/home/', '/Users/'):
                    self.assertNotIn(forbidden, candidate.lower())

    def test_rejects_wrong_source_and_reapplication(self):
        original, binding = fixture()
        with self.assertRaisesRegex(ValueError, 'SOURCE_HASH_MISMATCH'):
            render(original + '\n', binding)
        candidate, _ = render(original, binding)
        binding['source_sha256'] = digest(candidate)
        with self.assertRaisesRegex(ValueError, 'VARIABLE_COLLISION'):
            render(candidate, binding)

    def test_rejects_unsafe_or_unreviewed_binding(self):
        original, binding = fixture()
        cases = [('site_origin', 'http://orchard.example.test'),
                 ('site_origin', 'https://orchard.example.test/login'),
                 ('site_origin', 'https://user@orchard.example.test'),
                 ('site_origin', 'https://orchard.example.test?next=outside'),
                 ('canonical_alias', '*.example.test'),
                 ('runtime_upstream', 'http://0.0.0.0:3002'),
                 ('runtime_upstream', 'http://127.0.0.1:99999'),
                 ('variable_prefix', 'name; return 200'),
                 ('additional_property', 'unreviewed')]
        for key, value in cases:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                render(original, {**binding, key: value})

    def test_rejects_preimage_routing_drift(self):
        original, binding = fixture()
        cases = [('proxy_cache off;', 'proxy_cache shared;'),
                 ('proxy_store off;', ''),
                 ('location / {', 'location / { rewrite ^ /elsewhere;'),
                 ('location ^~ /api/ { return 403; }', 'location /api/ { return 403; }'),
                 (PAGE_GUARD, PAGE_GUARD.replace('dashboard|', '')),
                 ('location / {', 'location ^~ /api/admin-orders/ { return 403; } location / {')]
        for before, after in cases:
            changed = original.replace(before, after)
            with self.subTest(before=before), self.assertRaises(ValueError):
                render(changed, {**binding, 'source_sha256': digest(changed)})

    def test_inherited_headers_are_preserved_and_cannot_inject_directives(self):
        original, binding = fixture()
        original = original.replace(' add_header X-Content-Type-Options nosniff always;\n', '').replace(' add_header Content-Security-Policy "frame-ancestors \'self\'" always;\n', '')
        binding['source_sha256'] = digest(original)
        candidate, _ = render(original, binding, ['add_header X-Frame-Options DENY always;'])
        self.assertEqual(candidate.count('add_header X-Frame-Options DENY always;'), len(READ_APIS) + 6)
        with self.assertRaisesRegex(ValueError, 'INHERITED_HEADER_DIRECTIVE'):
            render(original, binding, ['add_header X-Test yes; return 200;'])


class RoutingFixture(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if self.path.startswith('/api/') and self.path.split('?')[0] not in ('/api/storefront/content', '/api/storefront/dashboard-appearance', '/api/_nuxt_icon/lucide.json'):
            code = 401 if self.headers.get('authorization') != 'Bearer fixture-only' else 200
        elif self.path in ('/dashboard', '/ar/dashboard'):
            self.send_response(302)
            self.send_header('Location', self.path + '/login')
            self.end_headers()
            return
        else:
            code = 200
        raw = b'{"fixture":true}'
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'public, max-age=3600')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(raw)

    def do_POST(self):
        self.do_GET()


@unittest.skipUnless(os.environ.get('DASHBOARD_REVIEW_NGINX'), 'Set DASHBOARD_REVIEW_NGINX for isolated real Nginx tests')
class NginxTests(unittest.TestCase):
    site_host = 'orchard.example.test'
    site_alias = 'www.orchard.example.test'
    candidate_renderer = staticmethod(render)
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='dashboard-nginx-owned-')
        cls.directory = pathlib.Path(cls.temp.name)
        cls.upstream = http.server.ThreadingHTTPServer(('127.0.0.1', 0), RoutingFixture)
        cls.thread = threading.Thread(target=cls.upstream.serve_forever, daemon=True)
        cls.thread.start()
        cls.edge = port()
        cls.original, cls.binding = fixture(host=cls.site_host, alias=cls.site_alias, edge=cls.edge, upstream=cls.upstream.server_port)
        candidate, _ = cls.candidate_renderer(cls.original, cls.binding)
        config = cls.directory / 'nginx.conf'
        config.write_text('daemon off;\nworker_processes 1;\nerror_log "' + str(cls.directory / 'error.log') + '";\npid "' + str(cls.directory / 'nginx.pid') + '";\nevents { worker_connections 128; }\nhttp { access_log off; client_body_temp_path "' + str(cls.directory / 'body') + '"; proxy_temp_path "' + str(cls.directory / 'proxy') + '";\n' + candidate + '\n}\n')
        args = [os.environ['DASHBOARD_REVIEW_NGINX'], '-p', str(cls.directory) + '/', '-c', str(config)]
        checked = subprocess.run(args + ['-t'], capture_output=True)
        if checked.returncode:
            raise RuntimeError(checked.stderr.decode())
        cls.process = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                if cls.request('/')[0] == 200:
                    break
            except (OSError, http.client.HTTPException):
                pass
            if cls.process.poll() is not None:
                raise RuntimeError((cls.directory / 'error.log').read_text())
            time.sleep(.03)
        else:
            raise RuntimeError('Local Nginx readiness timeout')

    @classmethod
    def request(cls, path, method='GET', host=None, token=None):
        connection = http.client.HTTPConnection('127.0.0.1', cls.edge, timeout=5)
        headers = {'Host': host or cls.site_host, **({'Authorization': 'Bearer ' + token} if token else {})}
        connection.request(method, path, body='{}' if method == 'POST' else None, headers=headers)
        response = connection.getresponse()
        raw = response.read()
        answer = response.status, dict(response.getheaders()), raw
        connection.close()
        return answer

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        cls.process.wait(timeout=5)
        cls.upstream.shutdown()
        cls.upstream.server_close()
        cls.thread.join(timeout=5)
        cls.temp.cleanup()

    def test_login_locales_refresh_and_canonical_alias(self):
        for path in ('/dashboard/login', '/ar/dashboard/login', '/dashboard/products', '/ar/dashboard/commerce?tab=warehouses'):
            for method in ('GET', 'HEAD'):
                with self.subTest(path=path, method=method):
                    status, headers, _ = self.request(path, method)
                    self.assertEqual(status, 200)
                    self.assertEqual(headers.get('Cache-Control'), 'private, no-store')
                    self.assertEqual(headers.get('X-Content-Type-Options'), 'nosniff')
                    self.assertEqual(headers.get('Content-Security-Policy'), "frame-ancestors 'self'")
            status, headers, _ = self.request(path, host='www.orchard.example.test')
            self.assertEqual(status, 301)
            self.assertEqual(headers.get('Location'), 'https://orchard.example.test' + path)
        for path in ('/dashboard', '/ar/dashboard'):
            self.assertEqual(self.request(path)[0], 302)

    def test_exact_api_and_uuid_precedence_with_default_deny(self):
        for path in READ_APIS + ('/api/admin-products/' + UUID, '/api/admin-products/' + UUID.upper()):
            for method in ('GET', 'HEAD'):
                with self.subTest(path=path, method=method):
                    self.assertEqual(self.request(path, method, token='fixture-only')[0], 200)
                    self.assertEqual(self.request(path + '?q=test', method, token='fixture-only')[0], 200)
            if path not in ('/api/storefront/dashboard-appearance', '/api/_nuxt_icon/lucide.json'):
                self.assertEqual(self.request(path)[0], 401)
        for path in ('/api/admin-products', '/api/admin-products/list/', '/api/admin-products/' + UUID + '/',
                     '/api/admin-products/not-a-uuid', '/api/admin-products/' + UUID + '/more',
                     '/api/admin-products/transfer', '/api/admin-products/bulk', '/api/admin-users',
                     '/api/admin-logs/', '/api/admin-erp/settings', '/api/admin-orders', '/api/Admin-products/list',
                     '/api/checkout', '/api/payments/capabilities', '/api/admin-products/%2e%2e/admin-users'):
            with self.subTest(path=path):
                self.assertEqual(self.request(path, token='fixture-only')[0], 403)

    def test_all_business_mutations_stay_denied(self):
        for method in ('POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE'):
            for path in ('/', '/dashboard/login', '/dashboard', '/api/checkout', '/api/payments/intentions',
                         '/api/admin-products/list', '/api/admin-products/' + UUID, '/api/admin-users'):
                for host in ('orchard.example.test', 'www.orchard.example.test'):
                    with self.subTest(method=method, path=path, host=host):
                        self.assertEqual(self.request(path, method, host, token='fixture-only')[0], 405)

    def test_host_delimiters_cannot_change_method_classification(self):
        for host in ('evil|GET|injected', 'evil|HEAD|injected'):
            for path in ('/', '/api/checkout', '/api/admin-logs'):
                # New Nginx rejects this Host at parsing (400); older releases
                # accept it. Our method policy must still deny the POST (405).
                self.assertIn(self.request(path, 'POST', host, 'fixture-only')[0], (400, 405))

    def test_only_exact_canonical_audit_post_passes(self):
        self.assertEqual(self.request(AUDIT_API, 'POST')[0], 401)
        self.assertEqual(self.request(AUDIT_API, 'POST', token='fixture-only')[0], 200)
        self.assertEqual(self.request(AUDIT_API, 'GET', token='fixture-only')[0], 405)
        for path in (AUDIT_API, AUDIT_API + '/', AUDIT_API + '?x=1', '/api/Admin-logs', '/api//admin-logs', '/api/admin%2dlogs'):
            if path != AUDIT_API:
                self.assertEqual(self.request(path, 'POST', token='fixture-only')[0], 405)
            self.assertEqual(self.request(path, 'POST', 'www.orchard.example.test', 'fixture-only')[0], 405)

    def test_unreviewed_original_aliases_gain_no_direct_admin_access(self):
        for path in ('/dashboard/login', '/dashboard', '/ar/dashboard/commerce', '/api/admin-products/list', '/api/admin-products/' + UUID):
            self.assertEqual(self.request(path, host='store-internal-alias.test', token='fixture-only')[0], 403)
        self.assertEqual(self.request('/api/admin-logs', 'POST', 'store-internal-alias.test', 'fixture-only')[0], 405)
        self.assertEqual(self.request('/', host='store-internal-alias.test')[0], 200)

    def test_public_seo_and_unrelated_site_unchanged(self):
        for path in ('/', '/ar', '/products/kept', '/uploads/kept.jpg', '/api/storefront/content'):
            self.assertEqual(self.request(path)[0], 200)
        status, headers, _ = self.request('/old-product')
        self.assertEqual(status, 301)
        self.assertEqual(headers.get('Location'), 'https://orchard.example.test/products/kept')
        self.assertEqual(self.request('/', host='unrelated.example.test')[0], 418)
        for path in ('/dashboard/.git/config', '/ar/dashboard/.git/config', '/dashboard/edge-private/kept'):
            self.assertEqual(self.request(path)[0], 403)
        for prefix in ('', '/ar'):
            for path in ('/login', '/signup', '/signup/', '/account', '/checkout', '/cart', '/support', '/email'):
                self.assertEqual(self.request(prefix + path)[0], 403)


if __name__ == '__main__':
    unittest.main(verbosity=2)
