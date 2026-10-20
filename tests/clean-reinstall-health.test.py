"""Bounded health/SSH regressions. Uses synthetic loopback fixtures only."""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
import pathlib
import signal
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts/clean-reinstall' / (name + '.py'))
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module); return module


health, operator = load('health'), load('owner-restore')
CONFIG = {'domain': 'orchid.example.invalid', 'alias': 'www.orchid.example.invalid'}
MAPPING = {'paths': {'/old': '/products/current'}, 'query_ids': {'7': '/products/current'}, 'held_paths': ['/held'], 'held_ids': ['8']}
IMAGE = b'synthetic-image-bytes'
MEDIA = {'products/fixture.png': {'bytes': len(IMAGE), 'sha256': hashlib.sha256(IMAGE).hexdigest()}}


class Fixture(BaseHTTPRequestHandler):
    calls = []
    def log_message(self, *unused): pass
    def respond(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', '0')))
        self.calls.append((self.command, self.path, self.headers.get('Authorization'), body))
        status, payload, headers = 200, b'<html lang="ar">fixture</html>', {}
        if self.path == '/trickle':
            self.send_response(200); self.send_header('Content-Length', '20'); self.end_headers()
            try:
                for unused in range(20): self.wfile.write(b'x'); self.wfile.flush(); time.sleep(.04)
            except OSError: pass
            return
        if self.path in ['/old', '/?post_type=product&p=7', '/index.php?post_type=product&p=7']:
            status, payload, headers = 301, b'', {'Location': 'https://' + CONFIG['domain'] + '/products/current'}
        elif self.path in ['/held', '/?post_type=product&p=8']: status = 503
        elif self.path in ['/uploads/private/documents/test.png', '/.env', '/backups/archive.sql', '/uploads/settings/.pending/x.png']: status = 404
        elif self.path == '/uploads/products/fixture.png':
            payload, headers = IMAGE, {'Content-Type': 'image/png', 'X-Content-Type-Options': 'nosniff'}
        elif self.path.startswith('/api/admin-products') or self.path == '/api/admin-uploads': status = 401
        elif self.path not in ['/', '/ar', '/dashboard/login', '/ar/dashboard/login']: status = 403
        self.send_response(status)
        for key, value in headers.items(): self.send_header(key, value)
        self.send_header('Content-Length', str(len(payload))); self.end_headers(); self.wfile.write(payload)
    do_GET = do_POST = do_PATCH = respond


class HttpHealth(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Fixture)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True); cls.thread.start()
        cls.origin = 'http://127.0.0.1:' + str(cls.server.server_port)
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.thread.join()

    def test_all_check_groups_counts_and_missing_token_payloads_remain(self):
        Fixture.calls = []; events = []
        result = health.check(self.origin, CONFIG, MAPPING, MEDIA, True, progress=events.append)
        self.assertEqual(result['http_checks'], 49)
        self.assertEqual(result['redirect_cases'], 6)
        self.assertEqual(result['media_files'], 1)
        self.assertEqual(len(Fixture.calls), 49)
        self.assertEqual({e['stage'] for e in events}, {'pages', 'missing_token', 'disabled_commerce', 'private_paths', 'media_hashes', 'redirects', 'held_urls'})
        mutations = [(method, body) for method, path, auth, body in Fixture.calls if method in ['POST', 'PATCH']]
        self.assertEqual(len(mutations), 17)
        self.assertTrue(all(body == b'{}' for method, body in mutations))
        self.assertTrue(all(auth is None for method, path, auth, body in Fixture.calls))

    def test_trickling_body_has_absolute_deadline(self):
        started = time.monotonic()
        with self.assertRaises(TimeoutError): health.request(self.origin, '/trickle', timeout=.12)
        self.assertLess(time.monotonic() - started, .6)
        self.assertEqual(signal.getitimer(signal.ITIMER_REAL), (0.0, 0.0))

    def test_connection_closed_on_request_failure(self):
        with patch.object(health.http.client, 'HTTPConnection') as connection:
            connection.return_value.request.side_effect = OSError('fixture failure')
            with self.assertRaises(OSError): health.request(self.origin, '/')
            connection.return_value.close.assert_called_once()

    def test_dns_is_inside_absolute_request_deadline(self):
        started = time.monotonic()
        with patch('socket.getaddrinfo', side_effect=lambda *args, **kwargs: time.sleep(1)):
            with self.assertRaises(TimeoutError): health.request(self.origin, '/', timeout=.05)
        self.assertLess(time.monotonic() - started, .6)

    def test_failed_security_status_or_image_hash_cannot_pass(self):
        actual_request = health.request
        for path in ['/api/admin-products', '/checkout', '/.env']:
            with self.subTest(path=path):
                def wrong_status(base, target, *args, **kwargs):
                    result = actual_request(base, target, *args, **kwargs)
                    return (200, result[1], result[2]) if target == path else result
                with patch.object(health, 'request', side_effect=wrong_status):
                    with self.assertRaises(AssertionError): health.check(self.origin, CONFIG, MAPPING, MEDIA, True)
        bad = {'products/fixture.png': dict(MEDIA['products/fixture.png'], sha256='0' * 64)}
        with self.assertRaises(AssertionError): health.check(self.origin, CONFIG, MAPPING, bad, True)

    def test_streamed_cli_emits_progress_and_failure_with_nonzero_exit(self):
        with tempfile.TemporaryDirectory() as d:
            kit = pathlib.Path(d)
            for name, value in [('config.json', CONFIG), ('legacy-urls.json', MAPPING), ('media-manifest.json', MEDIA)]:
                (kit / name).write_text(json.dumps(value))
            # A short run budget fails during real HTTP requests, without retries.
            result = subprocess.run([sys.executable, '-u', '-', d, '--origin', self.origin, '--fixture', '--timeout', '.0001'],
                                    input=(ROOT / 'scripts/clean-reinstall/health.py').read_bytes(), capture_output=True, timeout=5)
            values = [json.loads(line) for line in result.stdout.splitlines()]
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(values[0]['event'], 'progress')
            self.assertEqual(values[-1]['result'], 'FAIL')
            self.assertEqual(values[-1]['error'], 'TimeoutError')


class ChildLifetime(unittest.TestCase):
    def test_descendant_holding_output_does_not_wait_for_eof(self):
        code = "import os,time; child=os.fork();\nif child==0: time.sleep(30); os._exit(0)\nprint('finished',flush=True)"
        started = time.monotonic()
        result = operator.bounded_process([sys.executable, '-c', code], 2)
        self.assertEqual((result.returncode, result.stdout), (0, b'finished\n'))
        self.assertLess(time.monotonic() - started, 2)

    def test_stalled_child_progress_and_cleanup_are_bounded(self):
        code = "import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); print('progress',flush=True); time.sleep(30)"
        events = []; started = time.monotonic()
        with self.assertRaises(TimeoutError): operator.bounded_process([sys.executable, '-c', code], .2, on_line=events.append)
        self.assertEqual(events, ['progress'])
        self.assertLess(time.monotonic() - started, 4)

    def test_stdin_source_and_stderr_do_not_block_output(self):
        code = "import sys; value=sys.stdin.buffer.read(); sys.stderr.write('x'*200000); print(len(value),flush=True)"
        result = operator.bounded_process([sys.executable, '-c', code], 2, source=b'synthetic source')
        self.assertEqual(result.stdout, b'16\n')
        self.assertEqual(result.returncode, 0)


class ResultReceipts(unittest.TestCase):
    def test_existing_target_identity_guards_are_preserved(self):
        cfg = {'previous_machine_id': 'old'}
        valid = {'uid': 0, 'arch': 'x86_64', 'machine_id': 'new', 'os': 'ID=ubuntu\nVERSION_ID="24.04"\n'}
        operator.validate_target(valid, cfg)
        for field, value in [('uid', 1000), ('arch', 'aarch64'), ('machine_id', 'old'), ('os', 'ID=debian\nVERSION_ID="12"\n')]:
            with self.subTest(field=field), self.assertRaises(AssertionError): operator.validate_target(dict(valid, **{field: value}), cfg)

    def execute(self, outcome):
        with tempfile.TemporaryDirectory() as d:
            kit = pathlib.Path(d)
            (kit / 'legacy-urls.json').write_text(json.dumps(MAPPING))
            (kit / 'media-manifest.json').write_text(json.dumps(MEDIA))
            cfg = dict(CONFIG, remote_kit='/root/reinstall-kit', previous_machine_id='old', kit_manifest_sha256='a' * 64)
            calls = []
            def fake(command, timeout, source=None, on_line=None):
                calls.append((command, timeout, source))
                if len(calls) == 1:
                    data = {'uid': 0, 'arch': 'x86_64', 'machine_id': 'new', 'os': 'ID=ubuntu\nVERSION_ID="24.04"\n'}
                    return subprocess.CompletedProcess(command, 0, json.dumps(data).encode(), b'')
                if len(calls) == 2: return subprocess.CompletedProcess(command, 0, b'', b'')
                self.assertIn('StrictHostKeyChecking=yes', command)
                self.assertIn('ServerAliveInterval=10', command)
                self.assertIn('ControlPath=none', command)
                self.assertIn('python3 -u - ', command[-1])
                self.assertEqual(source, (ROOT / 'scripts/clean-reinstall/health.py').read_bytes())
                on_line(json.dumps({'event': 'progress', 'stage': 'pages', 'http_checks': 0}))
                if outcome == 'interrupt': raise KeyboardInterrupt()
                if outcome != 'missing': on_line(json.dumps({'result': 'PASS', 'http_checks': 49 if outcome != 'partial' else 1, 'redirect_cases': 6, 'media_files': 1}))
                if outcome == 'transport_timeout': raise TimeoutError('fixture SSH deadline')
                return subprocess.CompletedProcess(command, 1 if outcome == 'nonzero' else 0, b'', b'')
            output = io.StringIO()
            # Include pinning in the supplied SSH binding, as main() does.
            ssh = ['ssh', '-o', 'StrictHostKeyChecking=yes']
            with patch.object(operator, 'bounded_process', side_effect=fake), contextlib.redirect_stdout(output):
                status = operator.run_health(cfg, kit, ssh, kit / 'OWNER-BINDING.json')
            receipt = next((kit / 'health-results').glob('*.json'))
            data = json.loads(receipt.read_text())
            self.assertEqual(receipt.stat().st_mode & 0o777, 0o600)
            values = [json.loads(line) for line in output.getvalue().splitlines()]
            return status, data, values

    def test_success_requires_final_result_counts_and_zero_ssh_exit(self):
        status, data, values = self.execute('success')
        self.assertEqual(status, 0); self.assertEqual(data['result'], 'PASS')
        self.assertEqual(values[-1]['result'], 'PASS')

    def test_no_false_pass_for_missing_partial_nonzero_timeout_or_interrupt(self):
        for outcome in ['missing', 'partial', 'nonzero', 'transport_timeout', 'interrupt']:
            with self.subTest(outcome=outcome):
                status, data, values = self.execute(outcome)
                self.assertEqual(status, 1); self.assertEqual(data['result'], 'FAIL')
                self.assertEqual(values[-1]['result'], 'FAIL')
                self.assertNotIn('PASS', [v.get('result') for v in values])


if __name__ == '__main__': unittest.main()
