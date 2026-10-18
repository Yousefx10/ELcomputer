"""Verified inert package intake; then exec the CHECK-only entry point.

Owner Console command must copy and hash-verify this file before root execution.
No live configuration, application archive, reload or service action is supported.
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


def digest(value):
    return hashlib.sha256(value).hexdigest()


def archive_read(path, expected, uid, limit=2 * 1024 * 1024):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        before = os.fstat(stream.fileno())
        require(stat.S_ISREG(before.st_mode) and before.st_uid == uid
                and stat.S_IMODE(before.st_mode) == 0o600 and before.st_size <= limit, 'STAGED_ARCHIVE_METADATA')
        raw = stream.read(limit + 1)
        after = os.fstat(stream.fileno())
        require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns)
                == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns)
                and len(raw) <= limit and digest(raw) == expected, 'STAGED_ARCHIVE_HASH')
    return raw


def unpack_verified(raw, manifest_sha256):
    """Validate every tar member and every manifest byte before any extraction."""
    files = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
        members = archive.getmembers()
        require(1 <= len(members) <= 32, 'ARCHIVE_MEMBER_COUNT')
        for member in members:
            name = member.name
            require(PurePosixPath(name).name == name and name not in ('.', '..', 'bootstrap.py', 'bundle.tar')
                    and member.isfile() and member.mode == 0o600 and member.uid == member.gid == 0
                    and member.size <= 1024 * 1024 and name not in files, 'ARCHIVE_MEMBER')
            files[name] = archive.extractfile(member).read()
    require(digest(files.get('MANIFEST.json', b'')) == manifest_sha256, 'MANIFEST_HASH')
    manifest = json.loads(files['MANIFEST.json'])
    require(manifest['format'] == 1 and manifest['scope'] == 'ADM-01 approved dashboard reads CHECK only', 'MANIFEST_SCOPE')
    require(set(files) == set(manifest['files']) | {'MANIFEST.json'}, 'ARCHIVE_FILE_SET')
    require(all(digest(files[name]) == sha for name, sha in manifest['files'].items()), 'ARCHIVE_FILE_HASH')
    return files


def write_new(path, raw):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())


def main():
    parser = argparse.ArgumentParser(description='Verified package intake and CHECK only')
    parser.add_argument('--archive', required=True)
    parser.add_argument('--archive-sha256', required=True)
    parser.add_argument('--manifest-sha256', required=True)
    parser.add_argument('--staging-uid', required=True, type=int)
    args = parser.parse_args()
    require(os.geteuid() == 0, 'ROOT_REQUIRED')
    os.umask(0o077)
    root = Path(__file__).absolute().parent
    info = root.lstat()
    require(root.resolve() == root and stat.S_ISDIR(info.st_mode) and info.st_uid == 0
            and stat.S_IMODE(info.st_mode) == 0o700, 'ROOT_WORKSPACE')
    # mkdir in the reviewed owner command is exclusive. Every destination below
    # is exclusive too: failure preserves evidence and cannot be resumed/retried.
    raw = archive_read(Path(args.archive), args.archive_sha256, args.staging_uid)
    files = unpack_verified(raw, args.manifest_sha256)
    write_new(root / 'bundle.tar', raw)
    for name, content in files.items():
        write_new(root / name, content)
    os.chdir(root)
    os.execv(sys.executable, [sys.executable, '-I', '-B', str(root / 'root_dashboard_read_check.py'),
                             '--manifest-sha256', args.manifest_sha256])


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps(dict(result='BLOCKED', stage='package-intake', exception_type=type(error).__name__,
                              configuration_exported=False, live_configuration_changes=0, nginx_reloads=0,
                              service_operations=0, retry=False)))
        sys.exit(1)
