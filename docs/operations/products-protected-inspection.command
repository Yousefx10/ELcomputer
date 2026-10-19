# Paste this complete block into the existing VPS root console once.
# Read-only: no operator main, staging, backup, config export, apply or reload.
python3 -I -B - <<'PY'
import base64, copy, datetime, hashlib, http.client, json, os, re, shlex, stat, subprocess, sys, time, urllib.parse
from pathlib import Path

ROOT = Path('/root/adm01-activation-apply-fad66381d2851176')
MANIFEST = 'dc3bdec5e373c1a69246e1af383d7c4d6482bd79fe6925affa8be6e980b82fc7'
APPLY = '6a93dc6ad6929e2eb1e677613c1cb6a29b36df81acc00652eb942cdacd033372'
SOURCE = 'c859c080dcab025c6d7e614d77864905d034e8c50d6570eef95014d6f4574bb5'
H = lambda raw: hashlib.sha256(raw).hexdigest()

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
    raw = private('APPLY-RECEIPT.private.json'); assert H(raw) == APPLY
    applied = json.loads(raw)
    assert applied['result'] == 'INFRASTRUCTURE_PASS' and applied['mode'] == 'apply' and applied['worker_acceptance_confirmed'] is True
    source = saved['candidate']; assert H(source) == SOURCE and applied['installed']['sha256'] == SOURCE
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
    facts = a.runtime_facts(saved, command)
    assert facts == applied['runtime']  # Includes accepted master/worker start identities.
    dump = command([saved['deployment']['nginx'], '-T'], 'read-only-index').stdout
    files = a.loaded_inventory(saved, dump, source)
    policy = reads.read_policy()
    assert len(files) == 23 and len(policy['routes']) == 80 and sum(r['decision'] == 'allow' for r in policy['routes']) == 70
    candidate = patch(source.decode(), saved['deployment']['routing'], parser, reads.read_path_pattern, policy).encode()
    assert a.configurations(saved, applied['installed']) == before and a.runtime_facts(saved, command) == facts
    print(json.dumps(dict(result='PASS', inspection_revision=2, scope='Products protected read-only fingerprint; NOT deployment approval', observed_at_utc=a.utc().isoformat(),
        accepted_apply_receipt_sha256=APPLY, main_sha256=H(source), main_bytes=len(source), loaded_configurations=len(files), unchanged_peers=22,
        accepted_workers_unchanged=True, proposed_products_candidate_sha256=H(candidate), proposed_products_candidate_bytes=len(candidate),
        independent_byte_preservation=True, approved_get_patterns=70, held_get_patterns=10,
        private_candidate_nginx_syntax='NOT_RUN', configuration_exported=False, explicit_file_writes=0, reloads=0, staging=0)))
except Exception:
    print(json.dumps(dict(result='BLOCKED', inspection_revision=2, reason='Protected evidence mismatch or unavailable; no automatic retry', configuration_exported=False,
                         explicit_file_writes=0, reloads=0, staging=0)))
    sys.exit(1)
PY
