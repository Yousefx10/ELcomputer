#!/usr/bin/env python3
"""Install ONLY on an already reinstalled Ubuntu VPS or disposable Ubuntu lab.

Does not reset a machine, deploy an application, restore SQL or start a service.
Run after separate execution approval; the argument binds a NEW machine-id.
"""
import argparse
import hashlib
import json
import os
import pathlib
import pwd
import re
import posixpath
import subprocess
import sys
import tarfile


def run(*args):
    subprocess.run(args, check=True, stdin=subprocess.DEVNULL)


def unpack(path, destination, prefix=''):
    with tarfile.open(path) as archive:
        members = archive.getmembers()
        links = {m.name for m in members if m.issym()}
        seen = set()
        for m in members:
            p = pathlib.PurePosixPath(m.name)
            assert not p.is_absolute() and '..' not in p.parts
            assert str(p) not in seen; seen.add(str(p))
            assert m.isdir() or m.isfile() or m.issym()
            assert not any(str(parent) in links for parent in p.parents)
            if m.issym():
                assert not pathlib.PurePosixPath(m.linkname).is_absolute()
                resolved = posixpath.normpath(str(p.parent / m.linkname))
                assert resolved.startswith(p.parts[0] + '/')
            else: assert not m.mode & 0o022 and not m.mode & 0o7000
        # Explicit modes survive root's private umask. Defer all symlinks until
        # real files/directories are complete; never traverse a link on extraction.
        for m in members:
            target = pathlib.Path(destination) / m.name
            if m.isdir():
                target.mkdir(mode=m.mode)
                target.chmod(m.mode)
            elif m.isfile():
                with target.open('xb') as output:
                    source = archive.extractfile(m)
                    for block in iter(lambda: source.read(1024 * 1024), b''): output.write(block)
                target.chmod(m.mode)
        for m in members:
            if m.issym(): (pathlib.Path(destination) / m.name).symlink_to(m.linkname)


def directory(path, mode):
    path.mkdir(mode=mode)
    path.chmod(mode)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('kit'); p.add_argument('--fresh-machine-id', required=True)
    args = p.parse_args(); os.umask(0o077)
    assert sys.version_info >= (3, 12), 'Ubuntu Python 3.12+ required'
    kit = pathlib.Path(args.kit).resolve(); cfg = json.loads((kit / 'config.json').read_text())
    assert os.geteuid() == 0, 'Root required on fresh target only'
    assert re.fullmatch('[a-f0-9]{32}', args.fresh_machine_id)
    assert pathlib.Path('/etc/machine-id').read_text().strip() == args.fresh_machine_id
    osrelease = dict(line.split('=', 1) for line in pathlib.Path('/etc/os-release').read_text().splitlines() if '=' in line)
    assert osrelease['ID'].strip('"') == 'ubuntu' and osrelease['VERSION_ID'].strip('"') == cfg['ubuntu']
    assert os.uname().machine == 'x86_64'
    for old in ['/etc/nginx', '/etc/cloudpanel', '/home/elcomputer/main-runtime', cfg['root'], '/usr/local/bin/caddy', '/etc/systemd/system/' + cfg['service'] + '.service']:
        assert not pathlib.Path(old).exists(), 'Existing installation; STOP'
    # Verify every locally supplied artifact before packages or accounts change.
    manifest = json.loads((kit / 'SHA256.json').read_text())
    for name, digest in manifest.items():
        path = pathlib.PurePosixPath(name)
        assert not path.is_absolute() and '..' not in path.parts
        assert hashlib.sha256((kit / name).read_bytes()).hexdigest() == digest
    for name, digest in [(f"node-v{cfg['node_version']}-linux-x64.tar.xz", cfg['node_linux_x64_sha256']),
                         (f"caddy_{cfg['caddy_version']}_linux_amd64.tar.gz", cfg['caddy_linux_amd64_sha256'])]:
        assert hashlib.sha256((kit / name).read_bytes()).hexdigest() == digest
    marker = pathlib.Path('/var/lib/clean-storefront-install')
    marker.mkdir(mode=0o700)  # exclusive; a failed installation requires review
    (marker / 'machine-id').write_text(args.fresh_machine_id + '\n')
    os.environ['DEBIAN_FRONTEND'] = 'noninteractive'
    run('apt-get', 'update')
    run('apt-get', 'install', '-y', '--no-install-recommends', 'ca-certificates', 'curl', 'xz-utils', 'ufw', 'libstdc++6', 'libgcc-s1', 'openssl')
    for user, home in [(cfg['user'], '/nonexistent'), ('caddy', '/var/lib/caddy')]:
        run('useradd', '--system', '--user-group', '--home-dir', home, '--shell', '/usr/sbin/nologin', user)
    root = pathlib.Path(cfg['root'])
    for folder, mode in [(root, 0o755), (root / 'releases', 0o755), (root / 'shared', 0o750), (pathlib.Path('/etc') / cfg['service'], 0o700), (pathlib.Path('/etc/caddy'), 0o755), (pathlib.Path('/var/lib/caddy'), 0o700)]:
        directory(folder, mode)
    caddy = pwd.getpwnam('caddy'); app = pwd.getpwnam(cfg['user'])
    os.chown('/var/lib/caddy', caddy.pw_uid, caddy.pw_gid)
    os.chown(root / 'shared', 0, app.pw_gid)
    unpack(kit / f"node-v{cfg['node_version']}-linux-x64.tar.xz", '/opt')
    # These vendor archives contain public binaries only, never runtime secrets.
    with tarfile.open(kit / f"caddy_{cfg['caddy_version']}_linux_amd64.tar.gz") as archive:
        binary = archive.getmember('caddy'); assert binary.isfile()
        target = pathlib.Path('/usr/local/bin/caddy')
        with target.open('xb') as f: f.write(archive.extractfile(binary).read())
        target.chmod(0o755)
    node = f"/opt/node-v{cfg['node_version']}-linux-x64/bin/node"
    assert subprocess.check_output([node, '--version'], text=True).strip() == 'v' + cfg['node_version']
    for name in [cfg['service'] + '.service', 'caddy.service']:
        dst = pathlib.Path('/etc/systemd/system') / name
        with dst.open('xb') as f: f.write((kit / name).read_bytes())
        dst.chmod(0o644)
    with pathlib.Path('/etc/caddy/Caddyfile').open('xb') as f: f.write((kit / 'Caddyfile').read_bytes())
    pathlib.Path('/etc/caddy/Caddyfile').chmod(0o644)
    run('/usr/local/bin/caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')
    run('systemctl', 'daemon-reload')
    run('systemd-analyze', 'verify', '/etc/systemd/system/' + cfg['service'] + '.service', '/etc/systemd/system/caddy.service')
    # OpenSSH before firewall activation; provider console must remain available.
    run('ufw', 'allow', '22/tcp'); run('ufw', 'allow', '80/tcp'); run('ufw', 'allow', '443/tcp')
    run('ufw', 'default', 'deny', 'incoming'); run('ufw', 'default', 'allow', 'outgoing')
    run('ufw', '--force', 'enable')
    (marker / 'installed.json').write_text(json.dumps({'machine_id': args.fresh_machine_id, 'config_sha256': hashlib.sha256((kit / 'config.json').read_bytes()).hexdigest(), 'services_started': False}) + '\n')
    print('INSTALL PASS; services remain stopped. Restore media/env, then deploy.')


if __name__ == '__main__':
    try: main()
    except Exception:
        raise SystemExit('Installation stopped. Preserve evidence; do not automatically rerun.')
