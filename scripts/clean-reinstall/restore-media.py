#!/usr/bin/env python3
"""Fresh-target stdin tar.gz restore, exact manifest comparison, no SQL/Auth."""
import argparse
import hashlib
import json
import os
import pathlib
import pwd
import sys
import tarfile


def restore(stream, destination, manifest):
    destination.mkdir(mode=0o750)  # exclusive; no existing upload overwritten
    seen = set()
    with tarfile.open(fileobj=stream, mode='r|gz') as archive:
        for member in archive:
            p = pathlib.PurePosixPath(member.name)
            assert member.isfile() and not p.is_absolute() and '..' not in p.parts
            name = str(p); assert name not in seen and name in manifest
            assert p.parts[0] in ['products', 'settings']
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o750)
            digest = hashlib.sha256(); size = 0
            source = archive.extractfile(member)
            with target.open('xb') as output:
                for block in iter(lambda: source.read(1024 * 1024), b''):
                    output.write(block); digest.update(block); size += len(block)
                output.flush(); os.fsync(output.fileno())
            target.chmod(0o640)
            assert {'bytes': size, 'sha256': digest.hexdigest()} == manifest[name]
            seen.add(name)
    assert seen == set(manifest)
    return len(seen)


def main():
    a = argparse.ArgumentParser(); a.add_argument('kit'); args = a.parse_args()
    assert os.geteuid() == 0
    kit = pathlib.Path(args.kit); cfg = json.loads((kit / 'config.json').read_text())
    assert pathlib.Path('/var/lib/clean-storefront-install/installed.json').is_file()
    manifest = json.loads((kit / 'media-manifest.json').read_text())
    assert hashlib.sha256((kit / 'media-manifest.json').read_bytes()).hexdigest() == json.loads((kit / 'SHA256.json').read_text())['media-manifest.json']
    target = pathlib.Path(cfg['root']) / 'shared/uploads'
    count = restore(sys.stdin.buffer, target, manifest)
    user = pwd.getpwnam(cfg['user'])
    for path in [target, *target.rglob('*')]: os.chown(path, user.pw_uid, user.pw_gid)
    print(json.dumps({'result': 'PASS', 'media_files': count}))


if __name__ == '__main__':
    try: main()
    except Exception:
        raise SystemExit('Media restoration stopped; preserve partial files and review.')
