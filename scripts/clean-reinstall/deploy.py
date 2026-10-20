#!/usr/bin/env python3
"""Explicit future first activation/restart or retained-release rollback.

Does not reinstall a VPS, access SQL, execute npm lifecycle scripts, or retry.
"""
import argparse
import hashlib
import http.client
import json
import os
import pathlib
import re
import stat
import subprocess
import tarfile
import time


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()


def extract_release(archive, destination, inventory):
    expected = {e['path']: e for e in inventory}; seen = set()
    destination.mkdir(mode=0o755)
    destination.chmod(0o755)
    with tarfile.open(archive) as tar:
        members = tar.getmembers()
        for member in members:
            p = pathlib.PurePosixPath(member.name)
            assert p.parts[0] == '.output' and '..' not in p.parts
            name = '/'.join(p.parts[1:]); assert name not in seen and name in expected
            seen.add(name); e = expected[name]
            # Sealed archive normalizes link headers to 0755; POSIX lstat
            # reports links as 0777. Their target bytes carry the authority.
            if member.issym(): assert member.mode == 0o755 and e['mode'] == 0o777
            else: assert member.mode == e['mode'] and not member.mode & 0o022
            if member.isfile():
                assert e['type'] == 'file' and member.size == e['size']
                assert hashlib.sha256(tar.extractfile(member).read()).hexdigest() == e['sha256']
            elif member.isdir(): assert e['type'] == 'directory'
            elif member.issym():
                assert e['type'] == 'link' and member.linkname == e['target']
                assert not pathlib.PurePosixPath(member.linkname).is_absolute()
                resolved = (destination / name).parent.joinpath(member.linkname).resolve()
                assert resolved.is_relative_to(destination.resolve())
            else: raise AssertionError('Unsupported archive member')
        assert seen == set(expected)
        # All paths, links and file hashes have passed before first extraction.
        for member in members:
            name = '/'.join(pathlib.PurePosixPath(member.name).parts[1:])
            if not name: continue
            target = destination / name
            if member.isdir():
                target.mkdir(mode=member.mode, exist_ok=True)
                target.chmod(member.mode)
            elif member.isfile():
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open('xb') as out: out.write(tar.extractfile(member).read())
                target.chmod(member.mode)
            else: target.symlink_to(member.linkname)


def main():
    a = argparse.ArgumentParser(); a.add_argument('kit'); a.add_argument('--activate-new-host', action='store_true'); a.add_argument('--rollback-release')
    args = a.parse_args(); assert args.activate_new_host != bool(args.rollback_release)
    assert os.geteuid() == 0
    kit = pathlib.Path(args.kit).resolve(); cfg = json.loads((kit / 'config.json').read_text())
    marker = pathlib.Path('/var/lib/clean-storefront-install'); installed = json.loads((marker / 'installed.json').read_text())
    assert installed['config_sha256'] == sha(kit / 'config.json')
    assert installed['machine_id'] == pathlib.Path('/etc/machine-id').read_text().strip()
    for name, digest in json.loads((kit / 'SHA256.json').read_text()).items(): assert sha(kit / name) == digest
    root = pathlib.Path(cfg['root']); env = pathlib.Path('/etc') / cfg['service'] / 'runtime.env'
    s = env.lstat(); assert stat.S_ISREG(s.st_mode) and s.st_uid == 0 and stat.S_IMODE(s.st_mode) == 0o600
    assert not env.is_symlink() and (root / 'shared/uploads').is_dir()
    # Compare recovered environment digest before any start. No values are logged.
    expected = json.loads((marker / 'recovery.json').read_text())
    assert sha(env) == expected['runtime_env_sha256']
    assert sha(kit / 'media-manifest.json') == expected['media_manifest_sha256']
    for name, entry in json.loads((kit / 'media-manifest.json').read_text()).items():
        f = root / 'shared/uploads' / name
        assert f.is_file() and not f.is_symlink() and sha(f) == entry['sha256']
    if args.rollback_release:
        assert re.fullmatch('[a-f0-9]{12,64}', args.rollback_release)
        destination = root / 'releases' / args.rollback_release
        assert destination.is_dir() and not destination.is_symlink()
        assert (destination / 'VERIFIED.json').is_file()
        saved = json.loads((destination / 'OUTPUT-INVENTORY.json').read_text())
        for entry in saved:
            f = destination / entry['path']
            if entry['type'] == 'file': assert f.is_file() and not f.is_symlink() and sha(f) == entry['sha256']
            elif entry['type'] == 'link': assert f.is_symlink() and os.readlink(f) == entry['target']
            else: assert f.is_dir() and not f.is_symlink()
    else:
        assert not (root / 'current').exists() and not (root / 'current').is_symlink()
        release_id = cfg['application_archive_sha256'][:16]
        destination = root / 'releases' / release_id
        assert sha(kit / 'release.tar.gz') == cfg['application_archive_sha256']
        extract_release(kit / 'release.tar.gz', destination, json.loads((kit / 'output-inventory.json').read_text()))
        (destination / 'OUTPUT-INVENTORY.json').write_bytes((kit / 'output-inventory.json').read_bytes())
        (destination / 'VERIFIED.json').write_text(json.dumps({'archive_sha256': cfg['application_archive_sha256'], 'commit': cfg['application_commit']}) + '\n')
    # Exclusive intent file survives a failed switch; no automatic rerun/resume.
    with (marker / ('rollback-' + args.rollback_release if args.rollback_release else 'activation')).open('x') as f:
        f.write(str(destination) + '\n')
    link = root / 'current.next'; link.symlink_to(destination)
    link.replace(root / 'current')
    subprocess.run(['systemctl', 'enable', cfg['service'] + '.service', 'caddy.service'], check=True)
    subprocess.run(['systemctl', 'restart' if args.rollback_release else 'start', cfg['service'] + '.service'], check=True)
    # Caddy starts only after the Nuxt process is up. No automatic upstream retry.
    subprocess.run(['systemctl', 'is-active', '--quiet', cfg['service'] + '.service'], check=True)
    ready = False
    for _ in range(60):
        try:
            conn = http.client.HTTPConnection('127.0.0.1', cfg['port'], timeout=2)
            conn.request('GET', '/api/admin-products/list')
            response = conn.getresponse(); ready = response.status == 401
            response.read(); conn.close()
        except OSError: pass
        if ready: break
        time.sleep(0.5)
    assert ready, 'Private runtime did not become ready; Caddy remains stopped'
    subprocess.run(['systemctl', 'start', 'caddy.service'], check=True)
    print('ACTIVATION COMMANDS COMPLETE. Run health.py and owner acceptance; preserve failures.')


if __name__ == '__main__':
    try: main()
    except Exception:
        raise SystemExit('Deployment stopped. Preserve state; no automatic retry or rollback.')
