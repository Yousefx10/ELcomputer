"""Validate the NEW owner-only fingerprint without executing privileged entry."""
import ast
from pathlib import Path
import re
import sys
import unittest
import urllib.parse
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent))
import product_writes_test as fixture
import config_parser as parser
from dashboard_access import digest, read_path_pattern, read_policy
from product_writes import render_product_writes

COMMAND = Path(__file__).resolve().parents[1] / 'docs/operations/products-protected-inspection.command'


class ProtectedPreflightTests(unittest.TestCase):
    def test_owner_transport_allows_frozen_read_contract_and_refuses_mutations(self):
        code = COMMAND.read_text().split("<<'PY'\n", 1)[1].rsplit('\nPY', 1)[0]
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
        code = COMMAND.read_text().split("<<'PY'\n", 1)[1].rsplit('\nPY', 1)[0]
        tree = ast.parse(code)
        compile(tree, str(COMMAND), 'exec')  # Syntax only: NEVER execute root entry.
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


if __name__ == '__main__': unittest.main(verbosity=2)
