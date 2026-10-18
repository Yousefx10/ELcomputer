"""Verified package entry; never runs root work before validating private inputs."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
import traceback


def require(value, code):
    if not value:
        raise ValueError(code)


def read(path):
    require(path.resolve(strict=True) == path, 'PACKAGE_SYMLINK')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        before = os.fstat(stream.fileno())
        require(stat.S_ISREG(before.st_mode) and before.st_uid == before.st_gid == 0
                and stat.S_IMODE(before.st_mode) == 0o600 and before.st_nlink == 1
                and before.st_size <= 16_000_000, 'PACKAGE_METADATA')
        raw = stream.read(16_000_001)
        after = os.fstat(stream.fileno())
    signature = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_uid, s.st_gid, s.st_mode, s.st_mtime_ns, s.st_ctime_ns, s.st_nlink)
    require(signature(before) == signature(after) == signature(path.lstat()), 'PACKAGE_CHANGED')
    return raw


def main():
    arg = argparse.ArgumentParser(description='Exact-bound operator; execution requires separate owner approval')
    arg.add_argument('--manifest-sha256', required=True)
    arg.add_argument('--authorization-sha256')
    args = arg.parse_args()
    require(os.geteuid() == 0, 'ROOT_REQUIRED')
    root = Path(__file__).absolute().parent
    info = root.lstat()
    require(root.resolve(strict=True) == root and Path.cwd() == root and root.parent == Path('/root')
            and stat.S_ISDIR(info.st_mode) and info.st_uid == info.st_gid == 0
            and stat.S_IMODE(info.st_mode) == 0o700, 'ROOT_WORKSPACE')
    os.umask(0o077)
    raw = read(root / 'MANIFEST.json')
    require(hashlib.sha256(raw).hexdigest() == args.manifest_sha256, 'MANIFEST_HASH')
    manifest = json.loads(raw)
    require(manifest['format'] == 1 and manifest['purpose'] == 'Exact dashboard ingress activation'
            and manifest['mode'] in ('verify', 'apply', 'rollback'), 'MANIFEST_SCOPE')
    expected = {'BINDING.json', 'dashboard_activation.py', 'root_dashboard_read_activate.py',
                'prepare_dashboard_read_activation.py', 'root_dashboard_read_check.py', 'dashboard_access.py',
                'config_parser.py', 'private_config.py', 'atomic_config.py', 'dashboard_read_policy.json'}
    require(set(manifest['files']) == expected, 'PACKAGE_FILES')
    for name, sha in manifest['files'].items():
        require(hashlib.sha256(read(root / name)).hexdigest() == sha, 'PACKAGE_HASH')
    require(hashlib.sha256(read(root / 'bootstrap.py')).hexdigest() == manifest['bootstrap_sha256'], 'BOOTSTRAP_HASH')
    modules = {p.name for p in root.iterdir() if p.suffix in ('.py', '.pyc', '.so', '.pyd', '.zip') or p.is_dir()}
    require(modules == {n for n in expected if n.endswith('.py')} | {'bootstrap.py'}, 'MODULE_PATHS')
    require(manifest['mode'] == 'verify' or args.authorization_sha256 is not None, 'FRESH_AUTHORIZATION_REQUIRED')
    # Imports are possible only after validating every executable source byte.
    sys.path.insert(0, str(root))
    import dashboard_activation as activation
    activation.durable_new(root / 'ENTRY-STARTED.private.json', dict(manifest_sha256=args.manifest_sha256, mode=manifest['mode']))
    result = activation.run(root, manifest['mode'], json.loads(read(root / 'BINDING.json')),
                            args.manifest_sha256, args.authorization_sha256)
    print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # The journal, not guessed zero-change counters, describes uncertain effects.
        if os.geteuid() == 0:
            try:
                root = Path(__file__).absolute().parent
                info = root.lstat()
                require(root.resolve(strict=True) == root and root.parent == Path('/root') and info.st_uid == info.st_gid == 0
                        and stat.S_IMODE(info.st_mode) == 0o700, 'ROOT_WORKSPACE')
                fd = os.open(root / 'STOP.private.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
                with os.fdopen(fd, 'w') as stream:
                    stream.write(traceback.format_exc())
                    stream.flush()
                    os.fsync(stream.fileno())
            except Exception:
                pass
        print(json.dumps(dict(result='BLOCKED', exception_type=type(error).__name__,
                              disposition='Consult private journal; do not assume no replacement or reload',
                              automatic_retry=False, automatic_rollback=False, cleanup=False)))
        sys.exit(1)
