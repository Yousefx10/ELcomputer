"""Current-ADM upgrade, every registry route and method under real Nginx."""
import hashlib
import csv
import os
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import dashboard_access_test as harness
fixture = harness.fixture
from dashboard_access import digest, read_policy, render, render_reads

POLICY = read_policy()
UUID = '25d1c5ed-213d-4f50-8c1a-0eb18c36262f'


def example(path):
    return path.replace(':id', UUID).replace(':sessionId', UUID).replace(':token', 'UNIT-001')


def upgrade(source, binding):
    accepted, _ = render(source, binding)
    return render_reads(accepted, {**binding, 'source_sha256': digest(accepted)})


class PolicyTests(unittest.TestCase):
    def test_complete_explicit_source_inventory_and_review_inputs(self):
        root = Path(__file__).resolve().parents[1]
        files = {p.relative_to(root).as_posix() for p in (root / 'server/api').rglob('*.get.js')
                 if p.relative_to(root / 'server/api').parts[0].startswith('admin-')
                 or p.relative_to(root / 'server/api').parts[0] == 'customer-users'}
        self.assertEqual(files, {r['source'] for r in POLICY['routes']})
        self.assertEqual(len(files), 80)
        self.assertEqual(sum(r['decision'] == 'allow' for r in POLICY['routes']), 70)
        for source, expected in POLICY['review_inputs'].items():
            self.assertEqual(hashlib.sha256((root / source).read_bytes()).hexdigest(), expected, source + ' needs route review')
        matrix = list(csv.DictReader((root / 'docs/dashboard-read-api-coverage.csv').open()))
        self.assertEqual([(r['path'], r['decision'], r['methods']) for r in matrix],
                         [(r['path'], r['decision'], '|'.join(r['methods'])) for r in POLICY['routes']])

    def test_current_preimage_guards_drift_and_second_application_fail_closed(self):
        source, binding = fixture()
        accepted, _ = render(source, binding)
        binding['source_sha256'] = digest(accepted)
        with self.assertRaisesRegex(ValueError, 'SOURCE_HASH_MISMATCH'):
            render_reads(accepted + '\n', binding)
        for before, after in [
            ('proxy_cache off;', 'proxy_cache shared;'),
            ('[|]POST[|]/api/admin-logs$ 0;', '[|]POST[|]/api/admin-logs.* 0;'),
            ('private, no-store', 'public'),
            ('if ($uri != /api/admin-erp/state)', 'if ($uri != /api/other)'),
            ('return 403;\n}', 'return 200;\n}'),
            ('location / {', 'location = /api/customer-users { return 200; } location / {'),
        ]:
            changed = accepted.replace(before, after)
            self.assertNotEqual(changed, accepted)
            with self.subTest(before=before), self.assertRaises(ValueError):
                render_reads(changed, {**binding, 'source_sha256': digest(changed)})
        candidate, result = render_reads(accepted, binding)
        self.assertEqual(result['approved_reads'], 70)
        with self.assertRaisesRegex(ValueError, 'READ_POLICY_ALREADY_PRESENT'):
            render_reads(candidate, {**binding, 'source_sha256': digest(candidate)})


@unittest.skipUnless(os.environ.get('DASHBOARD_REVIEW_NGINX'), 'Set DASHBOARD_REVIEW_NGINX for actual Nginx')
class ReadsNginxTests(unittest.TestCase):
    site_host = 'orchard.example.test'
    site_alias = 'www.orchard.example.test'
    candidate_renderer = staticmethod(upgrade)
    setUpClass = classmethod(harness.NginxTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.NginxTests.tearDownClass.__func__)
    request = classmethod(harness.NginxTests.request.__func__)

    def test_every_registered_read_authentication_headers_and_no_sibling_writes(self):
        for route in POLICY['routes']:
            path = example(route['path'])
            with self.subTest(path=path):
                if route['decision'] == 'hold':
                    for method in ('GET', 'HEAD'):
                        self.assertEqual(self.request(path, method, token='fixture-only')[0], 403)
                    continue
                for method in route['methods']:
                    for query in ('', '?q=test%20value'):
                        status, headers, body = self.request(path + query, method, token='fixture-only')
                        self.assertEqual(status, 200)
                        self.assertEqual(headers.get('Cache-Control'), 'private, no-store')
                        self.assertEqual(headers.get('X-Content-Type-Options'), 'nosniff')
                        self.assertEqual(headers.get('Content-Security-Policy'), "frame-ancestors 'self'")
                        if method == 'HEAD': self.assertEqual(body, b'')
                self.assertEqual(self.request(path)[0], 401)
                self.assertEqual(self.request(path, token='invalid')[0], 401)
                if 'HEAD' not in route['methods']:
                    self.assertEqual(self.request(path, 'HEAD', token='fixture-only')[0], 405)
                for method in ('POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE', 'get'):
                    if method == 'POST' and path == '/api/admin-logs': continue
                    self.assertIn(self.request(path, method, token='fixture-only')[0], (400, 405) if method == 'get' else (405,))
                for suffix in ('/', '/extra'):
                    self.assertEqual(self.request(path + suffix, token='fixture-only')[0], 403)

    def test_raw_encoding_case_and_normalization_never_open_routes(self):
        for route in POLICY['routes']:
            path = example(route['path'])
            for changed in (path.replace('/api/', '/api//'), path.replace('/api/', '/api/%2e/'),
                            path.replace('admin-', 'Admin-'), path.replace('/api/', '/api/x/../'),
                            path.replace('/api/', '/api%2f'), path.replace('/api/', '/%61pi/')):
                if changed == path: continue
                self.assertIn(self.request(changed, token='fixture-only')[0], (400, 403), changed)
        for path in ('/api/admin-orders/not-uuid', '/api/admin-unknown', '/api/admin-products/transfer',
                     '/api/admin-orders/' + UUID + '/video', '/api/admin-products/transfer/import?job_id=' + UUID,
                     '/api/admin-inventory/items/' + UUID, '/api/admin-setup/state'):
            self.assertEqual(self.request(path, token='fixture-only')[0], 403)

    def test_canonical_alias_other_hosts_and_existing_login_audit(self):
        for route in POLICY['routes']:
            path = example(route['path'])
            status, headers, _ = self.request(path + '?x=1', host=self.site_alias)
            self.assertEqual(status, 301)
            self.assertEqual(headers.get('Location'), 'https://' + self.site_host + path + '?x=1')
            self.assertEqual(self.request(path, host='store-internal-alias.test', token='fixture-only')[0], 403)
        self.assertEqual(self.request('/api/admin-logs', 'POST', token='fixture-only')[0], 200)
        self.assertEqual(self.request('/api/admin-logs', 'POST')[0], 401)
        for path in ('/api/admin-logs/', '/api/admin-logs?x=1', '/api/admin%2dlogs', '/api//admin-logs', '/api/Admin-logs'):
            self.assertEqual(self.request(path, 'POST', token='fixture-only')[0], 405)
        self.assertEqual(self.request('/api/admin-logs', 'POST', self.site_alias, 'fixture-only')[0], 405)

    def test_locale_commercial_private_paths_and_public_resources(self):
        for locale in ('', '/ar'):
            for path in ('/dashboard/login', '/dashboard/products', '/dashboard/setup'):
                self.assertEqual(self.request(locale + path)[0], 200)
            for path in ('/account', '/cart', '/checkout', '/login', '/signup', '/support', '/email', '/dashboard/.git/config'):
                self.assertEqual(self.request(locale + path)[0], 403)
        for path in ('/api/checkout', '/api/payments/capabilities', '/api/payments/intentions', '/api/customer-orders', '/api/auth/signup', '/api/chat/status'):
            self.assertEqual(self.request(path)[0], 403)
            self.assertEqual(self.request(path, 'POST')[0], 405)
        for path in ('/', '/ar', '/products/kept', '/uploads/kept.jpg', '/api/storefront/content'):
            self.assertEqual(self.request(path)[0], 200)
        self.assertEqual(self.request('/', host='unrelated.example.test')[0], 418)

    def test_every_actual_admin_write_handler_keeps_its_method_denial(self):
        root = Path(__file__).resolve().parents[1] / 'server/api'
        for file in root.rglob('*.js'):
            parts = file.relative_to(root).as_posix().split('/')
            if not (parts[0].startswith('admin-') or parts[0] == 'customer-users'):
                continue
            name = parts[-1].split('.')
            if len(name) != 3 or name[-2] == 'get': continue
            method = name[-2].upper()
            parts[-1] = name[0]
            if parts[-1] == 'index': parts.pop()
            path = '/api/' + '/'.join(UUID if p.startswith('[') else p for p in parts)
            if method == 'POST' and path == '/api/admin-logs': continue
            with self.subTest(path=path, method=method):
                self.assertEqual(self.request(path, method, token='fixture-only')[0], 405)


class OtherStoreReadsNginxTests(ReadsNginxTests):
    site_host = 'merchant.other.test'
    site_alias = 'shop.other.test'


if __name__ == '__main__': unittest.main(verbosity=2)
