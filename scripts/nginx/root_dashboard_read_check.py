"""Single-use root CHECK only. No APPLY, reload, service mutation or recovery.

Deployment identity belongs exclusively in the reviewed DEPLOYMENT.json. All
configuration bytes, diffs and command diagnostics remain in the root workspace.
"""
import argparse
import base64
import copy
import datetime
import difflib
import glob
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import stat
import subprocess
import sys
import traceback
import urllib.request

SAFE_FAILURES = frozenset({
    'ROOT_REQUIRED', 'ROOT_WORKSPACE', 'PRIVATE_FILE_METADATA', 'PRIVATE_FILE_CHANGED',
    'MANIFEST_HASH', 'MANIFEST_SCOPE', 'BUNDLE_PATH', 'BUNDLE_HASH', 'BUNDLE_FILE_SET',
    'APPROVED_POLICY_HASH', 'POLICY_SOURCE_BINDING', 'ACCEPTED_RECEIPT_HASH',
    'ACCEPTED_RECEIPT_ACKNOWLEDGEMENT', 'ACCEPTED_MAIN_IDENTITY', 'LEGACY_MAIN_BINDING',
    'DEPLOYMENT_DERIVATION', 'ATTESTED_CONFIGURATION_COUNT', 'FROZEN_WORKSPACE',
    'FROZEN_MANIFEST_HASH', 'FROZEN_FILE_NAME', 'FROZEN_BUNDLE_HASH', 'FROZEN_DEPLOYMENT_HASH',
    'UNSUPPORTED_INCLUDE', 'EXACT_INCLUDE_MISSING', 'INCLUDE_NOT_IN_REVIEWED_INDEX',
    'HTTP_CONTEXT', 'INHERITED_FRONTEND_CONTEXT', 'APPROVED_ROUTE_COUNTS', 'NON_API_POLICY_CHANGED',
    'NGINX_BUILD_PREFIX', 'SHADOW_INCLUDE_COVERAGE', 'RUNTIME_TREE_ROOT', 'RUNTIME_FILE_OWNER',
    'RUNTIME_FILE_TYPE', 'RUNTIME_TREE_DRIFT', 'RUNTIME_STATE', 'NGINX_STATE',
    'RUNTIME_PRIVATE_FILE_DRIFT', 'RUNTIME_RECEIPT_BINDING', 'RELEASE_LINK_DRIFT',
    'RUNTIME_PROCESS_BINDING', 'RUNTIME_UNIT_DRIFT', 'LOOPBACK_LISTENER', 'LOOPBACK_READ_STATUS',
    'LOOPBACK_READ_SIZE', 'PAYMENT_CAPABILITY_DRIFT', 'COMMERCE_SETTING_DRIFT', 'COMMAND_SCOPE',
    'PRIVATE_COMMAND_FAILED', 'RUNTIME_INVENTORY_HASH', 'CONFIGURATION_INDEX', 'CONFIGURATION_COUNT',
    'CONFIGURATION_PATH', 'CONFIGURATION_CHANGED_DURING_READ', 'UNREVIEWED_CONFIGURATION',
    'CONFIGURATION_HASH_OR_METADATA_DRIFT', 'CONFIGURATION_NOT_REGULAR', 'CONFIGURATION_MISSING',
    'MAIN_SECURITY_BINDING', 'MAIN_SOURCE_DRIFT', 'MAIN_TARGET_DRIFT', 'MAIN_SYMLINK_DRIFT',
    'MAIN_XATTR_DRIFT', 'POST_CHECK_DRIFT', 'SOURCE_HASH_MISMATCH', 'ACCEPTED_GUARD_DRIFT',
    'NGINX_PID_DIRECTIVE', 'NGINX_PID_METADATA', 'NGINX_PID_IDENTITY', 'NGINX_ENTRY_HASH',
    'ACCEPTED_METHOD_MAP_DRIFT', 'ACCEPTED_ROUTE_DRIFT', 'ACCEPTED_API_DENY_DRIFT',
    'ACCEPTED_PROXY_BODY', 'ACCEPTED_HEADERS_DRIFT', 'ACCEPTED_UUID_DRIFT', 'READ_POLICY_ALREADY_PRESENT',
})


def digest(raw):
    return hashlib.sha256(raw.encode() if isinstance(raw, str) else raw).hexdigest()


def require(value, code):
    if not value:
        raise ValueError(code)


def private_read(path, uid=0, mode=0o600, limit=16 * 1024 * 1024):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        before = os.fstat(stream.fileno())
        require(stat.S_ISREG(before.st_mode) and before.st_uid == uid
                and stat.S_IMODE(before.st_mode) == mode and before.st_size <= limit, 'PRIVATE_FILE_METADATA')
        raw = stream.read(limit + 1)
        after = os.fstat(stream.fileno())
        require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns)
                == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns)
                and len(raw) <= limit, 'PRIVATE_FILE_CHANGED')
    return raw


def validate_files(root, manifest_hash):
    raw = private_read(root / 'MANIFEST.json')
    require(digest(raw) == manifest_hash, 'MANIFEST_HASH')
    manifest = json.loads(raw)
    require(manifest['format'] == 1 and manifest['scope'] == 'ADM-01 approved dashboard reads CHECK only', 'MANIFEST_SCOPE')
    for name, expected in manifest['files'].items():
        require(PurePosixPath(name).name == name and name not in ('.', '..'), 'BUNDLE_PATH')
        require(digest(private_read(root / name)) == expected, 'BUNDLE_HASH')
    require(set(manifest['files']) == {'DEPLOYMENT.json', 'CHECK-PLAN.json', 'APPLY-ROLLBACK-PLAN.json',
            'root_dashboard_read_check.py', 'dashboard_access.py', 'dashboard_read_policy.json',
            'config_parser.py', 'private_config.py', 'atomic_config.py'}, 'BUNDLE_FILE_SET')
    spec = json.loads(private_read(root / 'DEPLOYMENT.json'))
    require(spec['format'] == 1 and root.parent == Path(spec['workspace_parent'])
            and root.parent.resolve() == root.parent, 'ROOT_WORKSPACE')
    require(digest(private_read(root / 'dashboard_read_policy.json')) == spec['policy_sha256'], 'APPROVED_POLICY_HASH')
    require(manifest['approved_policy_source_commit'] == spec['approved_policy_source_commit'], 'POLICY_SOURCE_BINDING')
    return spec


def accepted_deployment(spec, legacy, receipt_raw):
    """Derive only the accepted POST-ADM main identity; never rebase peers."""
    evidence = spec['accepted_ingress']
    require(digest(receipt_raw) == evidence['apply_receipt_sha256'], 'ACCEPTED_RECEIPT_HASH')
    receipt = json.loads(receipt_raw)
    require(receipt.get('result') == 'PASS' and receipt.get('mode') == 'apply'
            and receipt.get('manifest_sha256') == evidence['manifest_sha256']
            and receipt.get('replacement') == 'replacement-acknowledged'
            and receipt.get('reload') == 'acknowledged'
            and receipt.get('live_configuration_changes') == 1, 'ACCEPTED_RECEIPT_ACKNOWLEDGEMENT')
    require(receipt.get('candidate_sha256') == evidence['main_sha256']
            and type(receipt.get('candidate_bytes')) is int
            and 0 < receipt['candidate_bytes'] < 16000000, 'ACCEPTED_MAIN_IDENTITY')
    expected = copy.deepcopy(legacy)
    main = [r for r in expected['protected_configurations'] if r['file_id'] == digest(expected['main_path'])]
    require(len(main) == 1 and main[0]['sha256'] == expected['routing']['source_sha256'], 'LEGACY_MAIN_BINDING')
    expected['routing']['source_sha256'] = evidence['main_sha256']
    main[0].update(sha256=evidence['main_sha256'], bytes=None)
    require(expected == spec['current_deployment'], 'DEPLOYMENT_DERIVATION')
    require(len(expected['protected_configurations']) == evidence['loaded_configurations']
            and evidence['unchanged_peers'] == evidence['loaded_configurations'] - 1, 'ATTESTED_CONFIGURATION_COUNT')
    main[0]['bytes'] = receipt['candidate_bytes']
    return expected


def read_legacy(spec):
    evidence = spec['accepted_ingress']
    root = Path(evidence['frozen_bundle'])
    info = root.lstat()
    require(root.resolve() == root and stat.S_ISDIR(info.st_mode) and info.st_uid == 0
            and stat.S_IMODE(info.st_mode) == 0o700, 'FROZEN_WORKSPACE')
    raw = private_read(root / 'MANIFEST.json')
    require(digest(raw) == evidence['manifest_sha256'], 'FROZEN_MANIFEST_HASH')
    manifest = json.loads(raw)
    for name, expected in manifest['files'].items():
        require(PurePosixPath(name).name == name, 'FROZEN_FILE_NAME')
        require(digest(private_read(root / name)) == expected, 'FROZEN_BUNDLE_HASH')
    deployment_raw = private_read(root / 'DEPLOYMENT.json')
    require(digest(deployment_raw) == manifest['deployment_sha256'], 'FROZEN_DEPLOYMENT_HASH')
    # No historical operator/helper is imported or executed.
    return accepted_deployment(spec, json.loads(deployment_raw), private_read(root / 'apply-PASS.private.json'))


def inherited_headers(contents, deployment, parse, validate_binding):
    """Resolve loaded HTTP/server includes for the accepted, already-open host."""
    prefix = Path(deployment['config_prefix'])
    def direct(nodes, filename, stack):
        for node in nodes:
            if node['name'] != 'include':
                yield node, filename
                continue
            require(len(node['args']) == 1 and '$' not in node['args'][0], 'UNSUPPORTED_INCLUDE')
            pattern = node['args'][0]
            matches = sorted(glob.glob(pattern if pattern.startswith('/') else str(prefix / pattern)))
            require(matches or glob.has_magic(pattern), 'EXACT_INCLUDE_MISSING')
            for path in matches:
                require(path in contents and path not in stack, 'INCLUDE_NOT_IN_REVIEWED_INDEX')
                yield from direct(parse(contents[path]), path, stack + [path])
    entry = deployment['nginx_entry']
    http = [n for n in parse(contents[entry]) if n['name'] == 'http']
    require(len(http) == 1, 'HTTP_CONTEXT')
    entries = list(direct(http[0]['children'], entry, [entry]))
    host = validate_binding(deployment['routing'])[0]
    fronts = [(node, filename) for node, filename in entries
              if node['name'] == 'server' and filename == deployment['main_path']
              and any(c['name'] == 'server_name' and host in c['args'] for c in node['children'])
              and any(c['name'] == 'location' and c['args'] == ['/'] for c in node['children'])]
    require(len(fronts) == 1, 'INHERITED_FRONTEND_CONTEXT')
    server, filename = fronts[0]
    headers = [(n, p) for n, p in direct(server['children'], filename, [entry, filename]) if n['name'] == 'add_header']
    if not headers:
        headers = [(n, p) for n, p in entries if n['name'] == 'add_header']
    return [contents[p][n['start']:n['end']] for n, p in headers]


def non_api_projection(text, parse):
    def project(nodes):
        result = []
        for node in nodes:
            if node['name'] == 'location' and node['args'] and (
                    node['args'][-1].startswith('/api/') or node['args'][-1].startswith('^/api/')):
                continue
            result.append((node['name'], node['args'], project(node['children']) if node['children']
                           else text[node['start']:node['end']]))
        return result
    return project(parse(text))


def prepare_shadow(contents, deployment, root, command, parse, render_reads, validate_binding, shadow_tree, loaded_names):
    original = contents[deployment['main_path']]
    headers = inherited_headers(contents, deployment, parse, validate_binding)
    candidate, result = render_reads(original, deployment['routing'], headers)
    require(result['approved_reads'] == 70 and result['held_reads'] == 10, 'APPROVED_ROUTE_COUNTS')
    require(non_api_projection(original, parse) == non_api_projection(candidate, parse), 'NON_API_POLICY_CHANGED')
    clones = shadow_tree(contents, candidate, deployment['main_path'], root / 'check-shadow', parse,
                         config_prefix=Path(deployment['config_prefix']))
    version = command([deployment['nginx'], '-V'], 'nginx-version')
    match = re.search(r'^configure arguments:\s*(.*)$', version.stderr.decode(), re.M)
    require(match is not None, 'NGINX_BUILD_PREFIX')
    prefixes = [p.split('=', 1)[1] for p in shlex.split(match[1]) if p.startswith('--prefix=')]
    require(len(prefixes) <= 1, 'NGINX_BUILD_PREFIX')
    prefix = prefixes[0] if prefixes else '/usr/local/nginx'
    require(prefix.startswith('/'), 'NGINX_BUILD_PREFIX')
    shadow = command([deployment['nginx'], '-T', '-p', prefix, '-c', str(clones[deployment['nginx_entry']])], 'full-shadow')
    require(set(loaded_names(shadow.stdout)) == set(map(str, clones.values())), 'SHADOW_INCLUDE_COVERAGE')
    return candidate, result


def verify_tree(directory, expected, uid):
    require(directory.resolve() == directory and directory.stat().st_uid == uid, 'RUNTIME_TREE_ROOT')
    actual = {}
    for path in sorted(directory.rglob('*')):
        info = path.lstat()
        require(info.st_uid == uid, 'RUNTIME_FILE_OWNER')
        name = str(path.relative_to(directory))
        if stat.S_ISLNK(info.st_mode):
            actual[name] = dict(type='link', target=os.readlink(path))
        elif stat.S_ISDIR(info.st_mode):
            actual[name] = dict(type='directory', mode=stat.S_IMODE(info.st_mode))
        else:
            require(stat.S_ISREG(info.st_mode), 'RUNTIME_FILE_TYPE')
            actual[name] = dict(type='file', mode=stat.S_IMODE(info.st_mode), bytes=info.st_size, sha256=digest(path.read_bytes()))
    require(actual == expected, 'RUNTIME_TREE_DRIFT')


def runtime_state(deployment, command):
    runtime = deployment['runtime']
    def properties(unit):
        raw = command([deployment['systemctl'], 'show', unit, '--property=ActiveState,SubState,MainPID,NRestarts,Restart,User,Group'], 'service-state').stdout
        return dict(line.split('=', 1) for line in raw.decode().splitlines() if '=' in line)
    app, nginx = properties(runtime['unit']), properties(deployment['nginx_unit'])
    require(app.get('ActiveState') == 'active' and app.get('SubState') == 'running'
            and app.get('MainPID') == str(runtime['expected_pid']) and app.get('NRestarts') == '0'
            and app.get('Restart') == 'no' and app.get('User') == runtime['user'], 'RUNTIME_STATE')
    require(nginx.get('ActiveState') == 'active' and nginx.get('SubState') == 'running', 'NGINX_STATE')
    for path, expected, uid in [(runtime['start_receipt'], runtime['start_receipt_sha256'], runtime['uid']),
                                (runtime['environment'], runtime['environment_sha256'], runtime['uid'])]:
        require(digest(private_read(Path(path), uid)) == expected, 'RUNTIME_PRIVATE_FILE_DRIFT')
    receipt = json.loads(private_read(Path(runtime['start_receipt']), runtime['uid']))
    require(receipt.get('result') == 'PASS' and receipt.get('project_ref') == deployment['production_project_ref']
            and receipt.get('plan_sha256') == deployment['accepted_launch_plan_sha256'], 'RUNTIME_RECEIPT_BINDING')
    require(Path(runtime['current_link']).is_symlink() and str(Path(runtime['current_link']).resolve()) == runtime['release'], 'RELEASE_LINK_DRIFT')
    pid = str(runtime['expected_pid'])
    require(os.readlink('/proc/' + pid + '/cwd') == runtime['release']
            and os.readlink('/proc/' + pid + '/exe') == runtime['node'], 'RUNTIME_PROCESS_BINDING')
    require(digest(Path(runtime['unit_path']).read_bytes()) == runtime['unit_sha256']
            and Path(runtime['retry_dropin']).read_bytes() == b'[Service]\nRestart=no\n', 'RUNTIME_UNIT_DRIFT')
    listeners = command([deployment['ss'], '-lntp'], 'listeners').stdout.decode()
    lines = [line for line in listeners.splitlines() if re.search(':' + str(runtime['port']) + r'\s', line)]
    require(len(lines) == 1 and '127.0.0.1:' + str(runtime['port']) in lines[0] and 'pid=' + pid + ',' in lines[0], 'LOOPBACK_LISTENER')
    return dict(application=app, nginx=nginx)


def disabled_commerce(deployment, validate_binding):
    """Two bounded loopback GETs only. No hosted Auth/provider/session request."""
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args):
            return None
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    host = validate_binding(deployment['routing'])[0]
    def read(path):
        request = urllib.request.Request(deployment['routing']['runtime_upstream'] + path, headers={'Host': host})
        with opener.open(request, timeout=15) as response:
            require(response.status == 200, 'LOOPBACK_READ_STATUS')
            raw = response.read(4000001)
            require(len(raw) <= 4000000, 'LOOPBACK_READ_SIZE')
            return json.loads(raw)
    capability = read('/api/payments/capabilities')
    require(capability.get('card', {}).get('available') is False and capability.get('express') == [], 'PAYMENT_CAPABILITY_DRIFT')
    settings = read('/api/storefront/content')[0]['data']
    require(all(settings.get(k) is False for k in deployment['disabled_setting_keys']), 'COMMERCE_SETTING_DRIFT')


def command_allowed(argv, deployment, root):
    if argv in ([deployment['nginx'], '-T'], [deployment['nginx'], '-V'], [deployment['ss'], '-lntp']):
        return True
    if len(argv) == 6 and argv[:2] == [deployment['nginx'], '-T'] and argv[2] == '-p' and argv[4] == '-c':
        return (argv[3].startswith('/') and str(Path(argv[5]).resolve()).startswith(str(root / 'check-shadow') + '/')
                and Path(argv[5]).name == Path(deployment['nginx_entry']).name)
    return (len(argv) == 4 and argv[:2] == [deployment['systemctl'], 'show']
            and argv[2] in (deployment['runtime']['unit'], deployment['nginx_unit'])
            and argv[3] == '--property=ActiveState,SubState,MainPID,NRestarts,Restart,User,Group')


def nginx_pid_snapshot(entry, expected_pid, parse, uid=0):
    # Nginx -T opens its configured pid file even without starting a process.
    # Require the existing live PID before syntax testing; never create it.
    nodes = [n for n in parse(entry) if n['name'] == 'pid']
    require(len(nodes) == 1 and len(nodes[0]['args']) == 1
            and nodes[0]['args'][0].startswith('/') and '$' not in nodes[0]['args'][0], 'NGINX_PID_DIRECTIVE')
    fd = os.open(nodes[0]['args'][0], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_uid == uid and info.st_size <= 64
                and not stat.S_IMODE(info.st_mode) & 0o022, 'NGINX_PID_METADATA')
        raw = stream.read(65)
        after = os.fstat(stream.fileno())
        stable = lambda value: (value.st_dev, value.st_ino, value.st_size, value.st_uid, value.st_gid,
                                value.st_mode, value.st_mtime_ns, value.st_ctime_ns)
        require(raw.strip() == str(expected_pid).encode() and stable(info) == stable(after), 'NGINX_PID_IDENTITY')
        return (info.st_dev, info.st_ino, info.st_size, info.st_uid, info.st_gid,
                stat.S_IMODE(info.st_mode), info.st_mtime_ns, digest(raw))


def main():
    parser = argparse.ArgumentParser(description='CHECK only; no APPLY or rollback entry point.')
    parser.add_argument('--manifest-sha256', required=True)
    args = parser.parse_args()
    require(os.geteuid() == 0, 'ROOT_REQUIRED')
    os.umask(0o077)
    root = Path(__file__).absolute().parent
    info = root.lstat()
    require(root.resolve() == root and Path.cwd() == root and info.st_uid == 0
            and stat.S_ISDIR(info.st_mode) and stat.S_IMODE(info.st_mode) == 0o700, 'ROOT_WORKSPACE')
    spec = validate_files(root, args.manifest_sha256)
    # Imports occur only after all root-owned source bytes are hash verified.
    sys.path.insert(0, str(root))
    from config_parser import parse
    from dashboard_access import render_reads, validate_binding
    from private_config import private_write, read_baseline, loaded_names, shadow_tree
    from atomic_config import capture, assert_unchanged, recovery_metadata
    private_write(root / 'CHECK-STARTED.private.json', json.dumps(dict(started_utc=datetime.datetime.now(datetime.timezone.utc).isoformat())) + '\n')
    counter = 0
    def command(argv, label):
        nonlocal counter
        # No service action, process signal, arbitrary shell or historical operator.
        require(command_allowed(argv, spec['current_deployment'], root), 'COMMAND_SCOPE')
        counter += 1
        result = subprocess.run(argv, capture_output=True, timeout=45)
        private_write(root / (str(counter) + '-' + label + '.stdout.private'), result.stdout)
        private_write(root / (str(counter) + '-' + label + '.stderr.private'), result.stderr)
        require(result.returncode == 0, 'PRIVATE_COMMAND_FAILED')
        return result
    deployment = read_legacy(spec)
    validate_binding(deployment['routing'])
    before_runtime = runtime_state(deployment, command)
    raw_inventory = private_read(Path(deployment['runtime']['inventory']), deployment['runtime']['uid'])
    require(digest(raw_inventory) == deployment['runtime']['inventory_sha256'], 'RUNTIME_INVENTORY_HASH')
    inventory = json.loads(raw_inventory)
    for name, path in [('release', 'release'), ('node', 'node_directory')]:
        verify_tree(Path(deployment['runtime'][path]), inventory[name], deployment['runtime']['uid'])
    disabled_commerce(deployment, validate_binding)
    entry_raw = Path(deployment['nginx_entry']).read_bytes()
    entry_row = next(row for row in deployment['protected_configurations'] if row['file_id'] == digest(deployment['nginx_entry']))
    require(digest(entry_raw) == entry_row['sha256'], 'NGINX_ENTRY_HASH')
    before_pid = nginx_pid_snapshot(entry_raw.decode(), before_runtime['nginx']['MainPID'], parse)
    dump = command([deployment['nginx'], '-T'], 'accepted-live-index')
    contents, metadata = read_baseline(loaded_names(dump.stdout), deployment)
    require(deployment['main_path'] in contents and deployment['nginx_entry'] in contents, 'CONFIGURATION_INDEX')
    snapshot = capture(deployment['main_path'], deployment['routing']['source_sha256'])
    preserved = json.loads(private_read(Path(deployment['previous_activation_workspace']) / 'main.before.metadata.json'))
    require(str(snapshot['resolved']) == preserved['resolved_path'] and snapshot['link'] == preserved['symlink_target']
            and list(snapshot['metadata'][3:6]) == preserved['stat_fingerprint'][3:6]
            and {k:base64.b64encode(v).decode() for k,v in snapshot['attrs'].items()} == preserved['xattrs_base64'], 'MAIN_SECURITY_BINDING')
    candidate, rendered = prepare_shadow(contents, deployment, root, command, parse, render_reads, validate_binding, shadow_tree, loaded_names)
    # Recheck the same accepted preimage after shadow validation; not a second
    # invocation of the successful historical attestation/helper.
    assert_unchanged(snapshot)
    fresh = command([deployment['nginx'], '-T'], 'final-live-index')
    _, final_metadata = read_baseline(loaded_names(fresh.stdout), deployment)
    require(metadata == final_metadata and runtime_state(deployment, command) == before_runtime
            and nginx_pid_snapshot(entry_raw.decode(), before_runtime['nginx']['MainPID'], parse) == before_pid, 'POST_CHECK_DRIFT')
    disabled_commerce(deployment, validate_binding)
    private_write(root / 'accepted.before.conf', contents[deployment['main_path']])
    private_write(root / 'accepted.before.metadata.private.json', json.dumps(recovery_metadata(snapshot), indent=2) + '\n')
    private_write(root / 'checked.candidate.conf', candidate)
    private_write(root / 'checked.diff.private.txt', ''.join(difflib.unified_diff(contents[deployment['main_path']].splitlines(True), candidate.splitlines(True), fromfile='accepted-main', tofile='candidate-main')))
    report = dict(result='PASS', mode='CHECK', manifest_sha256=args.manifest_sha256,
                  deployment_sha256=digest(private_read(root / 'DEPLOYMENT.json')),
                  preimage_sha256=deployment['routing']['source_sha256'], candidate_sha256=digest(candidate),
                  candidate_bytes=len(candidate.encode()), policy_sha256=spec['policy_sha256'],
                  approved_get_patterns=rendered['approved_reads'], held_get_patterns=rendered['held_reads'],
                  loaded_configurations=len(contents), unchanged_peers=len(contents)-1,
                  complete_private_shadow_validation='PASS', non_api_policy_unchanged=True,
                  runtime_unchanged=True, live_configuration_changes=0, nginx_reloads=0,
                  nginx_pid_unchanged=True,
                  service_operations=0, application_candidate_transfers=0, configuration_exported=False,
                  automatic_retry=False, automatic_rollback=False, activation_authorized=False,
                  checked_at_utc=datetime.datetime.now(datetime.timezone.utc).isoformat())
    private_write(root / 'CHECK-PASS.private.json', json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Never export command output, configuration, exception text or traceback.
        root = Path(__file__).absolute().parent
        if os.geteuid() == 0 and root.resolve() == root and root.stat().st_uid == 0 and stat.S_IMODE(root.stat().st_mode) == 0o700:
            try:
                fd = os.open(root / ('STOP-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%f') + '.private.txt'), os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
                with os.fdopen(fd, 'w') as stream:
                    stream.write(traceback.format_exc())
            except Exception:
                pass
        code = error.args[0] if error.args and isinstance(error.args[0], str) and error.args[0] in SAFE_FAILURES else 'PRIVATE_CHECK_FAILED'
        print(json.dumps(dict(result='BLOCKED', mode='CHECK', failing_check=code,
                              exception_type=type(error).__name__, live_configuration_changes=0, nginx_reloads=0,
                              service_operations=0, configuration_exported=False, retry=False, rollback=False)))
        sys.exit(1)
