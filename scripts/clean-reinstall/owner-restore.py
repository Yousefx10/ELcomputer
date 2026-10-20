#!/usr/bin/env python3
"""Future operator steps against a newly reinstalled, independently pinned host.

No step is run by preparation. 'verify' is local only; other steps are separate
explicit commands after approved erasure. No SQL, migrations or Auth reset.
"""
import argparse
import base64
import datetime
import hashlib
import importlib.util
import io
import json
import os
import pathlib
import re
import shlex
import signal
import subprocess
import tarfile
import tempfile
import time
import uuid


def bounded_process(command, timeout, source=None, on_line=None):
    """Poll the child, not pipe EOF: descendants must not prolong collection."""
    with tempfile.TemporaryFile() as output, tempfile.TemporaryFile() as errors, tempfile.TemporaryFile() as intake:
        if source is not None: intake.write(source); intake.seek(0)
        child = subprocess.Popen(command, stdin=intake if source is not None else subprocess.DEVNULL,
                                 stdout=output, stderr=errors, start_new_session=True, close_fds=True)
        started = time.monotonic(); offset = 0; data = b''; pending = b''
        def drain():
            nonlocal offset, data, pending
            while True:
                chunk = os.pread(output.fileno(), 65536, offset)
                if not chunk: break
                offset += len(chunk); data += chunk; pending += chunk
                if offset > 2 * 1024 * 1024: raise RuntimeError('SSH output limit exceeded')
                while b'\n' in pending:
                    line, pending = pending.split(b'\n', 1)
                    if on_line: on_line(line.decode('utf-8'))
        try:
            while True:
                drain()
                status = child.poll()
                if status is not None:
                    drain()
                    if pending and on_line: on_line(pending.decode('utf-8'))
                    return subprocess.CompletedProcess(command, status, data, os.pread(errors.fileno(), 65536, 0))
                if time.monotonic() - started >= timeout: raise TimeoutError('SSH command deadline exceeded')
                time.sleep(.1)
        finally:
            # A child can exit while a descendant still owns its output descriptors.
            try: os.killpg(child.pid, signal.SIGTERM)
            except ProcessLookupError: pass
            if child.poll() is None:
                try: child.wait(timeout=2)
                except subprocess.TimeoutExpired: pass
            try: os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError: pass
            child.wait(timeout=2)


def target_probe():
    return 'python3 -c ' + shlex.quote("import os,pathlib,json;print(json.dumps({'uid':os.getuid(),'machine_id':pathlib.Path('/etc/machine-id').read_text().strip(),'os':pathlib.Path('/etc/os-release').read_text(),'arch':os.uname().machine}))")


def validate_target(state, cfg):
    assert state['uid'] == 0 and state['arch'] == 'x86_64'
    assert state['machine_id'] != cfg['previous_machine_id']
    assert re.search(r'^ID=ubuntu$', state['os'], re.M) and re.search(r'^VERSION_ID="24\.04"$', state['os'], re.M)


def kit_verification_code(cfg):
    return "import hashlib,json,pathlib; p=pathlib.Path('/root/reinstall-kit'); assert hashlib.sha256((p/'SHA256.json').read_bytes()).hexdigest()==" + repr(cfg['kit_manifest_sha256']) + "; m=json.loads((p/'SHA256.json').read_text()); assert all(hashlib.sha256((p/n).read_bytes()).hexdigest()==h for n,h in m.items())"


def run_health(cfg, kit, ssh, binding):
    """Stream this revision's health checker without changing the sealed VPS kit."""
    directory = pathlib.Path(binding).resolve().parent / 'health-results'
    directory.mkdir(mode=0o700, exist_ok=True)
    receipt = directory / ('health-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + uuid.uuid4().hex[:8] + '.json')
    record = {'result': 'RUNNING', 'phase': 'target_identity', 'kit_manifest_sha256': cfg['kit_manifest_sha256'],
              'started_utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    source = pathlib.Path(__file__).with_name('health.py').read_bytes()
    record['health_script_sha256'] = hashlib.sha256(source).hexdigest()
    ssh = ssh[:1] + ['-o', 'ServerAliveInterval=10', '-o', 'ServerAliveCountMax=3',
                    '-o', 'ControlMaster=no', '-o', 'ControlPath=none', '-o', 'ClearAllForwardings=yes',
                    '-o', 'StdinNull=no'] + ssh[1:]
    def emit(value): print(json.dumps(value), flush=True)
    def remote(command, timeout=30, **options):
        result = bounded_process(ssh + [command], timeout, **options)
        if result.returncode:
            detail = record.get('remote_result', {})
            raise RuntimeError(record['phase'] + ': SSH exited ' + str(result.returncode) +
                               (': ' + detail.get('error', 'Health failure') + ': ' + detail.get('detail', '') if detail.get('result') == 'FAIL' else ''))
        return result.stdout
    with receipt.open('x') as saved:
        os.fchmod(saved.fileno(), 0o600)
        def persist():
            saved.seek(0); json.dump(record, saved, indent=2); saved.write('\n'); saved.truncate(); saved.flush(); os.fsync(saved.fileno())
        persist()
        try:
            emit({'event': 'phase', 'phase': record['phase'], 'receipt': str(receipt)})
            validate_target(json.loads(remote(target_probe())), cfg)
            record['phase'] = 'sealed_kit'; persist(); emit({'event': 'phase', 'phase': record['phase']})
            remote('python3 -c ' + shlex.quote(kit_verification_code(cfg)))
            record['phase'] = 'http_health'; persist(); emit({'event': 'phase', 'phase': record['phase'], 'deadline_seconds': 900})
            results = []
            def event(line):
                value = json.loads(line)
                if value.get('event') == 'progress':
                    record['last_progress'] = value; persist(); emit(value)
                elif value.get('result') in ['PASS', 'FAIL']:
                    results.append(value); record['remote_result'] = value
                else: raise RuntimeError('Unexpected health output')
            command = 'python3 -u - ' + shlex.quote(cfg['remote_kit']) + ' --origin ' + shlex.quote('https://' + cfg['domain']) + ' --timeout 900'
            remote(command, timeout=915, source=source, on_line=event)
            if len(results) != 1 or results[0]['result'] != 'PASS': raise RuntimeError('Missing successful final health result')
            mapping = json.loads((kit / 'legacy-urls.json').read_text()); media = json.loads((kit / 'media-manifest.json').read_text())
            redirects = 2 * (len(mapping['paths']) + 2 * len(mapping['query_ids']))
            total = 40 + len(media) + redirects + len(mapping['held_paths']) + len(mapping['held_ids'])
            assert results[0]['http_checks'] == total and results[0]['redirect_cases'] == redirects and results[0]['media_files'] == len(media)
            record['result'] = 'PASS'; record['phase'] = 'complete'
        except (Exception, KeyboardInterrupt) as error:
            record.update(result='FAIL', error=type(error).__name__, detail=str(error))
        record['completed_utc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        persist()
    emit({'result': record['result'], 'phase': record['phase'], 'receipt': str(receipt), **({'error': record['error'], 'detail': record['detail']} if record['result'] == 'FAIL' else record['remote_result'])})
    return 0 if record['result'] == 'PASS' else 1


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
    if args.step == 'health': return run_health(cfg, kit, ssh, args.binding)
    # Confirm actual root/OS/machine identity before every target mutation.
    state = json.loads(remote(target_probe(), capture_output=True).stdout)
    validate_target(state, cfg)
    path = shlex.quote(cfg['remote_kit'])
    def verify_remote():
        # The short independent verifier anchors SHA256.json before any kit code.
        code = kit_verification_code(cfg)
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


if __name__ == '__main__':
    try: raise SystemExit(main())
    except (Exception, KeyboardInterrupt) as error:
        print(json.dumps({'result': 'FAIL', 'error': type(error).__name__, 'detail': 'Operator step stopped. Preserve state and receipts; do not automatically rerun.'}), flush=True)
        raise SystemExit(1)
