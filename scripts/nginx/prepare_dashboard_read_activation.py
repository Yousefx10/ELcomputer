"""Prepare private bindings for a later reviewed operator; never activate.

Deployment inputs are a separately hash-bound PREPARATION.json. No command,
HTTP, SQL, reload, replacement, rollback, retry or cleanup entry point exists.
Only verified pure rendering/header/PID helpers from the CHECK bundle are used.
"""
import argparse
import base64
import copy
import datetime
import hashlib
import importlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import traceback


CODES = frozenset({
    'ROOT_REQUIRED', 'PRIVATE_WORKSPACE', 'BINDING_HASH', 'BINDING_FORMAT', 'PROGRAM_HASH',
    'PRIVATE_METADATA', 'READ_DRIFT', 'FILE_LIMIT', 'PRIVATE_SYMLINK', 'CHECK_MANIFEST',
    'CHECK_SCOPE', 'CHECK_FILES', 'CHECK_FILE_HASH', 'CHECK_DEPLOYMENT', 'CHECK_RECEIPT',
    'SOURCE_IDENTITY', 'CANDIDATE_IDENTITY', 'SNAPSHOT_FRAMING', 'SNAPSHOT_INDEX',
    'SNAPSHOT_HASH', 'SOURCE_SNAPSHOT', 'RECOVERY_METADATA', 'CURRENT_METADATA',
    'CURRENT_SYMLINK', 'CURRENT_HASH', 'CURRENT_XATTRS', 'SOURCE_TO_CANDIDATE',
    'AUXILIARY_BYTES', 'NGINX_PID', 'EVIDENCE_CHANGED', 'UNEXPECTED_MODULE_PATH',
})


def require(value, code):
    if not value:
        raise ValueError(code)


def digest(raw):
    return hashlib.sha256(raw.encode() if isinstance(raw, str) else raw).hexdigest()


def signature(info):
    return [info.st_dev, info.st_ino, info.st_size, info.st_uid, info.st_gid,
            stat.S_IMODE(info.st_mode), info.st_mtime_ns, info.st_ctime_ns, info.st_nlink]


def private_read(path, uid=0, gid=0, limit=16000000):
    path = Path(path)
    require(path.resolve(strict=True) == path, 'PRIVATE_SYMLINK')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | getattr(os, 'O_NOATIME', 0))
    with os.fdopen(fd, 'rb') as stream:
        before = os.fstat(stream.fileno())
        require(stat.S_ISREG(before.st_mode) and before.st_uid == uid and before.st_gid == gid
                and stat.S_IMODE(before.st_mode) == 0o600 and before.st_nlink == 1, 'PRIVATE_METADATA')
        require(before.st_size <= limit, 'FILE_LIMIT')
        raw = stream.read(limit + 1)
        after = os.fstat(stream.fileno())
    require(signature(before) == signature(after) == signature(path.lstat())
            and len(raw) == before.st_size, 'READ_DRIFT')
    return raw, dict(path=str(path), sha256=digest(raw), bytes=len(raw), fingerprint=signature(before))


def workspace(path, uid=0, gid=0):
    require(path.resolve(strict=True) == path, 'PRIVATE_WORKSPACE')
    info = path.lstat()
    require(stat.S_ISDIR(info.st_mode) and info.st_uid == uid and info.st_gid == gid
            and stat.S_IMODE(info.st_mode) == 0o700, 'PRIVATE_WORKSPACE')
    return [info.st_dev, info.st_ino, info.st_uid, info.st_gid, stat.S_IMODE(info.st_mode)]


def write_new(path, value):
    raw = (json.dumps(value, indent=2, sort_keys=True) + '\n').encode()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    return digest(raw)


def archived_files(raw, spec, source):
    """Authenticate the saved complete dump; never substitute live bodies."""
    markers = list(re.finditer(rb'^# configuration file (.+):\n', raw, re.M))
    expected = {r['file_id']: r for r in spec['current_deployment']['protected_configurations']}
    require(len(markers) == len(expected) == spec['expected_receipt']['loaded_configurations'], 'SNAPSHOT_INDEX')
    files = {}
    for index, marker in enumerate(markers):
        path = marker[1].decode()
        require(path.startswith('/') and os.path.normpath(path) == path and path not in files, 'SNAPSHOT_INDEX')
        row = expected.pop(digest(path), None)
        require(row is not None, 'SNAPSHOT_INDEX')
        end = markers[index + 1].start() if index + 1 < len(markers) else len(raw)
        framed = raw[marker.end():end]
        require(framed.endswith(b'\n'), 'SNAPSHOT_FRAMING')
        content = framed[:-1]
        require(digest(content) == row['sha256'] and (row['bytes'] is None or len(content) == row['bytes']), 'SNAPSHOT_HASH')
        require(row['bytes'] is not None or path == spec['current_deployment']['main_path'], 'SNAPSHOT_HASH')
        files[path] = content.decode()
    require(not expected and files[spec['current_deployment']['main_path']].encode() == source, 'SOURCE_SNAPSHOT')
    return files


def live_snapshot(path, row):
    """Read a listed configuration and security metadata; no Nginx invocation."""
    path = Path(path)
    link_before = path.lstat()
    target = path.resolve(strict=True)
    link = os.readlink(path) if path.is_symlink() else None
    fd = os.open(target, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | getattr(os, 'O_NOATIME', 0))
    with os.fdopen(fd, 'rb') as stream:
        before = os.fstat(stream.fileno())
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_uid == row['uid']
                and stat.S_IMODE(before.st_mode) == int(row['mode'], 8), 'CURRENT_METADATA')
        require(before.st_size == row['bytes'] and before.st_size < 16000000, 'CURRENT_METADATA')
        raw = stream.read(before.st_size + 1)
        attrs = {n: base64.b64encode(os.getxattr(target, n)).decode() for n in os.listxattr(target)}
        after = os.fstat(stream.fileno())
    require(signature(before) == signature(after) == signature(target.stat())
            and signature(link_before) == signature(path.lstat()), 'CURRENT_METADATA')
    require(path.resolve(strict=True) == target and (os.readlink(path) if path.is_symlink() else None) == link, 'CURRENT_SYMLINK')
    require(len(raw) == row['bytes'] and digest(raw) == row['sha256'], 'CURRENT_HASH')
    require(attrs == {n: base64.b64encode(os.getxattr(target, n)).decode() for n in os.listxattr(target)}, 'CURRENT_XATTRS')
    return dict(path=str(path), resolved_path=str(target), symlink_target=link,
                path_fingerprint=signature(link_before), target_fingerprint=signature(before),
                sha256=digest(raw), bytes=len(raw), xattrs_base64=attrs)


def verify_saved(root, binding, uid=0, gid=0):
    """No privileged entry, command execution or live configuration access."""
    workspace(root, uid, gid)
    evidence = {}
    def read(name):
        raw, evidence[name] = private_read(root/name, uid, gid)
        return raw
    manifest_raw = read('MANIFEST.json')
    require(digest(manifest_raw) == binding['check_manifest_sha256'], 'CHECK_MANIFEST')
    manifest = json.loads(manifest_raw)
    require(manifest['format'] == 1 and manifest['scope'] == 'ADM-01 approved dashboard reads CHECK only', 'CHECK_SCOPE')
    expected_names = {'APPLY-ROLLBACK-PLAN.json', 'CHECK-PLAN.json', 'DEPLOYMENT.json',
        'atomic_config.py', 'config_parser.py', 'dashboard_access.py', 'dashboard_read_policy.json',
        'private_config.py', 'root_dashboard_read_check.py'}
    require(set(manifest['files']) == expected_names, 'CHECK_FILES')
    for name, sha in manifest['files'].items():
        require(digest(read(name)) == sha, 'CHECK_FILE_HASH')
    require(digest(read('bootstrap.py')) == binding['check_bootstrap_sha256'], 'CHECK_FILE_HASH')
    python_names = {p.name for p in root.iterdir() if p.suffix == '.py' or p.is_dir() and p.name != 'check-shadow'}
    require(python_names == {n for n in expected_names if n.endswith('.py')} | {'bootstrap.py'}, 'UNEXPECTED_MODULE_PATH')
    spec = json.loads(read('DEPLOYMENT.json'))
    require(digest(read('DEPLOYMENT.json')) == binding['check_deployment_sha256']
            == manifest['deployment_sha256'], 'CHECK_DEPLOYMENT')
    receipt = json.loads(read('CHECK-PASS.private.json'))
    require(all(type(receipt.get(k)) is type(v) and receipt[k] == v for k, v in binding['expected_receipt'].items()), 'CHECK_RECEIPT')
    source = read('accepted.before.conf')
    candidate = read('checked.candidate.conf')
    require(digest(source) == binding['expected_receipt']['preimage_sha256']
            == spec['current_deployment']['routing']['source_sha256'], 'SOURCE_IDENTITY')
    require(digest(candidate) == binding['expected_receipt']['candidate_sha256']
            and len(candidate) == binding['expected_receipt']['candidate_bytes'], 'CANDIDATE_IDENTITY')
    require(digest(read('dashboard_read_policy.json')) == binding['expected_receipt']['policy_sha256'], 'CHECK_FILE_HASH')
    source_metadata = json.loads(read('accepted.before.metadata.private.json'))
    deployment = copy.deepcopy(spec['current_deployment'])
    require(source_metadata['source_sha256'] == digest(source) and source_metadata['path'] == deployment['main_path']
            and len(source_metadata['stat_fingerprint']) == 7, 'RECOVERY_METADATA')
    for row in deployment['protected_configurations']:
        if row['file_id'] == digest(deployment['main_path']):
            require(row['bytes'] is None and row['sha256'] == digest(source), 'SOURCE_IDENTITY')
            row['bytes'] = len(source)
            require(source_metadata['stat_fingerprint'][2] == len(source)
                    and source_metadata['stat_fingerprint'][3] == row['uid']
                    and source_metadata['stat_fingerprint'][5] == int(row['mode'], 8), 'RECOVERY_METADATA')
    archive_spec = dict(current_deployment=deployment, expected_receipt=binding['expected_receipt'])
    files = archived_files(read('4-accepted-live-index.stdout.private'), archive_spec, source)
    return dict(spec=spec, deployment=deployment, receipt=receipt, evidence=evidence, files=files,
                source=source, candidate=candidate, source_metadata=source_metadata)


def prove_candidate(saved, renderer, check, parser):
    """Use frozen helpers only for source/candidate proof, never CHECK.main()."""
    deployment = saved['deployment']
    headers = check.inherited_headers(saved['files'], deployment, parser.parse, renderer.validate_binding)
    candidate, result = renderer.render_reads(saved['source'].decode(), deployment['routing'], headers,
        saved['spec']['auxiliary_contract'], dict(files=saved['files'], main=deployment['main_path'],
        entry=deployment['nginx_entry'], prefix=deployment['config_prefix'],
        approved_files={r['file_id']:r['sha256'] for r in deployment['protected_configurations']}))
    require(candidate.encode() == saved['candidate'] and result['approved_reads'] == 70
            and result['held_reads'] == 10, 'SOURCE_TO_CANDIDATE')
    return result


def collect_live(saved):
    deployment = saved['deployment']
    rows = {r['file_id']:r for r in deployment['protected_configurations']}
    snapshots = {p:live_snapshot(p, rows[digest(p)]) for p in saved['files']}
    main = snapshots[deployment['main_path']]
    old = saved['source_metadata']
    require(main['resolved_path'] == old['resolved_path'] and main['symlink_target'] == old['symlink_target']
            and main['target_fingerprint'][:7] == old['stat_fingerprint']
            and main['xattrs_base64'] == old['xattrs_base64'], 'RECOVERY_METADATA')
    return snapshots


def pid_evidence(entry, check, parser, uid=0):
    nodes = [n for n in parser.parse(entry) if n['name'] == 'pid']
    require(len(nodes) == 1 and len(nodes[0]['args']) == 1 and nodes[0]['args'][0].startswith('/'), 'NGINX_PID')
    path = Path(nodes[0]['args'][0])
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | getattr(os, 'O_NOATIME', 0))
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_uid == uid and info.st_nlink == 1
                and info.st_size <= 64 and not stat.S_IMODE(info.st_mode) & 0o022, 'NGINX_PID')
        raw = stream.read(65)
    require(re.fullmatch(rb'[1-9][0-9]*\n?', raw) and int(raw) > 1, 'NGINX_PID')
    pid = int(raw)
    fingerprint = check.nginx_pid_snapshot(entry, pid, parser.parse, uid)
    return dict(master_pid=pid, fingerprint=list(fingerprint), pid_path=str(path))


def main():
    arg = argparse.ArgumentParser(description='Prepare evidence only; no APPLY/rollback capability')
    arg.add_argument('--binding-sha256', required=True)
    args = arg.parse_args()
    require(os.geteuid() == 0, 'ROOT_REQUIRED')
    os.umask(0o077)
    root = Path(__file__).absolute().parent
    workspace_id = workspace(root)
    require(Path.cwd() == root, 'PRIVATE_WORKSPACE')
    raw, input_evidence = private_read(root/'PREPARATION.json')
    require(digest(raw) == args.binding_sha256, 'BINDING_HASH')
    binding = json.loads(raw)
    require(binding['format'] == 1 and binding['purpose'] == 'ADM-01 activation evidence only'
            and root.parent == Path('/root') and str(root) == binding['preparation_workspace'], 'BINDING_FORMAT')
    program, _ = private_read(Path(__file__).absolute())
    require(digest(program) == binding['program_sha256'], 'PROGRAM_HASH')
    write_new(root/'PREPARATION-STARTED.private.json', dict(started_at_utc=datetime.datetime.now(datetime.timezone.utc).isoformat()))
    check_root = Path(binding['check_workspace'])
    require(check_root.parent == root.parent and check_root != root, 'PRIVATE_WORKSPACE')
    check_id = workspace(check_root)
    saved = verify_saved(check_root, binding)
    # Import only after verifying the complete frozen bundle and module path set.
    sys.path.insert(0, str(check_root))
    parser = importlib.import_module('config_parser')
    renderer = importlib.import_module('dashboard_access')
    check = importlib.import_module('root_dashboard_read_check')
    prove_candidate(saved, renderer, check, parser)
    snapshots = collect_live(saved)
    pid = pid_evidence(saved['files'][saved['deployment']['nginx_entry']], check, parser)
    private_binding = dict(format=1, purpose='Evidence for a separately sealed activation operator; NOT authorization',
        expected_receipt=binding['expected_receipt'], check_workspace=str(check_root),
        verified_evidence=saved['evidence'], current_configuration_snapshots=snapshots, nginx_pid=pid,
        check_manifest_sha256=binding['check_manifest_sha256'], check_deployment_sha256=binding['check_deployment_sha256'],
        candidate_sha256=digest(saved['candidate']), candidate_bytes=len(saved['candidate']),
        fresh_loaded_index_verified=False, fresh_runtime_verified=False, fresh_schema_catalog_commerce_verified=False,
        apply_operator_sha256=None, apply_authorized=False, rollback_authorized=False)
    # Recheck every private evidence file and listed config after the proof/read.
    for name, info in saved['evidence'].items():
        _, current = private_read(check_root/name)
        require(current == info, 'EVIDENCE_CHANGED')
    require(collect_live(saved) == snapshots and pid_evidence(saved['files'][saved['deployment']['nginx_entry']], check, parser) == pid,
            'EVIDENCE_CHANGED')
    require(workspace(check_root) == check_id and workspace(root) == workspace_id
            and private_read(root/'PREPARATION.json')[1] == input_evidence, 'EVIDENCE_CHANGED')
    private_hash = write_new(root/'APPLY-EVIDENCE.private.json', private_binding)
    report = dict(result='PASS', mode='PREPARE_EVIDENCE', checked_candidate_sha256=digest(saved['candidate']),
        candidate_bytes=len(saved['candidate']), check_receipt_sha256=saved['evidence']['CHECK-PASS.private.json']['sha256'],
        saved_source_metadata_sha256=saved['evidence']['accepted.before.metadata.private.json']['sha256'],
        saved_index_sha256=saved['evidence']['4-accepted-live-index.stdout.private']['sha256'],
        private_activation_evidence_sha256=private_hash, configuration_count=len(snapshots), source_to_candidate_verified=True,
        live_loaded_index_verified=False, runtime_reverified=False, schema_catalog_commerce_reverified=False,
        apply_ready=False, activation_authorized=False, nginx_commands=0, reloads=0, service_operations=0,
        live_configuration_changes=0, check_repeated=False, configuration_exported=False, automatic_retry=False, cleanup=False)
    write_new(root/'PREPARATION-PASS.private.json', report)
    print(json.dumps(report))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # No raw exception/configuration/path/credential output.
        if os.geteuid() == 0:
            try:
                root = Path(__file__).absolute().parent
                workspace(root)
                write_new(root/('PREPARATION-STOP-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%f')+'.private.json'),
                          dict(traceback=traceback.format_exc()))
            except Exception:
                pass
        code = error.args[0] if error.args and isinstance(error.args[0], str) and error.args[0] in CODES else 'PRIVATE_PREPARATION_FAILED'
        print(json.dumps(dict(result='BLOCKED',mode='PREPARE_EVIDENCE',failing_check=code,
                              exception_type=type(error).__name__,live_configuration_changes=0,
                              reloads=0,service_operations=0,automatic_retry=False,cleanup=False)))
        sys.exit(1)
