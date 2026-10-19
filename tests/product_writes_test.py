"""Three-command upgrade, raw request boundaries and preserved ADM-01 reads."""
import os
import json
import re
import tempfile
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import dashboard_access_test as harness
from dashboard_access import digest, read_path_pattern, read_policy, render, render_reads
from config_parser import parse, walk
from product_writes import MARKER, WRITES, render_product_writes
from prepare_product_writes import prepare

UUID = harness.UUID


def accepted(source, binding):
    old, _ = render(source, binding)
    return render_reads(old, {**binding, 'source_sha256': digest(old)})[0]


def upgrade(source, binding):
    old = accepted(source, binding)
    return render_product_writes(old, {**binding, 'source_sha256': digest(old)})


class RendererTests(unittest.TestCase):
    def test_local_review_package_is_private_pinned_and_never_overwritten(self):
        source, binding = harness.fixture()
        old = accepted(source, binding)
        binding = {**binding, 'source_sha256': digest(old)}
        with tempfile.TemporaryDirectory(prefix='products-review-owned-') as directory:
            root = Path(directory)
            (root / 'source').write_text(old)
            (root / 'binding').write_text(json.dumps(binding))
            output = root / 'review'
            receipt = prepare(root / 'source', root / 'binding', output)
            self.assertEqual((root / 'source').read_text(), old)
            self.assertEqual(output.stat().st_mode & 0o777, 0o700)
            self.assertEqual(digest((output / 'candidate.conf').read_bytes()), receipt['candidate_sha256'])
            self.assertEqual(receipt['production_changes'], 0)
            self.assertEqual(set(receipt['renderer_inputs']), {
                'product_writes.py', 'dashboard_access.py', 'config_parser.py', 'dashboard_read_policy.json'})
            for file in output.iterdir(): self.assertEqual(file.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError): prepare(root / 'source', root / 'binding', output)
            (root / 'source').write_text(old + '\n')
            with self.assertRaisesRegex(ValueError, 'SOURCE_HASH_MISMATCH'):
                prepare(root / 'source', root / 'binding', root / 'never-created')
            self.assertFalse((root / 'never-created').exists())

    def test_exact_changes_portability_and_read_policy_preservation(self):
        for host, alias in [('orchard.example.test', 'www.orchard.example.test'),
                            ('merchant.other.test', 'shop.other.test')]:
            source, binding = harness.fixture(host, alias)
            old = accepted(source, binding)
            candidate, result = render_product_writes(old, {**binding, 'source_sha256': digest(old)})
            self.assertEqual(result['approved_get_patterns'], 70)
            self.assertEqual(result['held_get_patterns'], 10)
            self.assertFalse(result['deployment_authorized'])
            self.assertEqual(candidate.count('proxy_next_upstream off;'), 3)
            # Independently reverse the four logical changes, byte for byte.
            restored = candidate.replace(MARKER + '\n', '')
            for path, method in WRITES:
                restored = restored.replace('    "~^' + re.escape(host) + '[|]' + method + '[|]'
                                            + read_path_pattern(path)[1:] + '" 0;\n', '')
                selector = ['~', read_path_pattern(path)] if ':' in path else ['=', path]
                node = next(n for n in walk(parse(restored)) if n['name'] == 'location' and n['args'] == selector)
                before = restored[node['start']:node['end']]
                methods = next(r['methods'] for r in read_policy()['routes'] if r['path'] == path)
                after = before.replace('if ($request_method !~ ^(' + '|'.join(methods + [method]) + ')$)',
                                       'if ($request_method !~ ^(' + '|'.join(methods) + ')$)')
                restored = restored[:node['start']] + after + restored[node['end']:]
            restored = restored.replace('\nproxy_next_upstream off;\n', '')
            self.assertEqual(restored, old)

    def test_unapproved_source_shape_and_reapplication_fail_closed(self):
        source, binding = harness.fixture()
        old = accepted(source, binding)
        bound = {**binding, 'source_sha256': digest(old)}
        with self.assertRaisesRegex(ValueError, 'SOURCE_HASH_MISMATCH'):
            render_product_writes(old + '\n', bound)
        for before, after in [
            ('# ADM-01-READS-v1:', '# changed:'),
            ('[|]POST[|]/api/admin-logs$ 0;', '[|]POST[|]/api/admin-.* 0;'),
            ('if ($request_method !~ ^(GET)$)', 'if ($request_method !~ ^(GET|POST)$)'),
            ('proxy_cache off;', 'proxy_cache shared;'),
            ('proxy_pass http://127.0.0.1:9102;', 'proxy_pass http://127.0.0.1:9199;'),
            ('location = /api/admin-products {', 'location = /api/admin-products { rewrite ^ /other;'),
        ]:
            changed = old.replace(before, after)
            with self.subTest(before=before), self.assertRaises(ValueError):
                render_product_writes(changed, {**bound, 'source_sha256': digest(changed)})
        candidate, _ = render_product_writes(old, bound)
        with self.assertRaisesRegex(ValueError, 'PRODUCT_WRITES_ALREADY_PRESENT'):
            render_product_writes(candidate, {**bound, 'source_sha256': digest(candidate)})


class RoutingFixture(harness.RoutingFixture):
    do_PATCH = harness.RoutingFixture.do_GET


@unittest.skipUnless(os.environ.get('DASHBOARD_REVIEW_NGINX'), 'Requires actual local Nginx')
class ProductsNginxTests(unittest.TestCase):
    site_host = 'orchard.example.test'
    site_alias = 'www.orchard.example.test'
    upstream_handler = RoutingFixture
    candidate_renderer = staticmethod(upgrade)
    setUpClass = classmethod(harness.NginxTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.NginxTests.tearDownClass.__func__)
    request = classmethod(harness.NginxTests.request.__func__)

    def test_three_commands_reach_upstream_without_conferring_authentication(self):
        for path, method in WRITES:
            path = path.replace(':id', UUID)
            self.assertEqual(self.request(path, method)[0], 401)
            self.assertEqual(self.request(path, method, token='invalid')[0], 401)
            status, headers, _ = self.request(path, method, token='fixture-only')
            self.assertEqual(status, 200)
            self.assertEqual(headers['Cache-Control'], 'private, no-store')
            self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
            self.assertEqual(headers['Content-Security-Policy'], "frame-ancestors 'self'")

    def test_raw_path_query_alias_method_and_sibling_denials(self):
        for template, allowed in WRITES:
            path = template.replace(':id', UUID)
            for method in ('POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS', 'TRACE', 'post'):
                if method == allowed: continue
                self.assertIn(self.request(path, method, token='fixture-only')[0], (400, 405))
            for changed in (path + '/', path + '?x=1', path + '?', path + '/extra',
                            path.replace('/api/', '/%61pi/'), path.replace('admin-', 'Admin-'),
                            path.replace('/api/', '/api//'), path.replace('/api/', '/api/%2e/'),
                            path.replace('/api/', '/api/x/../'), path.replace('/api/', '/api%2f')):
                self.assertIn(self.request(changed, allowed, token='fixture-only')[0], (400, 403, 405), changed)
            for host in (self.site_alias, 'store-internal-alias.test', 'unrelated.example.test'):
                self.assertNotEqual(self.request(path, allowed, host, 'fixture-only')[0], 200)
        root = Path(__file__).resolve().parents[1] / 'server/api'
        exceptions = {(p.replace(':id', UUID), m) for p, m in WRITES} | {('/api/admin-logs', 'POST')}
        for file in root.rglob('*.js'):
            parts = file.relative_to(root).as_posix().split('/')
            if not (parts[0].startswith('admin-') or parts[0] == 'customer-users'): continue
            name = parts[-1].split('.')
            if len(name) != 3 or name[-2] == 'get': continue
            method = name[-2].upper()
            parts[-1] = name[0]
            if parts[-1] == 'index': parts.pop()
            path = '/api/' + '/'.join(UUID if p.startswith('[') else p for p in parts)
            if (path, method) in exceptions: continue
            self.assertEqual(self.request(path, method, token='fixture-only')[0], 405, (path, method))

    def test_all_70_reads_ten_holds_and_commercial_boundaries_survive(self):
        for row in read_policy()['routes']:
            path = row['path'].replace(':id', UUID).replace(':sessionId', UUID).replace(':token', 'UNIT-001')
            if row['decision'] == 'hold':
                for method in ('GET', 'HEAD'):
                    self.assertEqual(self.request(path, method, token='fixture-only')[0], 403)
            else:
                for method in row['methods']:
                    self.assertEqual(self.request(path + '?q=kept', method, token='fixture-only')[0], 200)
                self.assertEqual(self.request(path)[0], 401)
        for path in ('/checkout', '/signup', '/ar/checkout', '/ar/signup', '/account', '/cart'):
            self.assertEqual(self.request(path)[0], 403)
        for path in ('/api/checkout', '/api/payments/intentions', '/api/auth/signup', '/api/admin-uploads'):
            self.assertEqual(self.request(path)[0], 403)
            self.assertEqual(self.request(path, 'POST', token='fixture-only')[0], 405)


class OtherStoreProductsNginxTests(ProductsNginxTests):
    site_host = 'merchant.other.test'
    site_alias = 'shop.other.test'


if __name__ == '__main__': unittest.main(verbosity=2)
