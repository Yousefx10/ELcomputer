"""Exclusive verified intake for a separately approved, mode-bound package.

Derived from the reviewed CHECK bootstrap. No extraction happens before complete
archive/manifest validation. Never reads configuration, signals or uses a shell.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import stat
import sys
import tarfile


def require(value, code):
    if not value:
        raise ValueError(code)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def unpack_verified(raw, manifest_sha, mode):
    files = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
        members = archive.getmembers()
        require(1 <= len(members) <= 32, 'ARCHIVE_COUNT')
        for item in members:
            require(PurePosixPath(item.name).name == item.name and item.name not in ('.', '..', 'bootstrap.py', 'bundle.tar')
                    and item.isfile() and item.uid == item.gid == 0 and item.mode == 0o600
                    and item.size <= 1_000_000 and item.name not in files, 'ARCHIVE_MEMBER')
            files[item.name] = archive.extractfile(item).read()
    require(digest(files.get('MANIFEST.json', b'')) == manifest_sha, 'MANIFEST_HASH')
    manifest = json.loads(files['MANIFEST.json'])
    require(manifest['format'] == 1 and manifest['purpose'] == 'Exact dashboard ingress activation'
            and manifest['mode'] == mode, 'PACKAGE_MODE')
    require(set(files) == set(manifest['files']) | {'MANIFEST.json'}, 'ARCHIVE_SET')
    require(all(digest(files[n]) == h for n, h in manifest['files'].items()), 'ARCHIVE_HASH')
    return files


def write_new(path, raw):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())


def main():
    parser = argparse.ArgumentParser(description='Owner-approved exact package intake; no approval is implied')
    parser.add_argument('--archive', required=True)
    parser.add_argument('--archive-sha256', required=True)
    parser.add_argument('--manifest-sha256', required=True)
    parser.add_argument('--mode', choices=['verify', 'apply', 'rollback'], required=True)
    parser.add_argument('--staging-uid', type=int, required=True)
    parser.add_argument('--staging-gid', type=int, required=True)
    parser.add_argument('--authorization-sha256')
    args = parser.parse_args()
    require(os.geteuid() == 0, 'ROOT_REQUIRED')
    require(args.mode == 'verify' or args.authorization_sha256 is not None, 'AUTHORIZATION_REQUIRED')
    root = Path(__file__).absolute().parent
    info = root.lstat()
    require(root.resolve(strict=True) == root and root.parent == Path('/root')
            and info.st_uid == info.st_gid == 0 and stat.S_IMODE(info.st_mode) == 0o700
            and stat.S_ISDIR(info.st_mode), 'ROOT_WORKSPACE')
    source = Path(args.archive)
    require(source.resolve(strict=True) == source, 'ARCHIVE_SYMLINK')
    os.umask(0o077)
    fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        before = os.fstat(stream.fileno())
        require(stat.S_ISREG(before.st_mode) and before.st_uid == args.staging_uid and before.st_gid == args.staging_gid
                and stat.S_IMODE(before.st_mode) == 0o600 and before.st_nlink == 1
                and before.st_size <= 2_000_000, 'STAGED_METADATA')
        raw = stream.read(2_000_001)
        after = os.fstat(stream.fileno())
    sig = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mode, s.st_uid, s.st_gid, s.st_mtime_ns, s.st_ctime_ns, s.st_nlink)
    require(sig(before) == sig(after) == sig(source.lstat()) and digest(raw) == args.archive_sha256, 'STAGED_HASH')
    files = unpack_verified(raw, args.manifest_sha256, args.mode)
    manifest = json.loads(files['MANIFEST.json'])
    require(digest(Path(__file__).read_bytes()) == manifest['bootstrap_sha256'], 'BOOTSTRAP_HASH')
    write_new(root / 'bundle.tar', raw)
    for name, content in files.items():
        write_new(root / name, content)
    parent = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    os.fsync(parent)
    os.close(parent)
    os.chdir(root)
    argv = [sys.executable, '-I', '-B', str(root / 'root_dashboard_read_activate.py'), '--manifest-sha256', args.manifest_sha256]
    if args.authorization_sha256 is not None:
        argv += ['--authorization-sha256', args.authorization_sha256]
    os.execv(sys.executable, argv)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps(dict(result='BLOCKED', stage='intake', exception_type=type(error).__name__, automatic_retry=False, cleanup=False)))
        sys.exit(1)
