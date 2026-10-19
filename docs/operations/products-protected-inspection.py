"""Owner-only read-only Products attestation. Stage inertly; never auto-run.

Deployment-specific binding resolved from the successful d52df628... command,
ce59d450... APPLY package and owner-reported 6a93dc6a... private receipt.
No operator main, database request, configuration export or service mutation.
"""
import base64, copy, datetime, hashlib, http.client, json, os, re, shlex, stat, subprocess, sys, time, urllib.parse
from pathlib import Path

ROOT = Path('/root/adm01-activation-apply-3be097f8217bd200')
MANIFEST = '34e62ec63b974d1143405ae7b3ce70cedf6e5645509c33bcde0648bfcd28269a'
APPLY = '6a93dc6ad6929e2eb1e677613c1cb6a29b36df81acc00652eb942cdacd033372'
SOURCE = 'c859c080dcab025c6d7e614d77864905d034e8c50d6570eef95014d6f4574bb5'
H = lambda raw: hashlib.sha256(raw).hexdigest()

def inspection_copy(path, uid=0, gid=0, parent_base=Path('/root')):
    """Read only the already copied file; never take code from user staging."""
    path = Path(path)
    parent = path.parent
    assert path.name == 'inspect.py' and parent.parent == parent_base
    assert re.fullmatch(r'products-inspect-[0-9a-f]{16}', parent.name)
    assert parent.resolve(strict=True) == parent and path.resolve(strict=True) == path
    info = parent.lstat()
    assert stat.S_ISDIR(info.st_mode) and info.st_uid == uid and info.st_gid == gid and stat.S_IMODE(info.st_mode) == 0o700
    info = path.lstat()
    assert stat.S_ISREG(info.st_mode) and info.st_uid == uid and info.st_gid == gid and stat.S_IMODE(info.st_mode) == 0o600
    assert info.st_nlink == 1 and 0 < info.st_size <= 20000
    raw = path.read_bytes()
    after = path.lstat()
    assert (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns) == (
        after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns)
    assert len(raw) == info.st_size
    return H(raw)

def validate_apply_binding(binding, applied):
    assert binding['workspaces']['apply'] == str(ROOT)
    assert applied['result'] == 'INFRASTRUCTURE_PASS' and applied['mode'] == 'apply'
    assert applied['manifest_sha256'] == MANIFEST and applied['candidate_sha256'] == SOURCE
    assert applied['replacement_acknowledged'] is True and applied['reload_acknowledged'] is True
    assert applied['worker_acceptance_confirmed'] is True
    assert applied['installed']['sha256'] == SOURCE and applied['installed']['bytes'] == 472049

def patch(text, binding, parser, pattern, policy):
    """Independent four-span implementation; no file or process access."""
    nodes = list(parser.walk(parser.parse(text)))
    changes = []
    writes = [('/api/admin-products', 'POST'), ('/api/admin-products/:id', 'PATCH'), ('/api/admin-products/bulk', 'POST')]
    for path, method in writes:
        selector = ['~', pattern(path)] if ':' in path else ['=', path]
        matches = [n for n in nodes if n['name'] == 'location' and n['args'] == selector]
        assert len(matches) == 1
        n = matches[0]; old = text[n['start']:n['end']]
        methods = next(r['methods'] for r in policy['routes'] if r['path'] == path)
        guard = 'if ($request_method !~ ^(' + '|'.join(methods) + ')$) { return 405; }'
        assert old.count(guard) == 1
        retries = [c for c in parser.walk(n['children']) if c['name'] == 'proxy_next_upstream']; assert len(retries) <= 1
        if retries:
            r = retries[0]; new = old[:r['start'] - n['start']] + 'proxy_next_upstream off;' + old[r['end'] - n['start']:]
        else: new = old[:-1] + '\nproxy_next_upstream off;\n}'
        new = new.replace(guard, guard.replace('|'.join(methods), '|'.join(methods + [method])))
        changes.append((n['start'], n['end'], new))
    variable = '$' + binding['variable_prefix'] + '_method_denied'
    matches = [n for n in nodes if n['name'] == 'map' and n['args'][-1] == variable]
    assert len(matches) == 1
    n = matches[0]; old = text[n['start']:n['end']]
    assert len(n['children']) == 2 and old.endswith('\n}')
    host = urllib.parse.urlsplit(binding['site_origin']).hostname
    rules = ''.join('    "~^' + re.escape(host) + '[|]' + method + '[|]' + pattern(path)[1:] + '" 0;\n' for path, method in writes)
    new = '# PRODUCTS-WRITES-v1: three idempotent commands; Nuxt authorization required.\n' + old[:-1] + rules + '}'
    changes.append((n['start'], n['end'], new))
    result = text
    for start, end, replacement in sorted(changes, reverse=True): result = result[:start] + replacement + result[end:]
    parser.parse(result)
    # Reverse each complete replaced span independently; all other bytes survive.
    restored = result
    for start, end, replacement in sorted(changes, reverse=True):
        shift = sum(len(value) - (b - a) for a, b, value in changes if a < start)
        position = start + shift
        assert restored[position:position + len(replacement)] == replacement
        restored = restored[:position] + text[start:end] + restored[position + len(replacement):]
    assert restored == text
    return result

try:
    phase = 'ROOT_INSPECTION_COPY'
    assert os.geteuid() == 0 and os.getegid() == 0
    inspection_sha = inspection_copy(Path(__file__).absolute())
    phase = 'APPLY_MANIFEST'
    assert os.geteuid() == 0 and ROOT.resolve(strict=True) == ROOT
    info = ROOT.stat(); assert info.st_uid == info.st_gid == 0 and stat.S_IMODE(info.st_mode) == 0o700
    def private(name):
        assert Path(name).name == name
        p = ROOT / name; s = p.lstat()
        assert stat.S_ISREG(s.st_mode) and s.st_uid == s.st_gid == 0 and stat.S_IMODE(s.st_mode) == 0o600 and s.st_nlink == 1
        return p.read_bytes()
    raw = private('MANIFEST.json'); assert H(raw) == MANIFEST
    manifest = json.loads(raw)
    for name, sha in manifest['files'].items(): assert H(private(name)) == sha
    assert {p.name for p in ROOT.glob('*.py')} == {n for n in manifest['files'] if n.endswith('.py')} | {'bootstrap.py'}
    sys.path.insert(0, str(ROOT))
    import dashboard_activation as a, config_parser as parser, dashboard_access as reads
    binding = json.loads(private('BINDING.json')); saved = a.authenticate(binding)
    phase = 'ACCEPTED_APPLY_RECEIPT'
    raw = private('APPLY-RECEIPT.private.json'); assert H(raw) == APPLY
    applied = json.loads(raw)
    validate_apply_binding(binding, applied)
    source = saved['candidate']; assert H(source) == SOURCE and len(source) == 472049
    phase = 'CURRENT_PROTECTED_CONFIGURATION'
    before = a.configurations(saved, applied['installed'])
    def command(argv, label):
        d = saved['deployment']
        assert ((argv[0] == d['nginx'] and argv[1:] in (['-V'], ['-T']))
                or (argv[0] == d['systemctl'] and argv[1] == 'show')
                or (argv[0] == d['ss'] and argv[1:] == ['-lntp'])
                or (argv[0] == d['runtime']['node'] and argv[1:] == ['--version']))
        result = subprocess.run(argv, capture_output=True, timeout=45, env={'PATH': '/usr/bin:/bin', 'LANG': 'C'})
        assert result.returncode == 0
        return result
    phase = 'ACCEPTED_RUNTIME_LINEAGE'
    facts = a.runtime_facts(saved, command)
    assert facts == applied['runtime']  # Includes accepted master/worker start identities.
    phase = 'CURRENT_PROTECTED_INDEX'
    dump = command([saved['deployment']['nginx'], '-T'], 'read-only-index').stdout
    files = a.loaded_inventory(saved, dump, source)
    policy = reads.read_policy()
    assert len(files) == 23 and len(policy['routes']) == 80 and sum(r['decision'] == 'allow' for r in policy['routes']) == 70
    phase = 'INDEPENDENT_PATCH_FINGERPRINT'
    candidate = patch(source.decode(), saved['deployment']['routing'], parser, reads.read_path_pattern, policy).encode()
    phase = 'FINAL_STABILITY'
    assert a.configurations(saved, applied['installed']) == before and a.runtime_facts(saved, command) == facts
    print(json.dumps(dict(result='PASS', inspection_revision=3, inspection_script_sha256=inspection_sha,
        scope='Products protected read-only fingerprint; NOT deployment approval', observed_at_utc=a.utc().isoformat(),
        accepted_apply_receipt_sha256=APPLY, main_sha256=H(source), main_bytes=len(source), loaded_configurations=len(files), unchanged_peers=22,
        accepted_workers_unchanged=True, proposed_products_candidate_sha256=H(candidate), proposed_products_candidate_bytes=len(candidate),
        independent_byte_preservation=True, approved_get_patterns=70, held_get_patterns=10,
        private_candidate_nginx_syntax='NOT_RUN', configuration_exported=False, explicit_file_writes=0, reloads=0, staging=0)))
except Exception:
    print(json.dumps(dict(result='BLOCKED', inspection_revision=3, failing_check=phase,
                         reason='Protected evidence mismatch or unavailable; no automatic retry', configuration_exported=False,
                         explicit_file_writes=0, reloads=0, staging=0)))
    sys.exit(1)
