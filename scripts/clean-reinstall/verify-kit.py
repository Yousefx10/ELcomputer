#!/usr/bin/env python3
"""Verify an offline kit against the separately reviewed manifest hash."""
import argparse
import hashlib
import json
import pathlib
import re


def verify(kit, expected):
    assert re.fullmatch('[a-f0-9]{64}', expected)
    assert hashlib.sha256((kit / 'SHA256.json').read_bytes()).hexdigest() == expected
    manifest = json.loads((kit / 'SHA256.json').read_text())
    for name, digest in manifest.items():
        p = pathlib.PurePosixPath(name)
        assert len(p.parts) == 1 and name not in ['.', '..']
        path = kit / name
        assert path.is_file() and not path.is_symlink()
        assert hashlib.sha256(path.read_bytes()).hexdigest() == digest
    assert {p.name for p in kit.iterdir()} == set(manifest) | {'SHA256.json'}
    return len(manifest) + 1


if __name__ == '__main__':
    a = argparse.ArgumentParser(); a.add_argument('kit'); a.add_argument('--manifest-sha256', required=True)
    args = a.parse_args()
    count = verify(pathlib.Path(args.kit), args.manifest_sha256)
    print(json.dumps({'result': 'PASS', 'kit_files': count}))
