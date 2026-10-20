"""Focused archive safety and real Caddy portability checks.

CADDY_BIN=/absolute/caddy python3 tests/clean-reinstall.test.py
No production services, credentials or network targets are used.
"""
import hashlib
import http.client
import importlib.util
import io
import json
import os
import stat
import pathlib
import socket
import subprocess
import tarfile
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load(name):
    s = importlib.util.spec_from_file_location(name, ROOT / 'scripts/clean-reinstall' / (name + '.py'))
    m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m


restore, deploy, render = load('restore-media'), load('deploy'), load('render')
installer = load('install')
operator = load('owner-restore')


def archive(name, data=b'image', kind=None, link=None):
    b = io.BytesIO()
    with tarfile.open(fileobj=b, mode='w:gz') as t:
        m = tarfile.TarInfo(name); m.mode = 0o644
        if kind: m.type = kind; m.linkname = link or ''
        else: m.size = len(data)
        t.addfile(m, io.BytesIO(data) if not kind else None)
    b.seek(0); return b


class RestoreSafety(unittest.TestCase):
    def test_host_key_requires_console_match_and_preserves_old_identity(self):
        with tempfile.TemporaryDirectory() as d:
            key = pathlib.Path(d) / 'fixture-key'
            subprocess.run(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', str(key)], check=True, capture_output=True)
            public = key.with_suffix('.pub').read_text().split()[:2]
            fingerprint = subprocess.check_output(['ssh-keygen', '-lf', str(key.with_suffix('.pub'))], text=True).split()[1]
            line = '192.0.2.7 ' + ' '.join(public)
            self.assertEqual(operator.pinned_line(line, '192.0.2.7', fingerprint, 'SHA256:' + 'x' * 43), line + '\n')
            with self.assertRaises(AssertionError): operator.pinned_line(line, '192.0.2.7', 'SHA256:' + 'y' * 43, 'SHA256:' + 'x' * 43)
            with self.assertRaises(AssertionError): operator.pinned_line(line, '192.0.2.7', fingerprint, fingerprint)
            with self.assertRaises(AssertionError): operator.pinned_line(line, '192.0.2.8', fingerprint, 'SHA256:' + 'x' * 43)

    def test_service_readability_with_private_root_umask(self):
        with tempfile.TemporaryDirectory() as d:
            base = pathlib.Path(d)
            previous = os.umask(0o077)
            try:
                installer.directory(base / 'public-config', 0o755)
                installer.directory(base / 'shared', 0o750)
                self.assertEqual(stat.S_IMODE((base / 'public-config').stat().st_mode), 0o755)
                self.assertEqual(stat.S_IMODE((base / 'shared').stat().st_mode), 0o750)
                with tarfile.open(base / 'release.tar.gz', 'w:gz') as t:
                    for name in ['.output', '.output/server']:
                        member = tarfile.TarInfo(name); member.type = tarfile.DIRTYPE; member.mode = 0o755; t.addfile(member)
                    member = tarfile.TarInfo('.output/server/index.mjs'); member.mode = 0o644; member.size = 2; t.addfile(member, io.BytesIO(b'{}'))
                inventory = [{'path': '', 'type': 'directory', 'mode': 0o755}, {'path': 'server', 'type': 'directory', 'mode': 0o755},
                             {'path': 'server/index.mjs', 'type': 'file', 'mode': 0o644, 'size': 2, 'sha256': hashlib.sha256(b'{}').hexdigest()}]
                deploy.extract_release(base / 'release.tar.gz', base / 'release', inventory)
                for p in [base / 'release', base / 'release/server']: self.assertEqual(stat.S_IMODE(p.stat().st_mode), 0o755)
                self.assertEqual(stat.S_IMODE((base / 'release/server/index.mjs').stat().st_mode), 0o644)
            finally: os.umask(previous)

    def test_media_bytes_and_existing_destination_preserved(self):
        with tempfile.TemporaryDirectory() as d:
            dest = pathlib.Path(d) / 'uploads'
            expected = {'products/a.png': {'bytes': 5, 'sha256': hashlib.sha256(b'image').hexdigest()}}
            self.assertEqual(restore.restore(archive('products/a.png'), dest, expected), 1)
            self.assertEqual((dest / 'products/a.png').read_bytes(), b'image')
            with self.assertRaises(FileExistsError): restore.restore(archive('products/a.png', b'other'), dest, expected)
            self.assertEqual((dest / 'products/a.png').read_bytes(), b'image')

    def test_traversal_links_private_members_and_hash_corruption_stop(self):
        for name, kind in [('../outside.png', None), ('/outside.png', None), ('private/a.png', None), ('products/a.png', tarfile.SYMTYPE), ('products/a.png', tarfile.LNKTYPE)]:
            with self.subTest(name=name, kind=kind), tempfile.TemporaryDirectory() as d:
                expected = {name: {'bytes': 5, 'sha256': hashlib.sha256(b'image').hexdigest()}}
                with self.assertRaises(AssertionError): restore.restore(archive(name, kind=kind, link='/etc/passwd'), pathlib.Path(d) / 'uploads', expected)
                self.assertFalse((pathlib.Path(d) / 'outside.png').exists())
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(AssertionError): restore.restore(archive('products/a.png'), pathlib.Path(d) / 'uploads', {'products/a.png': {'bytes': 5, 'sha256': '0' * 64}})

    def test_release_rejects_traversal_or_unexpected_members_before_file_writes(self):
        for name in ['.output/../outside', '/etc/passwd', '.output/.env']:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as d:
                base = pathlib.Path(d); (base / 'artifact.tar.gz').write_bytes(archive(name).getvalue())
                with self.assertRaises(AssertionError): deploy.extract_release(base / 'artifact.tar.gz', base / 'release', [])
                self.assertEqual(list((base / 'release').iterdir()), [])


@unittest.skipUnless(os.environ.get('CADDY_BIN'), 'Set CADDY_BIN for real loopback Caddy checks')
class CaddyPortability(unittest.TestCase):
    def test_two_business_bindings_and_administrator_methods(self):
        class Backend(BaseHTTPRequestHandler):
            def action(self):
                data = json.dumps({'method': self.command, 'authorization': self.headers.get('Authorization')}).encode()
                self.send_response(200); self.end_headers(); self.wfile.write(data)
            do_GET = do_POST = do_PATCH = do_DELETE = do_OPTIONS = action
            def log_message(self, *args): pass
        backend = HTTPServer(('127.0.0.1', 0), Backend)
        thread = threading.Thread(target=backend.serve_forever, daemon=True); thread.start()
        try:
            for business in ['orchid.example.invalid', 'cedar.example.invalid']:
                with self.subTest(business=business), tempfile.TemporaryDirectory() as folder:
                    base = pathlib.Path(folder)
                    cfg = {'format': 1, 'domain': business, 'alias': 'www.' + business, 'root': '/srv/storefront', 'service': 'storefront', 'user': 'storefront', 'port': backend.server_port, 'node_version': '22.23.1', 'caddy_version': '2.11.7'}
                    mapping = {'paths': {'/قديم': '/products/current', '/old/': '/products/current'}, 'query_ids': {'7': '/products/current'}, 'held_paths': ['/held/'], 'held_ids': ['8']}
                    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
                    (base / 'Caddyfile').write_text(render.render(cfg, mapping, port))
                    log = (base / 'log').open('wb')
                    child = subprocess.Popen([os.environ['CADDY_BIN'], 'run', '--config', str(base / 'Caddyfile'), '--adapter', 'caddyfile'], stdout=log, stderr=log, env={'PATH': '/usr/bin:/bin', 'HOME': str(base), 'XDG_DATA_HOME': str(base), 'XDG_CONFIG_HOME': str(base)})
                    def call(path, method='GET', host=business):
                        c = http.client.HTTPConnection('127.0.0.1', port, timeout=2)
                        c.request(method, path, headers={'Host': host, 'Authorization': 'Bearer fixture-only'})
                        r = c.getresponse(); result = r.status, r.getheader('location'), r.read(); c.close(); return result
                    try:
                        for _ in range(100):
                            try: call('/'); break
                            except OSError: time.sleep(.03)
                        for method in ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']:
                            r = call('/api/admin-products', method)
                            self.assertEqual(r[0], 200); self.assertEqual(json.loads(r[2]), {'method': method, 'authorization': 'Bearer fixture-only'})
                        for path in ['/old/', '/%D9%82%D8%AF%D9%8A%D9%85', '/?post_type=product&p=7', '/index.php?post_type=product&p=7']:
                            self.assertEqual(call(path)[:2], (301, 'https://' + business + '/products/current'))
                        self.assertEqual(call('/held/')[0], 503)
                        self.assertEqual(call('/?post_type=product&p=8')[0], 503)
                        self.assertEqual(call('/?post_type=product&p=8x')[0], 200)
                        self.assertEqual(call('/api/internal/email/process', 'POST')[0], 403)
                        self.assertEqual(call('/private/secret.txt')[0], 404)
                        self.assertEqual(call('/normal?x=1', host='www.' + business)[:2], (301, 'https://' + business + '/normal?x=1'))
                    finally: child.terminate(); child.wait(timeout=10); log.close()
        finally: backend.shutdown(); backend.server_close(); thread.join()


if __name__ == '__main__': unittest.main()
