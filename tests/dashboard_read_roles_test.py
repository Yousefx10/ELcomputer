"""Portable terminal-server contract and isolated native Nginx regressions."""
import copy
import http.client
import json
import os
from pathlib import Path
import socket
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
import unittest

import dashboard_access_test as harness
import dashboard_reads_test as reads
from config_parser import parse
from dashboard_access import CUSTOMER_GUARD, digest, render, render_reads


def auxiliary(host, port=18080, fastcgi=19003):
    return '''server {
 return 404;
 listen PORT;
 listen [::]:PORT;
 server_name HOST;
 rewrite ^/old /index.php last;
 if ($request_method = POST) { rewrite ^ /index.php last; }
 location ~ "(?:[.]php|^/api/)" {
  try_files /missing /index.php;
  fastcgi_param SCRIPT_FILENAME /fixture/index.php;
  fastcgi_pass 127.0.0.1:FASTCGI;
 }
 location /legacy/ { try_files $uri /index.php; }
}'''.replace('HOST', host).replace('PORT', str(port)).replace('FASTCGI', str(fastcgi))


def setup(host='orchard.example.test', alias='www.orchard.example.test', edge=19001, upstream=19002,
          legacy=18080, fastcgi=19003):
    source, binding = harness.fixture(host, alias, edge, upstream)
    binding['variable_prefix'] = 'merchant_reads' if host.startswith('merchant') else 'orchard_reads'
    accepted, _ = render(source, binding)
    accepted += '\n' + auxiliary(host, legacy, fastcgi) + '\n'
    binding['source_sha256'] = digest(accepted)
    contract = dict(format=1, frontend_ports=[edge], auxiliary=[dict(
        block_sha256=digest(auxiliary(host, legacy, fastcgi)), port=legacy, locations=2, fastcgi_passes=1)])
    return accepted, binding, contract


def context(accepted, extras=None, defaults=''):
    files = {'/fixture/main.conf': accepted,
             '/fixture/nginx.conf': 'events {} http { ' + defaults + ' include /fixture/main.conf; }', **(extras or {})}
    return dict(files=files, main='/fixture/main.conf', entry='/fixture/nginx.conf', prefix='/fixture',
                approved_files={digest(p): digest(t) for p, t in files.items()})


def rebind(accepted, binding, contract):
    """Exercise semantic gates even if an operator tries to rebind raw hashes."""
    binding = {**binding, 'source_sha256': digest(accepted)}
    contract = copy.deepcopy(contract)
    last = [n for n in parse(accepted) if n['name'] == 'server'][-1]
    contract['auxiliary'][0]['block_sha256'] = digest(accepted[last['start']:last['end']])
    return binding, contract


class RoleContractTests(unittest.TestCase):
    def test_two_stores_preserve_entire_auxiliary_and_non_api_bytes(self):
        from root_dashboard_read_check import non_api_projection
        for host, alias in [('orchard.example.test', 'www.orchard.example.test'), ('merchant.other.test', 'shop.other.test')]:
            accepted, binding, contract = setup(host, alias)
            candidate, result = render_reads(accepted, binding, auxiliary_contract=contract, configuration=context(accepted))
            self.assertEqual((result['approved_reads'], result['held_reads']), (70, 10))
            self.assertIn(auxiliary(host), candidate)
            self.assertEqual(non_api_projection(accepted, parse), non_api_projection(candidate, parse))
            with self.assertRaisesRegex(ValueError, 'UNCLASSIFIED_SAME_HOST_SERVER'):
                render_reads(accepted, binding)
            with self.assertRaisesRegex(ValueError, 'AUXILIARY_CONTEXT_REQUIRED'):
                render_reads(accepted, binding, auxiliary_contract=contract)

    def test_frontends_selected_by_structure_still_require_exact_guards(self):
        accepted, binding, contract = setup()
        guard = 'if ($' + binding['variable_prefix'] + '_method_denied = 1) { return 405; }'
        for text in (CUSTOMER_GUARD, guard):
            for ordinal in (0, 1):
                front = [n for n in parse(accepted) if n['name'] == 'server'][ordinal]
                before = accepted[front['start']:front['end']]
                for replacement in ('', text + '\n' + text, text.replace('return ', 'return  ')):
                    changed = accepted[:front['start']] + before.replace(text, replacement) + accepted[front['end']:]
                    with self.subTest(ordinal=ordinal, text=text, replacement=replacement), self.assertRaisesRegex(ValueError, 'ACCEPTED_GUARD_DRIFT'):
                        render_reads(changed, {**binding, 'source_sha256': digest(changed)}, auxiliary_contract=contract, configuration=context(changed))

    def test_missing_changed_conditional_or_preempted_return_rejected_even_with_new_hash(self):
        accepted, binding, contract = setup()
        for replacement in ('', 'return 200;', 'return 403;', 'return 404 "payload";',
                            'if ($request_method = GET) { return 404; }',
                            'rewrite ^ /index.php last; return 404;', 'break; return 404;',
                            'set $legacy_flag 1; return 404;'):
            changed = accepted.replace(' return 404;', ' ' + replacement)
            b, c = rebind(changed, binding, contract)
            with self.subTest(replacement=replacement), self.assertRaisesRegex(ValueError, 'AUXILIARY_TERMINAL_RETURN'):
                render_reads(changed, b, auxiliary_contract=c, configuration=context(changed))

    def test_auxiliary_hash_not_silently_rebased(self):
        accepted, binding, contract = setup()
        for before, after in [('return 404;', 'return 404; # same semantics, unreviewed bytes'),
                              ('127.0.0.1:19003', '127.0.0.1:19004'),
                              ('listen 18080;', 'listen 18081;'),
                              ('try_files $uri /index.php;', 'proxy_pass http://127.0.0.1:19004;')]:
            changed = accepted.replace(before, after)
            with self.subTest(after=after), self.assertRaisesRegex(ValueError, 'AUXILIARY_BLOCK_DRIFT'):
                render_reads(changed, {**binding, 'source_sha256': digest(changed)}, auxiliary_contract=contract, configuration=context(changed))

    def test_error_handlers_in_http_server_or_includes_rejected(self):
        accepted, binding, contract = setup()
        for directive in ('error_page 404 = /api/admin-orders;', 'error_page 404 = @legacy;', 'recursive_error_pages on;', 'recursive_error_pages off;'):
            for level in ('http', 'server', 'http-include', 'server-include'):
                changed = accepted.replace(' return 404;', ' return 404; ' + (directive if level == 'server' else 'include errors.conf;' if level == 'server-include' else ''))
                b, c = rebind(changed, binding, contract)
                defaults = directive if level == 'http' else 'include errors.conf;' if level == 'http-include' else ''
                ctx = context(changed, {'/fixture/errors.conf': directive} if level.endswith('include') else None, defaults)
                with self.subTest(directive=directive, level=level), self.assertRaisesRegex(ValueError, 'AUXILIARY_ERROR_HANDLING'):
                    render_reads(changed, b, auxiliary_contract=c, configuration=ctx)

    def test_changed_handlers_locations_and_listeners_rejected_with_rebound_hash(self):
        accepted, binding, contract = setup()
        mutations = [('fastcgi_pass 127.0.0.1:19003;', 'fastcgi_pass 10.0.0.1:9000;'),
                     ('fastcgi_pass 127.0.0.1:19003;', 'fastcgi_pass 127.0.0.1:19002;'),
                     ('fastcgi_pass 127.0.0.1:19003;', 'fastcgi_pass unix:/fixture/php.sock;'),
                     ('fastcgi_pass 127.0.0.1:19003;', 'proxy_pass http://127.0.0.1:19003;'),
                     ('fastcgi_pass 127.0.0.1:19003;', 'fastcgi_pass 127.0.0.1:19003; auth_request /api/check;'),
                     ('location /legacy/', 'location /'),
                     ('location /legacy/', 'location /new/ { proxy_pass http://127.0.0.1:19003; } location /legacy/'),
                     ('listen 18080;', 'listen 18081;'), ('listen 18080;', 'listen 127.0.0.1:18080;'),
                     ('listen [::]:18080;', ''), ('listen [::]:18080;', 'listen [::]:18080 ssl;')]
        for before, after in mutations:
            changed = accepted.replace(before, after)
            b, c = rebind(changed, binding, contract)
            with self.subTest(after=after), self.assertRaises(ValueError):
                render_reads(changed, b, auxiliary_contract=c, configuration=context(changed))
        for ordinal in (0, 1):
            node = [n for n in parse(accepted) if n['name'] == 'server'][ordinal]
            changed = accepted[:node['start']] + accepted[node['start']:node['end']].replace('127.0.0.1:19001', '127.0.0.1:19009') + accepted[node['end']:]
            with self.assertRaisesRegex(ValueError, 'FRONTEND_LISTENERS'):
                render_reads(changed, {**binding, 'source_sha256': digest(changed)}, auxiliary_contract=contract, configuration=context(changed))

    def test_ambiguous_same_host_blocks_in_main_or_peer_rejected(self):
        accepted, binding, contract = setup()
        for extra in (auxiliary('orchard.example.test'), 'server { listen 18081; server_name orchard.example.test; return 404; }',
                      'server { listen 19001; server_name www.orchard.example.test; return 404; }'):
            changed = accepted + '\n' + extra
            with self.subTest(extra=extra), self.assertRaises(ValueError):
                render_reads(changed, {**binding, 'source_sha256': digest(changed)}, auxiliary_contract=contract, configuration=context(changed))
        extra = '/fixture/peer.conf'
        ctx = context(accepted, {extra: 'server { listen 18081; server_name orchard.example.test; return 404; }'}, 'include peer.conf;')
        with self.assertRaisesRegex(ValueError, 'AUXILIARY_CONTEXT_BINDING'):
            render_reads(accepted, binding, auxiliary_contract=contract, configuration=ctx)

    def test_snapshot_include_resolution_and_coverage_fail_closed(self):
        accepted, binding, contract = setup()
        for directive, extras in [('include missing.conf;', {}), ('include $dynamic;', {}),
                                  ('include cycle.conf;', {'/fixture/cycle.conf': 'include cycle.conf;'})]:
            changed = accepted.replace(' return 404;', ' ' + directive + ' return 404;')
            b, c = rebind(changed, binding, contract)
            with self.subTest(directive=directive), self.assertRaises(ValueError):
                render_reads(changed, b, auxiliary_contract=c, configuration=context(changed, extras))
        ctx = context(accepted);ctx['files']['/fixture/unreviewed.conf'] = '# extra'
        with self.assertRaisesRegex(ValueError, 'AUXILIARY_CONTEXT_DRIFT'):
            render_reads(accepted, binding, auxiliary_contract=contract, configuration=ctx)

    def test_valid_included_locations_and_return_have_same_terminal_contract(self):
        accepted, binding, contract = setup()
        changed = accepted.replace(' return 404;', ' include legacy.conf;')
        b, c = rebind(changed, binding, contract)
        candidate, _ = render_reads(changed, b, auxiliary_contract=c, configuration=context(changed, {'/fixture/legacy.conf': 'return 404;'}))
        self.assertIn('include legacy.conf;', candidate)


class Canary(socketserver.TCPServer):
    allow_reuse_address = False
    def __init__(self):
        class Handler(socketserver.BaseRequestHandler):
            def handle(inner):
                inner.server.hits += 1
                # A handler invocation is observable even without a PHP runtime.
                inner.request.settimeout(1)
                inner.request.recv(8192)
        super().__init__(('127.0.0.1', 0), Handler)
        self.hits = 0
        self.thread = threading.Thread(target=self.serve_forever, daemon=True); self.thread.start()
    def close(self):
        self.shutdown(); self.server_close(); self.thread.join(timeout=5)


@unittest.skipUnless(os.environ.get('DASHBOARD_REVIEW_NGINX'), 'Set isolated Nginx executable')
class AuxiliaryReadsNginxTests(reads.ReadsNginxTests):
    @classmethod
    def setUpClass(cls):
        cls.canary = Canary()
        cls.legacy = harness.port()
        cls.legacy_requests = 0
        try:
            super().setUpClass()
        except BaseException:
            cls.canary.close()
            raise

    @classmethod
    def candidate_renderer(cls, source, binding):
        accepted, _ = render(source, binding)
        block = auxiliary(cls.site_host, cls.legacy, cls.canary.server_address[1])
        accepted += '\n' + block
        binding = {**binding, 'source_sha256': digest(accepted)}
        contract = dict(format=1, frontend_ports=[cls.edge], auxiliary=[dict(block_sha256=digest(block), port=cls.legacy, locations=2, fastcgi_passes=1)])
        return render_reads(accepted, binding, auxiliary_contract=contract, configuration=context(accepted))

    @classmethod
    def tearDownClass(cls):
        try:
            super().tearDownClass()
            assert cls.canary.hits == 0, 'Legacy FastCGI handler was reached'
            print(json.dumps(dict(store=cls.site_host, legacy_requests=cls.legacy_requests, fastcgi_hits=cls.canary.hits)))
        finally:
            cls.canary.close()

    def test_legacy_port_methods_and_encoded_paths_never_reach_fastcgi(self):
        for host in (self.site_host, self.site_alias, 'unknown.example.test'):
            for path in ('/', '/ordinary', '/index.php', '/api/admin-orders', '/api/admin-logs',
                         '/api/admin-orders.php', '/api/%61dmin-orders', '/%61pi/admin-orders',
                         '/api%2fadmin-orders', '/api//admin-orders', '/api/x/../admin-orders',
                         '/ar/dashboard/login', '/legacy/anything', '/index.php?x=1', '/bad%00.php'):
                for method in ('GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE', 'get'):
                    connection = http.client.HTTPConnection('127.0.0.1', self.legacy, timeout=5)
                    connection.request(method, path, headers={'Host': host})
                    response = connection.getresponse(); response.read(); connection.close()
                    type(self).legacy_requests += 1
                    self.assertIn(response.status, (400, 404, 405), (method, path, host))
                    if method not in ('get', 'TRACE') and path != '/bad%00.php':
                        self.assertEqual(response.status, 404, (method, path, host))
                    if method == 'TRACE' and path != '/bad%00.php':
                        self.assertEqual(response.status, 405, (method, path, host))
        self.assertEqual(self.canary.hits, 0)


class OtherStoreAuxiliaryReadsNginxTests(AuxiliaryReadsNginxTests):
    site_host = 'merchant.other.test'
    site_alias = 'shop.other.test'


@unittest.skipUnless(os.environ.get('DASHBOARD_REVIEW_NGINX'), 'Set isolated Nginx executable')
class ThreeBlockShadowTests(unittest.TestCase):
    def test_full_shadow_uses_pinned_context_and_preserves_peers_for_two_stores(self):
        import dashboard_read_check_test as helpers
        import root_dashboard_read_check as check
        from dashboard_access import validate_binding
        from private_config import loaded_names, shadow_tree
        for host, alias in [('orchard.example.test', 'www.orchard.example.test'), ('merchant.other.test', 'shop.other.test')]:
            helper = helpers.CompleteShadowTests(); self.addCleanup(helper.doCleanups)
            root, work, contents, deployment, command, calls, _ = helper.prepare(host, alias)
            block = auxiliary(host)
            contents[deployment['main_path']] += '\n' + block
            Path(deployment['main_path']).write_text(contents[deployment['main_path']])
            deployment['routing']['source_sha256'] = digest(contents[deployment['main_path']])
            deployment['protected_configurations'] = [dict(file_id=digest(p), sha256=digest(t)) for p, t in contents.items()]
            contract = dict(format=1, frontend_ports=[19001], auxiliary=[dict(block_sha256=digest(block), port=18080, locations=2, fastcgi_passes=1)])
            before = {p: Path(p).read_bytes() for p in contents}
            candidate, result = check.prepare_shadow(contents, deployment, work, command, parse, render_reads,
                validate_binding, shadow_tree, loaded_names, contract)
            self.assertEqual((result['approved_reads'], result['held_reads']), (70, 10))
            self.assertIn(block, candidate)
            self.assertEqual({p: Path(p).read_bytes() for p in contents}, before)
            self.assertEqual(len(calls), 2)
            contents[deployment['nginx_entry']] = contents[deployment['nginx_entry']].replace('http {', 'http { error_page 404 = @php;')
            with self.assertRaisesRegex(ValueError, 'AUXILIARY_CONTEXT_DRIFT'):
                check.prepare_shadow(contents, deployment, work, command, parse, render_reads,
                    validate_binding, shadow_tree, loaded_names, contract)


@unittest.skipUnless(os.environ.get('DASHBOARD_REVIEW_NGINX'), 'Set isolated Nginx executable')
class NativeErrorPageControlTests(unittest.TestCase):
    def test_server_error_page_can_reach_named_fastcgi_and_must_be_rejected(self):
        canary = Canary(); self.addCleanup(canary.close)
        with tempfile.TemporaryDirectory(prefix='legacy-error-control-') as temp:
            root = Path(temp); port = harness.port(); config = root/'nginx.conf'
            config.write_text('daemon off; error_log "'+str(root/'error.log')+'"; pid "'+str(root/'pid')+'"; events {} http { access_log off; fastcgi_temp_path "'+str(root/'fastcgi')+'"; server { listen 127.0.0.1:'+str(port)+'; return 404; error_page 404 = @php; location @php { fastcgi_param SCRIPT_FILENAME /fixture/index.php; fastcgi_pass 127.0.0.1:'+str(canary.server_address[1])+'; } } }')
            args = [os.environ['DASHBOARD_REVIEW_NGINX'], '-p', temp+'/', '-c', str(config)]
            checked = subprocess.run(args+['-t'], capture_output=True); self.assertEqual(checked.returncode, 0, checked.stderr)
            process = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                for _ in range(100):
                    try:
                        with socket.create_connection(('127.0.0.1', port), timeout=.1): break
                    except OSError: time.sleep(.02)
                connection = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
                connection.request('GET', '/api/admin-orders.php'); response = connection.getresponse(); response.read(); connection.close()
                self.assertEqual(response.status, 502)
                self.assertEqual(canary.hits, 1)
            finally:
                process.terminate(); process.wait(timeout=5)


if __name__ == '__main__': unittest.main(verbosity=2)
