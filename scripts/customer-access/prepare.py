#!/usr/bin/env python3
"""Prepare a narrow Caddy candidate locally; never connects, installs or reloads.

Keep restoration artifacts immutable. Insert the reviewed access policy into a
copy of the current configuration, preserving every original line and backend.
"""
import argparse
import hashlib
import json
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent


def sha(data):
    return hashlib.sha256(data).hexdigest()


def patch(source, policy=None):
    policy = policy or json.loads((HERE / 'policy.json').read_text())
    assert policy['format'] == 1 and policy['routes']
    anchor = '        @dormant path_regexp dormant '
    assert source.count(anchor) == 1, 'Expected current browse-only rule exactly once'
    assert '@customer_access' not in source, 'Policy already present; never apply twice'
    proxies = re.findall(r'^        reverse_proxy 127\.0\.0\.1:\d+ \{\n.*?^        \}', source, re.M | re.S)
    assert len(proxies) == 1, 'Review the existing loopback proxy'
    expressions = []
    for route in policy['routes']:
        assert route['methods'] and set(route['methods']) <= {'GET', 'HEAD', 'POST', 'PATCH', 'DELETE'}
        pattern = route['path']
        assert pattern.startswith('^/') and pattern.endswith('$') and '`' not in pattern
        re.compile(pattern)
        methods = ' || '.join('method(' + json.dumps(method) + ')' for method in route['methods'])
        expressions.append('((' + methods + ') && path_regexp(' + json.dumps(pattern) + '))')
    proxy = proxies[0].replace('reverse_proxy ', 'reverse_proxy @customer_access ', 1)
    block = '\n'.join([
        '        # Authenticated account services; application Auth/RBAC/ownership still apply.',
        '        @customer_access expression `' + ' || '.join(expressions) + '`',
        '        header @customer_access >Cache-Control "private, no-store"',
        proxy,
        ''
    ])
    return source.replace(anchor, block + anchor, 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('baseline', type=pathlib.Path)
    parser.add_argument('output', type=pathlib.Path)
    parser.add_argument('--expected-sha256', required=True)
    args = parser.parse_args()
    raw = args.baseline.read_bytes()
    assert sha(raw) == args.expected_sha256, 'Baseline changed; stop for review'
    candidate = patch(raw.decode()).encode()
    args.output.mkdir(mode=0o700)
    (args.output / 'Caddyfile.before').write_bytes(raw)
    (args.output / 'Caddyfile').write_bytes(candidate)
    receipt = {'result': 'PREPARED_ONLY', 'baseline_sha256': sha(raw), 'candidate_sha256': sha(candidate),
               'policy_sha256': sha((HERE / 'policy.json').read_bytes()), 'production_writes': 0}
    (args.output / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
