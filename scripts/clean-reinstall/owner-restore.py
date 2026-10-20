#!/usr/bin/env python3
"""Future operator steps against a newly reinstalled, independently pinned host.

No step is run by preparation. 'verify' is local only; other steps are separate
explicit commands after approved erasure. No SQL, migrations or Auth reset.
"""
import argparse
import base64
import hashlib
import importlib.util
import io
import json
import pathlib
import re
import shlex
import subprocess
import tarfile


def pinned_line(lines, host, expected, previous):
    assert expected != previous and re.fullmatch(r'SHA256:[A-Za-z0-9+/]{43}', expected)
    matches = set()
    for line in lines.splitlines():
        if line.startswith('#'): continue
        parts = line.split()
        if len(parts) != 3 or parts[:2] != [host, 'ssh-ed25519']: continue
        blob = base64.b64decode(parts[2], validate=True)
        fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(blob).digest()).decode().rstrip('=')
        if fingerprint == expected: matches.add(' '.join(parts))
    assert len(matches) == 1, 'Console fingerprint mismatch; do not trust scanned host'
    return matches.pop() + '\n'


def main():
    a = argparse.ArgumentParser(); a.add_argument('binding')
    a.add_argument('step', choices=['verify', 'pin', 'transfer', 'install', 'media', 'environment', 'deploy', 'health'])
    a.add_argument('--console-fingerprint')
    args = a.parse_args(); cfg = json.loads(pathlib.Path(args.binding).read_text())
    assert cfg['format'] == 1
    kit = pathlib.Path(cfg['kit']); sums = kit / 'SHA256.json'
    assert hashlib.sha256(sums.read_bytes()).hexdigest() == cfg['kit_manifest_sha256']
    for name, digest in json.loads(sums.read_text()).items():
        assert len(pathlib.PurePosixPath(name).parts) == 1
        assert hashlib.sha256((kit / name).read_bytes()).hexdigest() == digest
    assert cfg['remote_kit'] == '/root/reinstall-kit'
    ssh = ['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'HostKeyAlgorithms=ssh-ed25519',
           '-o', 'UserKnownHostsFile=' + cfg['known_hosts'], '-o', 'ConnectionAttempts=1', '-o', 'ConnectTimeout=12', '-i', cfg['identity'], 'root@' + cfg['host']]
    def remote(command, **options): return subprocess.run(ssh + [command], check=True, **options)
    def archive_verify(path):
        r = subprocess.run([cfg['node'], cfg['decoder'], 'verify', cfg['key'], path], capture_output=True, check=True)
        return json.loads(r.stdout)
    if args.step == 'verify':
        media = archive_verify(cfg['media_archive']); env = archive_verify(cfg['environment_archive'])
        assert media['encryptedSha256'] == cfg['media_encrypted_sha256']
        assert env['plaintextSha256'] == cfg['environment_plaintext_sha256']
        assert pathlib.Path(cfg['identity']).is_file() and pathlib.Path(cfg['key']).is_file()
        print('OFFLINE INPUTS PASS. No VPS connection or production change.'); return
    if args.step == 'pin':
        assert args.console_fingerprint, 'Read the NEW host fingerprint in Hostinger Browser Terminal first'
        scan = subprocess.run(['ssh-keyscan', '-T', '12', '-t', 'ed25519', cfg['host']], capture_output=True, text=True, check=True)
        line = pinned_line(scan.stdout, cfg['host'], args.console_fingerprint, cfg['previous_host_fingerprint'])
        with pathlib.Path(cfg['known_hosts']).open('x') as f: f.write(line)
        pathlib.Path(cfg['known_hosts']).chmod(0o600)
        print('NEW HOST KEY PINNED against console fingerprint. Old known-hosts unchanged.'); return
    # Confirm actual root/OS/machine identity before every target mutation.
    probe = 'python3 -c ' + shlex.quote("import os,pathlib,json;print(json.dumps({'uid':os.getuid(),'machine_id':pathlib.Path('/etc/machine-id').read_text().strip(),'os':pathlib.Path('/etc/os-release').read_text(),'arch':os.uname().machine}))")
    state = json.loads(remote(probe, capture_output=True).stdout)
    assert state['uid'] == 0 and state['arch'] == 'x86_64'
    assert state['machine_id'] != cfg['previous_machine_id']
    assert re.search(r'^ID=ubuntu$', state['os'], re.M) and re.search(r'^VERSION_ID="24\.04"$', state['os'], re.M)
    path = shlex.quote(cfg['remote_kit'])
    def verify_remote():
        # The short independent verifier anchors SHA256.json before any kit code.
        code = "import hashlib,json,pathlib; p=pathlib.Path('/root/reinstall-kit'); assert hashlib.sha256((p/'SHA256.json').read_bytes()).hexdigest()==" + repr(cfg['kit_manifest_sha256']) + "; m=json.loads((p/'SHA256.json').read_text()); assert all(hashlib.sha256((p/n).read_bytes()).hexdigest()==h for n,h in m.items())"
        remote('python3 -c ' + shlex.quote(code), stdout=subprocess.DEVNULL)
    if args.step == 'transfer':
        remote('umask 077; mkdir ' + path)
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode='w') as archive:
            for source in sorted(kit.iterdir()):
                assert source.is_file() and not source.is_symlink()
                archive.add(source, arcname=source.name, recursive=False)
        remote('tar -xf - -C ' + path, input=buffer.getvalue())
        verify_remote(); print('PUBLIC KIT TRANSFER PASS. No private environment copied.'); return
    verify_remote()
    if args.step == 'install':
        remote('python3 ' + path + '/install.py ' + path + ' --fresh-machine-id ' + shlex.quote(state['machine_id'])); return
    if args.step in ['media', 'environment']:
        file = cfg['media_archive'] if args.step == 'media' else cfg['environment_archive']
        receipt = archive_verify(file)
        if args.step == 'media':
            assert receipt['encryptedSha256'] == cfg['media_encrypted_sha256']; command = 'python3 ' + path + '/restore-media.py ' + path
        else:
            assert receipt['plaintextSha256'] == cfg['environment_plaintext_sha256']
            command = 'python3 ' + path + '/restore-env.py ' + path + ' --expected-env-sha256 ' + cfg['environment_plaintext_sha256']
        source = subprocess.Popen([cfg['node'], cfg['decoder'], 'decrypt', cfg['key'], file], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try: remote(command, stdin=source.stdout)
        finally:
            source.stdout.close(); source.stderr.read(); assert source.wait() == 0
        return
    if args.step == 'deploy':
        remote('python3 ' + path + '/deploy.py ' + path + ' --activate-new-host'); return
    if args.step == 'health': remote('python3 ' + path + '/health.py ' + path + ' --origin ' + shlex.quote('https://' + cfg['domain']))


if __name__ == '__main__':
    try: main()
    except Exception:
        raise SystemExit('Operator step stopped. Preserve state and receipts; do not automatically rerun.')
