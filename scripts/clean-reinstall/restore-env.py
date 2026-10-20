#!/usr/bin/env python3
"""Receive one authenticated off-VPS env stream without displaying secrets."""
import argparse
import hashlib
import json
import os
import pathlib
import re
import shlex
import sys


def main():
    a = argparse.ArgumentParser(); a.add_argument('kit'); a.add_argument('--expected-env-sha256', required=True)
    args = a.parse_args(); os.umask(0o077); assert os.geteuid() == 0
    assert re.fullmatch('[a-f0-9]{64}', args.expected_env_sha256)
    kit = pathlib.Path(args.kit); cfg = json.loads((kit / 'config.json').read_text())
    marker = pathlib.Path('/var/lib/clean-storefront-install')
    installed = json.loads((marker / 'installed.json').read_text())
    assert installed['config_sha256'] == hashlib.sha256((kit / 'config.json').read_bytes()).hexdigest()
    assert installed['machine_id'] == pathlib.Path('/etc/machine-id').read_text().strip()
    raw = sys.stdin.buffer.read(65537); assert 0 < len(raw) <= 65536
    assert hashlib.sha256(raw).hexdigest() == args.expected_env_sha256
    values = {}
    for line in raw.decode().splitlines():
        name, value = line.split('=', 1); assert name not in values
        tokens = shlex.split(value); assert len(tokens) == 1
        values[name] = tokens[0]
    expected = {'NODE_ENV': 'production', 'HOST': '127.0.0.1', 'NITRO_HOST': '127.0.0.1', 'PORT': str(cfg['port']), 'NITRO_PORT': str(cfg['port']),
                'NUXT_PUBLIC_SITE_URL': 'https://' + cfg['domain'], 'NUXT_PUBLIC_SUPABASE_URL': 'https://' + cfg['supabase_project'] + '.supabase.co',
                'UPLOADS_DIR': cfg['root'] + '/shared/uploads', 'NUXT_UPLOADS_DIR': cfg['root'] + '/shared/uploads',
                'NUXT_PAYMOB_ENABLED': 'false', 'NUXT_SHIPPING_LIVE_REQUESTS_ENABLED': 'false', 'PDC_LIVE_REQUESTS_ENABLED': 'false'}
    required = {'NUXT_PUBLIC_SUPABASE_KEY', 'NUXT_SUPABASE_SERVICE_ROLE_KEY', 'NUXT_CREDENTIALS_ENCRYPTION_KEY', 'NUXT_SHIPPING_CREDENTIALS_ENCRYPTION_KEY'}
    assert set(values) == set(expected) | required
    assert all(values[k] == v for k, v in expected.items()) and all(values[k] for k in required)
    parent = pathlib.Path('/etc') / cfg['service']; stat = parent.lstat()
    assert parent.is_dir() and not parent.is_symlink() and stat.st_uid == 0 and stat.st_mode & 0o777 == 0o700
    assert not (marker / 'recovery.json').exists()
    fd = os.open(parent / 'runtime.env', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as output: output.write(raw); output.flush(); os.fsync(output.fileno())
    recovery = {'runtime_env_sha256': args.expected_env_sha256, 'media_manifest_sha256': hashlib.sha256((kit / 'media-manifest.json').read_bytes()).hexdigest()}
    with (marker / 'recovery.json').open('x') as f: f.write(json.dumps(recovery) + '\n')
    print('ENV RECOVERY PASS; private values were not displayed.')


if __name__ == '__main__':
    try: main()
    except Exception:
        raise SystemExit('Environment recovery stopped. Preserve state; no automatic retry.')
