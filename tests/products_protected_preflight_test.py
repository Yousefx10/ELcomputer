"""Validate the NEW owner-only fingerprint without executing privileged entry."""
import ast
from pathlib import Path
import re
import sys
import unittest
import urllib.parse
import copy
import hashlib
import os
import stat
import tempfile
import shlex
import shutil
import subprocess
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent))
import product_writes_test as fixture
import config_parser as parser
from dashboard_access import digest, read_path_pattern, read_policy
from product_writes import render_product_writes

INSPECTOR = Path(__file__).resolve().parents[1] / 'docs/operations/products-protected-inspection.py'
COMMAND = INSPECTOR.with_suffix('.command')


def function_namespace(*names):
    tree = ast.parse(INSPECTOR.read_text())
    namespace = {'re': re, 'urllib': urllib, 'Path': Path, 'stat': stat,
                 'H': lambda raw: hashlib.sha256(raw).hexdigest()}
    constants = [n for n in tree.body if isinstance(n, ast.Assign)
                 and any(isinstance(t, ast.Name) and t.id in ('ROOT', 'MANIFEST', 'SOURCE', 'APPLY') for t in n.targets)]
    functions = [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name in names]
    exec(compile(ast.Module(body=constants + functions, type_ignores=[]), '<pure validation only>', 'exec'), namespace)
    return namespace


class ProtectedPreflightTests(unittest.TestCase):
    def test_short_intake_on_owned_files_rejects_drift_and_repeat(self):
        # Execute a clone with owned paths/current UID, never the root inspector.
        # macOS lacks GNU stat/timeout; only those interfaces are modeled.
        argv = shlex.split(COMMAND.read_text())
        self.assertEqual(argv[:6], ['env', '-i', 'PATH=/usr/sbin:/usr/bin:/sbin:/bin', '/bin/bash', '--noprofile', '--norc'])
        self.assertEqual(argv[6], '-c')
        inner = argv[7]
        actual_sha = hashlib.sha256(INSPECTOR.read_bytes()).hexdigest()
        self.assertIn('h=' + actual_sha + ';', inner)
        self.assertIn('products-inspect-' + actual_sha[:16], inner)
        fixture = b"print('OWNED_INSPECTION_FIXTURE_ONLY')\n"
        digest = hashlib.sha256(fixture).hexdigest()
        shasum = shutil.which('shasum')
        self.assertIsNotNone(shasum)
        stat_code = "import os,stat,sys;s=os.lstat(sys.argv[1]);print('%s:%s:%o:%s:%s'%(s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_nlink,s.st_size))"
        prefix = ('stat() { ' + shlex.quote(sys.executable) + ' -c ' + shlex.quote(stat_code) + ' "$3"; }; '
                  'timeout() { shift; "$@"; }; '
                  'sha256sum() { ' + shlex.quote(shasum) + ' -a 256 "$@"; }; ')
        for kind in ('valid_then_repeat', 'bad_bytes', 'wrong_mode', 'symlink', 'oversize', 'copy_drift'):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory(prefix='products-intake-owned-') as directory:
                base = Path(directory).resolve(); source = base/'source.py'; dest = base/'private'
                source.write_bytes(fixture); source.chmod(0o600)
                text = re.sub(r's=/home/[^;]+;', 's=' + str(source) + ';', inner)
                text = re.sub(r'p=/root/[^;]+;', 'p=' + str(dest) + ';', text)
                text = text.replace('h=' + actual_sha, 'h=' + digest)
                text = text.replace('= 0:0;', '= ' + str(os.getuid()) + ':' + str(os.getgid()) + ';')
                text = text.replace('1002:1004:600:1:' + str(INSPECTOR.stat().st_size),
                                    str(os.getuid()) + ':' + str(os.getgid()) + ':600:1:' + str(len(fixture)))
                text = text.replace('head -c ' + str(INSPECTOR.stat().st_size + 1), 'head -c ' + str(len(fixture) + 1))
                setup = prefix
                if kind == 'bad_bytes': source.write_bytes(b'x' * len(fixture))
                elif kind == 'wrong_mode': source.chmod(0o640)
                elif kind == 'symlink':
                    target = base/'target'; source.rename(target); source.symlink_to(target)
                elif kind == 'oversize': source.write_bytes(fixture + b'x')
                elif kind == 'copy_drift':
                    # Replacement occurs after the first validated read, before copy.
                    setup += ('timeout() { shift; if test -d ' + shlex.quote(str(dest)) + '; then '
                              + shlex.quote(sys.executable) + ' -c ' + shlex.quote("import pathlib;pathlib.Path(" + repr(str(source)) + ").write_bytes(b'changed during copy')")
                              + '; fi; "$@"; }; ')
                result = subprocess.run(['/bin/bash', '--noprofile', '--norc', '-c', setup + text], capture_output=True,
                                        timeout=10, env={'PATH': '/usr/bin:/bin', 'LANG': 'C'})
                if kind == 'valid_then_repeat':
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual(result.stdout.strip(), b'OWNED_INSPECTION_FIXTURE_ONLY')
                    self.assertEqual((dest/'inspect.py').read_bytes(), fixture)
                    self.assertEqual((dest/'inspect.py').stat().st_mode & 0o777, 0o600)
                    again = subprocess.run(['/bin/bash', '--noprofile', '--norc', '-c', setup + text], capture_output=True,
                                           timeout=10, env={'PATH': '/usr/bin:/bin', 'LANG': 'C'})
                    self.assertNotEqual(again.returncode, 0)
                    self.assertNotIn(b'OWNED_INSPECTION_FIXTURE_ONLY', again.stdout)
                else:
                    self.assertNotEqual(result.returncode, 0)
                    self.assertNotIn(b'OWNED_INSPECTION_FIXTURE_ONLY', result.stdout)
                    if kind != 'copy_drift': self.assertFalse(dest.exists())

    def test_owner_transport_allows_frozen_read_contract_and_refuses_mutations(self):
        code = INSPECTOR.read_text()
        function = next(n for n in ast.walk(ast.parse(code)) if isinstance(n, ast.FunctionDef) and n.name == 'command')
        d = {'nginx': '/fixture/nginx', 'systemctl': '/fixture/systemctl', 'ss': '/fixture/ss', 'runtime': {'node': '/fixture/node'}}
        calls = []
        def simulated(argv, **kwargs):
            calls.append(argv)
            self.assertTrue(kwargs['capture_output'])
            self.assertEqual(kwargs['env'], {'PATH': '/usr/bin:/bin', 'LANG': 'C'})
            return SimpleNamespace(returncode=0)
        namespace = {'saved': {'deployment': d}, 'subprocess': SimpleNamespace(run=simulated)}
        exec(compile(ast.Module(body=[function], type_ignores=[]), '<simulated transport only>', 'exec'), namespace)
        allowed = [['/fixture/nginx', '-T'], ['/fixture/nginx', '-V'], ['/fixture/systemctl', 'show', 'nginx.service'],
                   ['/fixture/ss', '-lntp'], ['/fixture/node', '--version']]
        for argv in allowed: namespace['command'](argv, 'owned-simulation')
        for argv in [['/fixture/nginx', '-s', 'reload'], ['/fixture/systemctl', 'restart', 'nginx.service'],
                     ['/fixture/systemctl', 'reload', 'nginx.service'], ['/fixture/node', 'operator.mjs'], ['/bin/sh', '-c', 'anything']]:
            with self.assertRaises(AssertionError): namespace['command'](argv, 'denied-simulation')
        self.assertEqual(calls, allowed)

    def test_independent_owner_fingerprint_matches_reviewed_renderer(self):
        code = INSPECTOR.read_text()
        tree = ast.parse(code)
        compile(tree, str(INSPECTOR), 'exec')  # Syntax only: NEVER execute root entry.
        function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'patch')
        namespace = {'re': re, 'urllib': urllib}
        exec(compile(ast.Module(body=[function], type_ignores=[]), '<pure independent patch>', 'exec'), namespace)
        for host, alias in [('orchard.example.test', 'www.orchard.example.test'), ('merchant.other.test', 'shop.other.test')]:
            for retry in ('', 'proxy_next_upstream off;', 'proxy_next_upstream error timeout;'):
                source, binding = fixture.harness.fixture(host, alias)
                if retry:
                    source = source.replace('proxy_store off;', 'proxy_store off; ' + retry)
                    binding['source_sha256'] = digest(source)
                accepted = fixture.accepted(source, binding)
                expected, _ = render_product_writes(accepted, {**binding, 'source_sha256': digest(accepted)})
                with self.subTest(host=host, retry=retry):
                    observed = namespace['patch'](accepted, binding, parser, read_path_pattern, read_policy())
                    self.assertEqual(observed, expected)
                    self.assertEqual(digest(observed), digest(expected))

    def test_actual_successful_apply_pins_and_receipt_scope(self):
        n = function_namespace('validate_apply_binding')
        self.assertEqual(str(n['ROOT']), '/root/adm01-activation-apply-3be097f8217bd200')
        self.assertEqual(n['MANIFEST'], '34e62ec63b974d1143405ae7b3ce70cedf6e5645509c33bcde0648bfcd28269a')
        self.assertEqual(n['APPLY'], '6a93dc6ad6929e2eb1e677613c1cb6a29b36df81acc00652eb942cdacd033372')
        binding = {'workspaces': {'apply': str(n['ROOT'])}}
        receipt = dict(result='INFRASTRUCTURE_PASS', mode='apply', manifest_sha256=n['MANIFEST'], candidate_sha256=n['SOURCE'],
                       replacement_acknowledged=True, reload_acknowledged=True, worker_acceptance_confirmed=True,
                       installed={'sha256': n['SOURCE'], 'bytes': 472049})
        n['validate_apply_binding'](binding, receipt)
        bad = copy.deepcopy(binding); bad['workspaces']['apply'] = '/root/adm01-activation-apply-fad66381d2851176'
        with self.assertRaises(AssertionError): n['validate_apply_binding'](bad, receipt)
        for key, value in [('mode', 'verify'), ('manifest_sha256', '0'*64), ('candidate_sha256', '0'*64),
                           ('replacement_acknowledged', False), ('reload_acknowledged', False), ('worker_acceptance_confirmed', False)]:
            bad = {**receipt, key: value}
            with self.subTest(key=key), self.assertRaises(AssertionError): n['validate_apply_binding'](binding, bad)

    def test_only_exclusive_private_copy_is_accepted(self):
        n = function_namespace('inspection_copy')
        with tempfile.TemporaryDirectory(prefix='products-owner-copy-owned-') as directory:
            base = Path(directory).resolve(); parent = base/'products-inspect-0123456789abcdef'; parent.mkdir(mode=0o700)
            script = parent/'inspect.py'; script.write_bytes(b'fixture, never executed\n'); script.chmod(0o600)
            validate = lambda path: n['inspection_copy'](path, uid=os.getuid(), gid=os.getgid(), parent_base=base)
            self.assertEqual(validate(script), hashlib.sha256(script.read_bytes()).hexdigest())
            script.chmod(0o640)
            with self.assertRaises(AssertionError): validate(script)
            script.chmod(0o600); parent.chmod(0o750)
            with self.assertRaises(AssertionError): validate(script)
            parent.chmod(0o700)
            with self.assertRaises(AssertionError):
                n['inspection_copy'](script, uid=os.getuid()+1, gid=os.getgid(), parent_base=base)
            moved = parent/'moved.py'; script.rename(moved); script.symlink_to(moved)
            with self.assertRaises(AssertionError): validate(script)
            script.unlink(); moved.rename(script)
            os.link(script, parent/'extra')
            with self.assertRaises(AssertionError): validate(script)


if __name__ == '__main__': unittest.main(verbosity=2)
