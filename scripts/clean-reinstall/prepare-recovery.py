#!/usr/bin/env python3
"""Off-VPS only: recover narrowly selected inputs into new encrypted envelopes.

Requires Python 3.10+, Node 22 and the separately stored AES key. No network.
Original archives are authenticated by backup-envelope.mjs before plaintext flows.
"""
import argparse
import hashlib
import io
import json
import os
import pathlib
import shlex
import subprocess
import tarfile


def decrypt(node, decoder, key, archive):
    return subprocess.Popen([node, decoder, 'decrypt', key, str(archive)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def env_values(raw):
    result = {}
    for line in raw.decode().splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        name, value = line.removeprefix('export ').split('=', 1)
        name = name.strip()
        assert name.replace('_', '').isalnum() and name not in result
        parts = shlex.split(value, comments=True)
        assert len(parts) <= 1
        result[name] = parts[0] if parts else ''
    return result


def runtime_environment(source, config):
    def pick(*names):
        values = [source[n] for n in names if source.get(n)]
        assert values and len(set(values)) == 1, 'Missing or conflicting runtime input'
        return values[0]
    result = {
        'NODE_ENV': 'production', 'HOST': '127.0.0.1', 'NITRO_HOST': '127.0.0.1',
        'PORT': str(config['port']), 'NITRO_PORT': str(config['port']),
        'NUXT_UPLOADS_DIR': config['root'] + '/shared/uploads',
        'UPLOADS_DIR': config['root'] + '/shared/uploads',
        'NUXT_PUBLIC_SITE_URL': 'https://' + config['domain'],
        'NUXT_PUBLIC_SUPABASE_URL': pick('NUXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'),
        'NUXT_PUBLIC_SUPABASE_KEY': pick('NUXT_PUBLIC_SUPABASE_KEY', 'NUXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'),
        'NUXT_SUPABASE_SERVICE_ROLE_KEY': pick('NUXT_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'),
        'NUXT_CREDENTIALS_ENCRYPTION_KEY': pick('NUXT_CREDENTIALS_ENCRYPTION_KEY', 'CREDENTIALS_ENCRYPTION_KEY'),
        'NUXT_SHIPPING_CREDENTIALS_ENCRYPTION_KEY': pick('NUXT_SHIPPING_CREDENTIALS_ENCRYPTION_KEY', 'SHIPPING_CREDENTIALS_ENCRYPTION_KEY'),
        'NUXT_PAYMOB_ENABLED': 'false', 'NUXT_SHIPPING_LIVE_REQUESTS_ENABLED': 'false',
        'PDC_LIVE_REQUESTS_ENABLED': 'false',
    }
    assert result['NUXT_PUBLIC_SUPABASE_URL'] == 'https://' + config['supabase_project'] + '.supabase.co'
    for k, v in result.items():
        assert not any(c in v for c in '\n\r\0'), 'Invalid environment value'
    # systemd EnvironmentFile quoting: dollar expansion and shell execution absent.
    encode = lambda v: '"' + v.replace('\\', '\\\\').replace('"', '\\"').replace('`', '\\`').replace('$', '\\$') + '"'
    return ''.join(k + '=' + encode(v) + '\n' for k, v in result.items()).encode()


def main():
    a = argparse.ArgumentParser()
    for name in ['config', 'backups', 'catalog', 'key', 'node', 'decoder', 'output']:
        a.add_argument('--' + name, required=True)
    args = a.parse_args(); os.umask(0o077)
    config = json.loads(pathlib.Path(args.config).read_text())
    backups, catalog, output = map(pathlib.Path, [args.backups, args.catalog, args.output])
    output.mkdir(mode=0o700)
    def envelope(name, data):
        r = subprocess.run([args.node, args.decoder, 'encrypt', args.key, str(output / name)], input=data, capture_output=True)
        assert r.returncode == 0, 'Envelope creation failed'
        return json.loads(r.stdout)
    recovered_env = None
    p = decrypt(args.node, args.decoder, args.key, backups / 'elcomputer-home.tar.gz.enc')
    with tarfile.open(fileobj=p.stdout, mode='r|gz') as archive:
        for m in archive:
            if m.name.removeprefix('./') == config['main_env_member']:
                assert m.isfile() and m.size < 65536 and recovered_env is None
                recovered_env = archive.extractfile(m).read()
    p.stdout.close(); p.stderr.read(); assert p.wait() == 0 and recovered_env
    original_env = envelope('original-runtime.env.enc', recovered_env)
    normalized = runtime_environment(env_values(recovered_env), config)
    active_env = envelope('runtime.env.enc', normalized)
    encryptor = subprocess.Popen([args.node, args.decoder, 'encrypt', args.key, str(output / 'media.tar.gz.enc')], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    manifest = {}; sections = {'catalog': 0, 'older': 0}
    def add(archive, path, data, section):
        path = pathlib.PurePosixPath(path)
        assert not path.is_absolute() and '..' not in path.parts
        key = str(path); digest = hashlib.sha256(data).hexdigest()
        if key in manifest:
            assert manifest[key]['sha256'] == digest, 'Media filename collision; stop for review'
            return
        assert path.suffix.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'], 'Unreviewed non-image file'
        m = tarfile.TarInfo(key); m.size = len(data); m.mode = 0o640
        archive.addfile(m, io.BytesIO(data))
        manifest[key] = {'bytes': len(data), 'sha256': digest}; sections[section] += 1
    with tarfile.open(fileobj=encryptor.stdin, mode='w|gz') as archive:
        for f in sorted(catalog.rglob('*')):
            assert not f.is_symlink()
            if f.is_file(): add(archive, str(f.relative_to(catalog)), f.read_bytes(), 'catalog')
        p = decrypt(args.node, args.decoder, args.key, backups / 'newelcomputer-home.tar.gz.enc')
        with tarfile.open(fileobj=p.stdout, mode='r|gz') as source:
            for m in source:
                name = m.name.removeprefix('./')
                if not name.startswith(config['older_uploads_prefix']) or m.isdir(): continue
                assert m.isfile()
                add(archive, name.removeprefix(config['older_uploads_prefix']), source.extractfile(m).read(), 'older')
        p.stdout.close(); p.stderr.read(); assert p.wait() == 0
    encryptor.stdin.close(); receipt = encryptor.stdout.read(); error = encryptor.stderr.read()
    assert encryptor.wait() == 0, 'Media envelope creation failed'
    assert sections == {'catalog': 2505, 'older': 102}, 'Unexpected media inventory; refresh reviewed baseline'
    (output / 'media-manifest.json').write_text(json.dumps(manifest, sort_keys=True, indent=2) + '\n')
    report = {'result': 'PASS', 'sections': sections, 'files': len(manifest), 'bytes': sum(f['bytes'] for f in manifest.values()),
              'original_env': original_env, 'runtime_env': active_env, 'media': json.loads(receipt),
              'runtime_names': list(env_values(normalized)), 'keys_preserved_byte_exact': True,
              'secrets_or_customer_records_in_report': False, 'production_connections': 0}
    (output / 'RECOVERY-INPUTS.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'result': 'PASS', 'files': len(manifest), 'sections': sections}))


if __name__ == '__main__':
    try: main()
    except Exception:
        raise SystemExit('Recovery preparation stopped. Preserve outputs; no automatic retry.')
