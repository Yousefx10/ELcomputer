#!/usr/bin/env python3
"""Build a local Caddy candidate. No connection, installation or reload."""
import argparse
import hashlib
import json
import pathlib
import re


def patch(source):
    anchor = '        @dormant path_regexp dormant '
    assert source.count(anchor) == 1 and '@controlled_purchase' not in source
    proxies = re.findall(r'^        reverse_proxy 127\.0\.0\.1:\d+ \{\n.*?^        \}', source, re.M | re.S)
    assert len(proxies) == 1
    # Customer APIs remain bearer-authenticated and enforce the private grant.
    # Paymob's independent HMAC receiver remains available after grant expiry.
    expression = ('((method("GET") || method("HEAD")) && path_regexp("^/(ar/)?account/controlled-purchase/?$")) || '
                  '((method("GET") || method("POST")) && path("/api/checkout/controlled")) || '
                  '(method("POST") && path("/api/payments/paymob/webhook"))')
    block = '\n'.join([
        '        # Controlled purchase only; public checkout and PDC remain held.',
        '        @controlled_purchase expression `' + expression + '`',
        '        header @controlled_purchase >Cache-Control "private, no-store"',
        proxies[0].replace('reverse_proxy ', 'reverse_proxy @controlled_purchase ', 1),
        ''
    ])
    return source.replace(anchor, block + anchor, 1)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('baseline', type=pathlib.Path)
    p.add_argument('output', type=pathlib.Path)
    p.add_argument('--expected-sha256', required=True)
    a = p.parse_args()
    raw = a.baseline.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == a.expected_sha256
    candidate = patch(raw.decode()).encode()
    a.output.mkdir(mode=0o700)
    for name, data in [('Caddyfile.before', raw), ('Caddyfile', candidate)]:
        with (a.output/name).open('xb') as f:
            f.write(data)
        (a.output/name).chmod(0o600)
    receipt = {'result':'LOCAL_PREPARATION_ONLY', 'baseline_sha256':hashlib.sha256(raw).hexdigest(),
               'candidate_sha256':hashlib.sha256(candidate).hexdigest(), 'production_changes':0,
               'requires_separate_activation_approval':True, 'runtime_grant_not_configured':True}
    (a.output/'receipt.json').write_text(json.dumps(receipt, indent=2)+'\n')
    (a.output/'receipt.json').chmod(0o600)
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
