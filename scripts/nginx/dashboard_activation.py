"""Exact-candidate activation machinery. Deployment identities live in BINDING.json.

No historical operator main is invoked. Production entry requires a verified
package, private evidence, fresh owner-bound controls and explicit authorization.
Tests inject command/runtime transports and mutate only disposable fixtures.
"""
import base64
import copy
import datetime as dt
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import shlex
import stat
import subprocess
import time
import urllib.parse


class GateError(Exception):
    pass


def require(value, code):
    if not value:
        raise GateError(code)


def digest(raw):
    return hashlib.sha256(raw.encode() if isinstance(raw, str) else raw).hexdigest()


def encoded(value):
    return (json.dumps(value, sort_keys=True, indent=2) + '\n').encode()


def utc():
    return dt.datetime.now(dt.timezone.utc)


def instant(value):
    parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(parsed.tzinfo is not None, 'TIMEZONE_REQUIRED')
    return parsed


def fresh(value, now, age):
    require(0 <= (now - instant(value)).total_seconds() <= age, 'STALE_STATE')


def durable_new(path, raw):
    if not isinstance(raw, bytes):
        raw = encoded(raw)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    parent = os.open(Path(path).parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(parent)
    finally:
        os.close(parent)
    return digest(raw)


def secured_file(path, uid=0):
    """Read an existing OS artifact, recording symlink/security/content identity."""
    path = Path(path)
    before = path.lstat()
    target = path.resolve(strict=True)
    link = os.readlink(path) if path.is_symlink() else None
    fd = os.open(target, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | getattr(os, 'O_NOATIME', 0))
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_uid == uid
                and not stat.S_IMODE(info.st_mode) & 0o022 and info.st_nlink == 1
                and info.st_size <= 128 * 1024 * 1024, 'OS_FILE_SECURITY')
        raw = stream.read(info.st_size + 1)
        attrs = {n: base64.b64encode(os.getxattr(target, n)).decode() for n in os.listxattr(target)}
        after = os.fstat(stream.fileno())
    from prepare_dashboard_read_activation import signature
    require(signature(info) == signature(after) == signature(target.stat())
            and signature(before) == signature(path.lstat())
            and path.resolve(strict=True) == target and len(raw) == info.st_size, 'OS_FILE_DRIFT')
    require(attrs == {n: base64.b64encode(os.getxattr(target, n)).decode() for n in os.listxattr(target)}, 'OS_FILE_DRIFT')
    return dict(path=str(path), resolved_path=str(target), symlink_target=link,
                path_fingerprint=signature(before), target_fingerprint=signature(info),
                sha256=digest(raw), bytes=len(raw), xattrs_base64=attrs)


def process_record(pid, proc=Path('/proc')):
    """PID reuse protection: boot identity and Linux start ticks accompany PID."""
    require(type(pid) is int and pid > 1, 'PROCESS_PID')
    root = proc / str(pid)
    raw = (root / 'stat').read_text()
    end = raw.rfind(')')
    fields = raw[end + 2:].split()
    require(end > 0 and len(fields) >= 20 and fields[0] not in ('Z', 'X'), 'PROCESS_STATE')
    status = dict(line.split(':', 1) for line in (root / 'status').read_text().splitlines() if ':' in line)
    result = dict(pid=pid, ppid=int(fields[1]), start_ticks=int(fields[19]),
                  uid=[int(x) for x in status['Uid'].split()], gid=[int(x) for x in status['Gid'].split()],
                  executable=os.readlink(root / 'exe'), command=(root / 'cmdline').read_bytes().replace(b'\x00', b' ').decode().strip(),
                  cgroup=(root / 'cgroup').read_text())
    again = (root / 'stat').read_text()
    require(int(again[again.rfind(')') + 2:].split()[19]) == result['start_ticks'], 'PROCESS_REUSED')
    return result


def workers(master, proc=Path('/proc')):
    found = []
    for child in proc.iterdir():
        if not child.name.isdecimal() or int(child.name) <= 1:
            continue
        try:
            row = process_record(int(child.name), proc)
        except (FileNotFoundError, ProcessLookupError):
            continue
        except GateError as error:
            if str(error) == 'PROCESS_STATE':
                continue
            raise
        if row['ppid'] == master and row['command'].startswith('nginx: worker process'):
            if 'shutting down' not in row['command']:
                found.append(row)
    require(found, 'NO_NGINX_WORKERS')
    return sorted(found, key=lambda r: r['pid'])


def service_execution(value):
    """Keep configured commands, excluding systemd's last-execution timestamps."""
    return re.findall(r'path=([^;]+);\s*argv\[\]=(.*?);\s*ignore_errors=(yes|no)\s*;', value)


def nginx_build_prefix(version):
    """Resolve the supported no-`-p` service contract from its exact build output."""
    lines = re.findall(r'^configure arguments:[ \t]*([^\r\n]*)$',
                       (version.stdout + b'\n' + version.stderr).decode(), re.M)
    require(len(lines) == 1, 'NGINX_BUILD_ARGUMENTS')
    arguments = shlex.split(lines[0])
    require('--prefix' not in arguments, 'NGINX_BUILD_PREFIX')
    prefixes = [arg[len('--prefix='):] for arg in arguments if arg.startswith('--prefix=')]
    require(len(prefixes) <= 1, 'NGINX_BUILD_PREFIX')
    # NGX_PREFIX defaults to /usr/local/nginx when configure omits --prefix.
    prefix = prefixes[0] if prefixes else '/usr/local/nginx'
    require(prefix and Path(prefix).is_absolute(), 'NGINX_BUILD_PREFIX')
    return Path(prefix)


def nginx_resource_paths(files, config_prefix, version):
    """Match Nginx's separate cycle->prefix and cycle->conf_prefix semantics."""
    import config_parser as parser
    from private_config import walk
    prefix = nginx_build_prefix(version)
    config_prefix = Path(config_prefix)
    require(config_prefix.is_absolute(), 'NGINX_CONFIG_PREFIX')
    resources = set()
    for text in files.values():
        for node in walk(parser.parse(text)):
            if node['name'] in ('load_module', 'ssl_certificate', 'ssl_certificate_key', 'ssl_client_certificate',
                                'ssl_trusted_certificate', 'ssl_dhparam', 'auth_basic_user_file'):
                require(len(node['args']) == 1 and '$' not in node['args'][0], 'UNBOUND_EXTERNAL_RESOURCE')
                value = node['args'][0]
                if value != 'off':
                    base = prefix if node['name'] == 'load_module' else config_prefix
                    resources.add(str(Path(value) if value.startswith('/') else base / value))
    return resources


def runtime_facts(saved, command, uid=0, proc=Path('/proc')):
    import config_parser as parser
    import root_dashboard_read_check as check
    deployment = saved['deployment']
    runtime = deployment['runtime']
    state = check.runtime_state(deployment, command)
    raw = check.private_read(Path(runtime['inventory']), runtime['uid'])
    require(digest(raw) == runtime['inventory_sha256'], 'RUNTIME_INVENTORY')
    inventory = json.loads(raw)
    for kind, key in [('release', 'release'), ('node', 'node_directory')]:
        check.verify_tree(Path(runtime[key]), inventory[kind], runtime['uid'])
    properties = 'Id,LoadState,ActiveState,SubState,MainPID,FragmentPath,DropInPaths,ExecStart,ExecReload,ControlGroup,Type,NeedDaemonReload'
    result = command([deployment['systemctl'], 'show', deployment['nginx_unit'], '--property=' + properties], 'nginx-identity')
    service = dict(line.split('=', 1) for line in result.stdout.decode().splitlines() if '=' in line)
    require(service.get('Id') == deployment['nginx_unit'] and service.get('LoadState') == 'loaded'
            and service.get('ActiveState') == 'active' and service.get('SubState') == 'running'
            and service.get('NeedDaemonReload') == 'no', 'NGINX_SERVICE')
    pid = int(service['MainPID'])
    require(pid == int(state['nginx']['MainPID']), 'NGINX_MASTER')
    master = process_record(pid, proc)
    require(master['uid'] == [uid] * 4 and master['executable'] == str(Path(deployment['nginx']).resolve(strict=True))
            and master['command'].startswith('nginx: master process ')
            and service['ControlGroup'] and any(line.endswith(':' + service['ControlGroup']) for line in master['cgroup'].splitlines()), 'NGINX_MASTER')
    require(digest((proc / str(pid) / 'exe').read_bytes()) == digest(Path(deployment['nginx']).read_bytes()), 'RUNNING_NGINX_BINARY')
    for key in ('ExecStart', 'ExecReload'):
        commands = service_execution(service[key])
        require(len(commands) == 1, 'SERVICE_COMMAND_CONTRACT')
        executable, arguments, ignore_errors = [v.strip() for v in commands[0]]
        base = deployment['nginx']
        global_args = ' -g daemon on; master_process on;'
        starts = {base, base + global_args, base + ' -c ' + deployment['nginx_entry']}
        if key == 'ExecReload':
            require(executable == base and arguments in {base + ' -s reload', base + global_args + ' -s reload'}
                    and ignore_errors == 'no', 'SERVICE_RELOAD_CONTRACT')
        else:
            require(executable == base and arguments in starts and ignore_errors == 'no'
                    and master['command'] == 'nginx: master process ' + arguments, 'SERVICE_START_CONTRACT')
        service[key] = [list(command) for command in commands]
    artifacts = set([deployment['nginx'], deployment['systemctl'], deployment['ss'], service['FragmentPath']])
    artifacts.update(shlex.split(service.get('DropInPaths', '')))
    version = command([deployment['nginx'], '-V'], 'nginx-build')
    artifacts.update(nginx_resource_paths(saved['files'], deployment['config_prefix'], version))
    pid_record = check.nginx_pid_snapshot(saved['files'][deployment['nginx_entry']], pid, parser.parse, uid)
    app = process_record(runtime['expected_pid'], proc)
    require(app['uid'] == [runtime['uid']] * 4 and app['executable'] == runtime['node'], 'APPLICATION_PROCESS')
    from prepare_dashboard_read_activation import signature
    release_link = Path(runtime['current_link'])
    runtime_files = {p: secured_file(p, owner) for p, owner in [
        (runtime['environment'], runtime['uid']), (runtime['start_receipt'], runtime['uid']),
        (runtime['inventory'], runtime['uid']), (runtime['unit_path'], uid), (runtime['retry_dropin'], uid)]}
    return dict(boot_id=(proc / 'sys/kernel/random/boot_id').read_text().strip(), service=service,
                master=master, application=app, runtime=state, pid_fingerprint=list(pid_record),
                application_environment_sha256=digest((proc / str(runtime['expected_pid']) / 'environ').read_bytes()),
                runtime_files=runtime_files, release_link_fingerprint=signature(release_link.lstat()),
                artifacts={p: secured_file(p, uid) for p in sorted(artifacts)},
                build_sha256=digest(version.stdout + version.stderr), workers=workers(pid, proc))


def stable_runtime(facts):
    return {key: value for key, value in facts.items() if key != 'workers'}


def confirm_workers(before, after):
    require(stable_runtime(before) == stable_runtime(after), 'POST_RELOAD_RUNTIME_DRIFT')
    old = {(r['pid'], r['start_ticks']) for r in before['workers']}
    require(len(before['workers']) == len(after['workers']), 'WORKER_COUNT_DRIFT')
    require(all((r['pid'], r['start_ticks']) not in old for r in after['workers']), 'WORKER_ACCEPTANCE_UNCONFIRMED')
    security = {(tuple(r['uid']), tuple(r['gid']), r['executable'], r['cgroup']) for r in before['workers']}
    require(all((tuple(r['uid']), tuple(r['gid']), r['executable'], r['cgroup']) in security for r in after['workers']), 'WORKER_SECURITY_DRIFT')


def authenticate(binding, uid=0, gid=0):
    import prepare_dashboard_read_activation as prepare
    check_root, prep_root = Path(binding['check']['check_workspace']), Path(binding['preparation_workspace'])
    prepare.workspace(prep_root, uid, gid)
    for name, key in [('prepare.py', 'preparation_program_sha256'), ('PREPARATION.json', 'preparation_binding_sha256')]:
        raw, _ = prepare.private_read(prep_root / name, uid, gid)
        require(digest(raw) == binding[key], 'PREPARATION_INPUT_HASH')
    raw, _ = prepare.private_read(prep_root / 'APPLY-EVIDENCE.private.json', uid, gid)
    require(digest(raw) == binding['private_activation_evidence_sha256'], 'ACTIVATION_EVIDENCE_HASH')
    evidence = json.loads(raw)
    report_raw, _ = prepare.private_read(prep_root / 'PREPARATION-PASS.private.json', uid, gid)
    require(digest(report_raw) == binding['expected_preparation_receipt_sha256'], 'PREPARATION_RECEIPT_HASH')
    require(json.loads(report_raw) == binding['expected_preparation_receipt'], 'PREPARATION_RECEIPT_FIELDS')
    saved = prepare.verify_saved(check_root, binding['check'], uid, gid)
    for name, expected in binding['private_check_hashes'].items():
        require(saved['evidence'][name]['sha256'] == expected, 'ROOT_CHECK_EVIDENCE_HASH')
    require(saved['evidence'] == evidence['verified_evidence']
            and evidence['expected_receipt'] == binding['check']['expected_receipt']
            and evidence['candidate_sha256'] == digest(saved['candidate'])
            and evidence['candidate_bytes'] == len(saved['candidate'])
            and evidence['apply_authorized'] is False and evidence['rollback_authorized'] is False,
            'PREPARATION_EVIDENCE_BINDING')
    saved['private_evidence'] = evidence
    return saved


def configurations(saved, installed=None, uid=0):
    import prepare_dashboard_read_activation as prepare
    deployment = saved['deployment']
    expected = saved['private_evidence']['current_configuration_snapshots']
    rows = {r['file_id']: copy.deepcopy(r) for r in deployment['protected_configurations']}
    if installed is not None:
        row = rows[digest(deployment['main_path'])]
        row.update(sha256=installed['sha256'], bytes=installed['bytes'])
    actual = {p: prepare.live_snapshot(p, rows[digest(p)]) for p in saved['files']}
    for path, value in actual.items():
        require(value == (installed if path == deployment['main_path'] and installed is not None else expected[path]), 'CONFIGURATION_SECURITY_DRIFT')
    return actual


def installed_snapshot(saved, target):
    import prepare_dashboard_read_activation as prepare
    deployment = saved['deployment']
    path = deployment['main_path']
    original = saved['private_evidence']['current_configuration_snapshots'][path]
    row = next(r for r in deployment['protected_configurations'] if r['file_id'] == digest(path))
    value = prepare.live_snapshot(path, dict(row, sha256=digest(target), bytes=len(target)))
    require(value['resolved_path'] == original['resolved_path'] and value['symlink_target'] == original['symlink_target']
            and value['xattrs_base64'] == original['xattrs_base64']
            and value['target_fingerprint'][3:6] == original['target_fingerprint'][3:6], 'INSTALLED_SECURITY')
    # For a logical symlink, replacing its resolved target must not replace the link.
    if original['symlink_target'] is not None:
        require(value['path_fingerprint'] == original['path_fingerprint'], 'INSTALLED_SYMLINK')
    return value


def loaded_inventory(saved, dump, target):
    import prepare_dashboard_read_activation as prepare
    deployment = copy.deepcopy(saved['deployment'])
    row = next(r for r in deployment['protected_configurations'] if r['file_id'] == digest(deployment['main_path']))
    row.update(sha256=digest(target), bytes=len(target))
    return prepare.archived_files(dump, dict(current_deployment=deployment,
        expected_receipt=dict(loaded_configurations=len(deployment['protected_configurations']))), target)


def validate_fresh_state(auth, receipt, binding, manifest_sha, mode, now=None):
    now = now or utc()
    require(auth['format'] == 1 and auth['mode'] == mode and auth['operator_manifest_sha256'] == manifest_sha, 'AUTHORIZATION_SCOPE')
    require(auth.get('execution_authorized') is True and type(auth.get('nginx_reloads_max')) is int
            and auth['nginx_reloads_max'] == 1, 'OWNER_EXECUTION_APPROVAL')
    require(auth['private_activation_evidence_sha256'] == binding['private_activation_evidence_sha256']
            and auth['candidate_sha256'] == binding['check']['expected_receipt']['candidate_sha256']
            and auth['preimage_sha256'] == binding['check']['expected_receipt']['preimage_sha256'], 'AUTHORIZATION_IDENTITIES')
    begin, end = instant(auth['not_before_utc']), instant(auth['expires_at_utc'])
    require(begin <= now <= end and 0 < (end - begin).total_seconds() <= 900, 'AUTHORIZATION_WINDOW')
    require(receipt['result'] == 'PASS' and receipt['mode'] == 'ACTIVATION_DATABASE_READONLY'
            and receipt['nonce'] == auth['nonce'] and re.fullmatch('[a-f0-9]{64}', auth['nonce']) is not None
            and receipt['production_writes'] == 0 and type(receipt['production_writes']) is int, 'DATABASE_RECEIPT')
    require(receipt['project_ref'] == binding['production_project_ref']
            and receipt['vetted_verifier_sha256'] == binding['database_verifier_sha256']
            and receipt['settings_preimage_sha256'] == binding['settings_preimage_sha256'], 'DATABASE_TARGET')
    for key in ['read_only', 'schema_migrations_rls_grants_exact', 'catalog_settings_publication_exact',
                'zero_stock_orders_storage', 'commerce_signup_disabled']:
        require(receipt.get(key) is True, 'DATABASE_INVARIANT')
    require(receipt['business_fingerprint_sha256'] == auth['business_fingerprint_sha256']
            and receipt['schema_sha256'] == binding['database_schema_sha256'], 'BUSINESS_OR_SCHEMA_DRIFT')
    fresh(receipt['observed_at_utc'], now, 300)
    fresh(receipt['completed_at_utc'], now, 300)
    require(instant(receipt['completed_at_utc']) >= instant(receipt['observed_at_utc']), 'DATABASE_RECEIPT_TIME')


def sealed_inputs_unchanged(root, manifest_sha, controls=None, uid=0, gid=0):
    import prepare_dashboard_read_activation as prepare
    raw, _ = prepare.private_read(Path(root) / 'MANIFEST.json', uid, gid)
    require(digest(raw) == manifest_sha, 'OPERATOR_MANIFEST_DRIFT')
    manifest = json.loads(raw)
    hashes = {**manifest['files'], 'bootstrap.py': manifest['bootstrap_sha256'], **(controls or {})}
    for name, sha in hashes.items():
        raw, _ = prepare.private_read(Path(root) / name, uid, gid)
        require(digest(raw) == sha, 'OPERATOR_OR_CONTROL_DRIFT')


class Operation:
    """Durable one-attempt journal. Reload is available only behind swap gates."""
    def __init__(self, root, deployment, mode, manifest_sha, transport=None):
        self.root, self.deployment, self.mode, self.manifest_sha = Path(root), deployment, mode, manifest_sha
        self.transport = transport or self.execute
        self.counter = 0
        self.events = []
        self.reload_armed = False

    def mark(self, event):
        require(event not in self.events, 'DUPLICATE_MILESTONE')
        durable_new(self.root / (event + '.private.json'), dict(event=event, at_utc=utc().isoformat(), manifest_sha256=self.manifest_sha))
        self.events.append(event)

    @staticmethod
    def execute(argv):
        return subprocess.run(argv, stdin=subprocess.DEVNULL, capture_output=True, timeout=45,
                              env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LC_ALL': 'C', 'SYSTEMD_PAGER': ''})

    def allowed(self, argv):
        d = self.deployment
        if argv in ([d['nginx'], '-T'], [d['nginx'], '-V'], [d['ss'], '-lntp']):
            return True
        if len(argv) == 4 and argv[:2] == [d['systemctl'], 'show'] and argv[2] in (d['nginx_unit'], d['runtime']['unit']):
            return argv[3] in ('--property=ActiveState,SubState,MainPID,NRestarts,Restart,User,Group',
                '--property=Id,LoadState,ActiveState,SubState,MainPID,FragmentPath,DropInPaths,ExecStart,ExecReload,ControlGroup,Type,NeedDaemonReload')
        if len(argv) == 6 and argv[:2] == [d['nginx'], '-T'] and argv[2] == '-p' and argv[4] == '-c':
            path = Path(argv[5])
            return argv[3].startswith('/') and path.resolve().is_relative_to(self.root / 'check-shadow') and path.name == Path(d['nginx_entry']).name
        return False

    def command(self, argv, label):
        require(self.allowed(argv), 'COMMAND_SCOPE')
        return self.record_command(argv, label)

    def record_command(self, argv, label):
        require(re.fullmatch('[a-z0-9-]+', label) is not None, 'LOG_LABEL')
        self.counter += 1
        prefix = self.root / (str(self.counter) + '-' + label)
        durable_new(str(prefix) + '.invocation.private.json', dict(argv=argv, at_utc=utc().isoformat()))
        try:
            result = self.transport(argv)
        except subprocess.TimeoutExpired as error:
            durable_new(str(prefix) + '.stdout.private', error.stdout or b'')
            durable_new(str(prefix) + '.stderr.private', error.stderr or b'')
            durable_new(str(prefix) + '.exit.private.json', dict(timeout=True))
            raise GateError('COMMAND_TIMEOUT') from error
        durable_new(str(prefix) + '.stdout.private', result.stdout)
        durable_new(str(prefix) + '.stderr.private', result.stderr)
        durable_new(str(prefix) + '.exit.private.json', dict(exit_code=result.returncode))
        require(result.returncode == 0, 'COMMAND_FAILED')
        return result

    def reload(self):
        require(self.mode in ('apply', 'rollback') and self.reload_armed
                and 'installed-validated' in self.events and 'reload-attempted' not in self.events, 'RELOAD_NOT_AUTHORIZED')
        self.mark('reload-attempted')
        self.record_command([self.deployment['systemctl'], 'reload', self.deployment['nginx_unit']], 'one-nginx-reload')
        self.mark('reload-acknowledged')

    def disposition(self):
        return dict(replacement_attempted='replacement-attempted' in self.events,
                    replacement_acknowledged='replacement-acknowledged' in self.events,
                    reload_attempted='reload-attempted' in self.events,
                    reload_acknowledged='reload-acknowledged' in self.events,
                    worker_acceptance_confirmed='worker-acceptance-confirmed' in self.events,
                    automatic_retry=False, automatic_rollback=False, cleanup=False)


def shadow_validate(saved, target, operation):
    import config_parser as parser
    from private_config import loaded_names, shadow_tree
    d = saved['deployment']
    clones = shadow_tree(saved['files'], target.decode(), d['main_path'], operation.root / 'check-shadow',
                         parser.parse, config_prefix=Path(d['config_prefix']))
    version = operation.command([d['nginx'], '-V'], 'candidate-build')
    match = re.search(r'^configure arguments:\s*(.*)$', version.stderr.decode(), re.M)
    require(match is not None, 'NGINX_BUILD_PREFIX')
    prefixes = [p.split('=', 1)[1] for p in shlex.split(match[1]) if p.startswith('--prefix=')]
    require(len(prefixes) <= 1, 'NGINX_BUILD_PREFIX')
    prefix = prefixes[0] if prefixes else '/usr/local/nginx'
    result = operation.command([d['nginx'], '-T', '-p', prefix, '-c', str(clones[d['nginx_entry']])], 'candidate-shadow')
    require(set(loaded_names(result.stdout)) == set(map(str, clones.values())), 'COMPLETE_SHADOW_INDEX')


def switch_once(saved, operation, barrier, current_runtime, target, source, observe, probe, pre_reload):
    """Shared APPLY/rollback sequence; one swap and at most one reload, no recovery."""
    import atomic_config as atomic
    d = saved['deployment']
    operation.mark('operation-started')
    barrier()
    shadow_validate(saved, target, operation)
    snapshot = atomic.capture(d['main_path'], digest(source))
    durable_new(operation.root / 'main.before.conf', source)
    durable_new(operation.root / 'main.before.metadata.private.json', atomic.recovery_metadata(snapshot))
    durable_new(operation.root / 'main.target.conf', target)
    barrier()
    atomic.replace_once(snapshot, target, operation.manifest_sha[:24], barrier, operation.mark)
    installed = installed_snapshot(saved, target)
    configurations(saved, installed)
    loaded_inventory(saved, operation.command([d['nginx'], '-T'], 'installed-index').stdout, target)
    require(current_runtime() == observe['before'], 'INSTALLED_RUNTIME_DRIFT')
    configurations(saved, installed)
    pre_reload(installed)
    operation.mark('installed-validated')
    operation.reload_armed = True
    operation.reload()
    # One bounded observation interval, never another reload or fallback.
    time.sleep(observe['delay_seconds'])
    after = current_runtime()
    confirm_workers(observe['before'], after)
    operation.mark('worker-acceptance-confirmed')
    probe()
    configurations(saved, installed)
    loaded_inventory(saved, operation.command([d['nginx'], '-T'], 'post-reload-index').stdout, target)
    require(stable_runtime(current_runtime()) == stable_runtime(after), 'FINAL_RUNTIME_DRIFT')
    return dict(installed=installed, runtime=after, **operation.disposition())


def response(url, connect_host=None, method='GET'):
    """One fresh connection, no redirects/proxies/cookies/credentials or retries."""
    parts = urllib.parse.urlsplit(url)
    require(parts.scheme in ('http', 'https') and parts.hostname and not parts.username and not parts.password, 'PROBE_URL')
    require(connect_host is None or parts.scheme == 'http', 'PROBE_TLS_TARGET')
    cls = http.client.HTTPSConnection if parts.scheme == 'https' else http.client.HTTPConnection
    require(method in ('GET', 'HEAD') or method == 'POST' and parts.path == '/api/admin-logs' and not parts.query, 'PROBE_METHOD')
    connection = cls(connect_host or parts.hostname, parts.port, timeout=15)
    try:
        connection.request(method, parts.path + ('?' + parts.query if parts.query else ''), headers={'Host': parts.netloc, 'Connection': 'close'})
        result = connection.getresponse()
        body = result.read(4_000_001)
        require(len(body) <= 4_000_000, 'PROBE_SIZE')
        headers = {k.lower(): v for k, v in result.getheaders()}
        return result.status, headers, body
    finally:
        connection.close()


def public_baseline(saved):
    d = saved['deployment']
    keys = {'strict-transport-security', 'x-frame-options', 'x-content-type-options', 'content-security-policy',
            'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy', 'cross-origin-resource-policy', 'cache-control'}
    result = {}
    for path in ['/', '/ar', '/dashboard/login', '/ar/dashboard/login'] + d['product_paths']:
        status, headers, _ = response(d['routing']['site_origin'] + path)
        require(status == 200, 'ACCEPTED_PUBLIC_BASELINE')
        result[path] = dict(status=status, headers={k: v for k, v in headers.items() if k in keys})
    return result


def probes(saved, mode, baseline):
    import dashboard_access as renderer
    import root_dashboard_read_check as check
    d = saved['deployment']
    origin = d['routing']['site_origin']
    require(public_baseline(saved) == baseline, 'PUBLIC_SECURITY_HEADERS_DRIFT')
    for path in ['/', '/ar'] + d['product_paths'] + ['/dashboard', '/ar/dashboard', '/dashboard/login', '/ar/dashboard/login']:
        status, _, _ = response(origin + path)
        require(status == 200 if path not in ('/dashboard', '/ar/dashboard') else status in (302, 303, 307), 'PUBLIC_READ_BEHAVIOR')
    for path, destination in d['legacy_probes'].items():
        status, headers, _ = response(origin + path)
        require(status == 301 and urllib.parse.urljoin(origin, headers.get('location', '')) == origin + destination, 'LEGACY_REDIRECT')
    status, _, body = response(origin + d['image']['path'])
    require(status == 200 and len(body) == d['image']['bytes'] and digest(body) == d['image']['sha256'], 'MEDIA_DRIFT')
    for row in renderer.read_policy()['routes']:
        path = row['path'].replace(':id', '00000000-0000-4000-8000-000000000001').replace(':sessionId', '00000000-0000-4000-8000-000000000001').replace(':token', 'inert-denial-probe')
        status, headers, _ = response(origin + path)
        if row['decision'] == 'hold':
            require(status == 403, 'HELD_ENDPOINT_OPENED')
        elif mode == 'apply':
            require(status == 401 and 'no-store' in headers.get('cache-control', ''), 'ADMIN_AUTH_OR_CACHE')
        else:
            old_admitted = row['path'] in renderer.READ_APIS or row['path'] == '/api/admin-products/:id'
            require(status == (401 if old_admitted else 403), 'ROLLBACK_ADMIN_AUTH')
    for path in ['/signup', '/account', '/cart', '/checkout', '/api/checkout', '/api/not-approved']:
        require(response(origin + path)[0] == 403, 'CUSTOMER_OR_COMMERCE_OPENED')
    require(response(origin + '/login')[0] == 403, 'CUSTOMER_LOGIN_OPENED')
    require(response(origin + '/dashboard/login', method='HEAD')[0] == 200, 'LOGIN_HEAD_BEHAVIOR')
    require(response(origin + '/api/admin-logs', method='POST')[0] == 401, 'AUDIT_AUTH_BEHAVIOR')
    alias = 'https://' + d['routing']['canonical_alias']
    status, headers, _ = response(alias + '/dashboard/login')
    require(status == 301 and headers.get('location') == origin + '/dashboard/login', 'CANONICAL_ALIAS_DRIFT')
    check.disabled_commerce(d, renderer.validate_binding)
    host = renderer.validate_binding(d['routing'])[0]
    port = saved['spec']['auxiliary_contract']['auxiliary'][0]['port']
    for path in ['/', '/api/admin-users', '/index.php']:
        require(response('http://' + host + ':' + str(port) + path, '127.0.0.1')[0] == 404, 'LEGACY_BACKEND_OPENED')


def run(root, mode, binding, manifest_sha, authorization_sha=None):
    import config_parser as parser
    import dashboard_access as renderer
    import prepare_dashboard_read_activation as prepare
    import root_dashboard_read_check as check
    saved = authenticate(binding)
    require(str(root) == binding['workspaces'][mode], 'BOUND_WORKSPACE')
    prepare.prove_candidate(saved, renderer, check, parser)
    require(check.non_api_projection(saved['source'].decode(), parser.parse)
            == check.non_api_projection(saved['candidate'].decode(), parser.parse), 'NON_API_DRIFT')
    op = Operation(root, saved['deployment'], mode, manifest_sha)
    try:
        current_installed = None
        source, target = saved['source'], saved['candidate']
        auth, db, reviewed = None, None, None
        if mode != 'verify':
            require(mode in ('apply', 'rollback') and authorization_sha is not None, 'AUTHORIZATION_REQUIRED')
            raw, _ = prepare.private_read(Path(root) / 'AUTHORIZATION.json')
            require(digest(raw) == authorization_sha, 'AUTHORIZATION_HASH')
            auth = json.loads(raw)
            db_raw, _ = prepare.private_read(Path(root) / 'DATABASE-STATE.private.json')
            require(digest(db_raw) == auth['database_receipt_sha256'], 'DATABASE_RECEIPT_HASH')
            db = json.loads(db_raw)
            validate_fresh_state(auth, db, binding, manifest_sha, mode)
            state_raw, _ = prepare.private_read(Path(root) / 'ROOT-STATE.private.json')
            require(digest(state_raw) == auth['root_state_sha256'], 'ROOT_STATE_HASH')
            reviewed = json.loads(state_raw)
            require(reviewed['result'] == 'PASS' and reviewed['mode'] == 'ACTIVATION_ROOT_READONLY'
                    and reviewed['private_activation_evidence_sha256'] == binding['private_activation_evidence_sha256'], 'ROOT_STATE_SCOPE')
            if mode == 'apply':
                fresh(reviewed['observed_at_utc'], utc(), 900)
            if mode == 'rollback':
                apply_raw, _ = prepare.private_read(Path(root) / 'APPLY-RECEIPT.private.json')
                require(digest(apply_raw) == auth['apply_receipt_sha256'], 'APPLY_RECEIPT_HASH')
                applied = json.loads(apply_raw)
                require(applied['result'] == 'INFRASTRUCTURE_PASS' and applied['mode'] == 'apply'
                        and applied['manifest_sha256'] == auth['apply_manifest_sha256']
                        and applied['replacement_acknowledged'] is True and applied['reload_acknowledged'] is True
                        and applied['worker_acceptance_confirmed'] is True
                        and applied['candidate_sha256'] == digest(saved['candidate'])
                        and applied['private_activation_evidence_sha256'] == binding['private_activation_evidence_sha256'], 'ROLLBACK_APPLY_BINDING')
                current_installed = applied['installed']
                source, target = target, source
        configurations(saved, current_installed)
        facts = runtime_facts(saved, op.command)
        require(facts['master']['pid'] == saved['private_evidence']['nginx_pid']['master_pid'], 'PREPARED_MASTER_DRIFT')
        loaded_inventory(saved, op.command([saved['deployment']['nginx'], '-T'], 'fresh-loaded-index').stdout, source)
        if mode == 'verify':
            check.disabled_commerce(saved['deployment'], renderer.validate_binding)
            configurations(saved)
            require(runtime_facts(saved, op.command) == facts, 'READONLY_RUNTIME_DRIFT')
            sealed_inputs_unchanged(root, manifest_sha)
            baseline = public_baseline(saved)
            configurations(saved)
            loaded_inventory(saved, op.command([saved['deployment']['nginx'], '-T'], 'readonly-final-index').stdout, saved['source'])
            require(runtime_facts(saved, op.command) == facts, 'READONLY_RUNTIME_DRIFT')
            sealed_inputs_unchanged(root, manifest_sha)
            value = dict(result='PASS', mode='ACTIVATION_ROOT_READONLY', observed_at_utc=utc().isoformat(), runtime=facts,
                         private_activation_evidence_sha256=binding['private_activation_evidence_sha256'],
                         candidate_sha256=digest(saved['candidate']), configuration_count=len(saved['files']),
                         preparation_receipt_sha256=binding['expected_preparation_receipt_sha256'],
                         public_baseline=baseline,
                         production_configuration_changes=0, service_operations=0, database_verified=False)
            hashed = durable_new(Path(root) / 'READONLY-STATE.private.json', value)
            return dict(result='PASS', mode=mode, private_root_state_sha256=hashed, activation_authorized=False)
        if mode == 'apply':
            require(facts == reviewed['runtime'], 'REVIEWED_RUNTIME_DRIFT')
        else:
            require(stable_runtime(facts) == stable_runtime(reviewed['runtime'])
                    and facts == applied['runtime'], 'ROLLBACK_RUNTIME_DRIFT')
        controls = {'AUTHORIZATION.json': authorization_sha, 'DATABASE-STATE.private.json': auth['database_receipt_sha256'],
                    'ROOT-STATE.private.json': auth['root_state_sha256']}
        if mode == 'rollback':
            controls['APPLY-RECEIPT.private.json'] = auth['apply_receipt_sha256']
        def pre_reload(installed):
            sealed_inputs_unchanged(root, manifest_sha, controls)
            validate_fresh_state(auth, db, binding, manifest_sha, mode)
            check.disabled_commerce(saved['deployment'], renderer.validate_binding)
            require(authenticate(binding)['evidence'] == saved['evidence'], 'PRIVATE_EVIDENCE_DRIFT')
            prepare.prove_candidate(saved, renderer, check, parser)
            configurations(saved, installed)
            validate_fresh_state(auth, db, binding, manifest_sha, mode)
        def barrier():
            sealed_inputs_unchanged(root, manifest_sha, controls)
            validate_fresh_state(auth, db, binding, manifest_sha, mode)
            configurations(saved, current_installed)
            loaded_inventory(saved, op.command([saved['deployment']['nginx'], '-T'], 'barrier-loaded-index').stdout, source)
            require(runtime_facts(saved, op.command) == facts, 'BARRIER_RUNTIME_DRIFT')
            check.disabled_commerce(saved['deployment'], renderer.validate_binding)
            require(authenticate(binding)['evidence'] == saved['evidence'], 'PRIVATE_EVIDENCE_DRIFT')
            prepare.prove_candidate(saved, renderer, check, parser)
            configurations(saved, current_installed)
            validate_fresh_state(auth, db, binding, manifest_sha, mode)
        switched = switch_once(saved, op, barrier, lambda: runtime_facts(saved, op.command), target, source,
                               dict(before=facts, delay_seconds=2), lambda: probes(saved, mode, reviewed['public_baseline']), pre_reload)
        report = dict(result='INFRASTRUCTURE_PASS', mode=mode, manifest_sha256=manifest_sha,
                      candidate_sha256=digest(saved['candidate']), installed_sha256=digest(target),
                      private_activation_evidence_sha256=binding['private_activation_evidence_sha256'],
                      database_receipt_sha256=auth['database_receipt_sha256'],
                      business_fingerprint_sha256=db['business_fingerprint_sha256'],
                      completed_at_utc=utc().isoformat(), database_post_verified=False,
                      authenticated_browser_accepted=False, full_acceptance=False, **switched)
        receipt_hash = durable_new(Path(root) / (mode.upper() + '-RECEIPT.private.json'), report)
        return dict(result='INFRASTRUCTURE_PASS', mode=mode, private_receipt_sha256=receipt_hash,
                    full_acceptance=False, database_post_verification_required=True, **op.disposition())
    except Exception:
        durable_new(Path(root) / 'OPERATION-DISPOSITION.private.json', op.disposition())
        raise
