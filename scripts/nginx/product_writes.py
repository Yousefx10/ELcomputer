"""Local-only Products upgrade of the accepted ADM-01-READS configuration.

No target access or apply/reload capability. A separately reviewed binding pins
the complete input; the caller must independently attest that input is current.
Nuxt Auth, named permissions and transactional SQL remain authoritative.
"""
import re

from config_parser import parse, walk
from dashboard_access import AUDIT_API, digest, read_path_pattern, read_policy, require, validate_binding


WRITES = (
    ('/api/admin-products', 'POST'),
    ('/api/admin-products/:id', 'PATCH'),
    ('/api/admin-products/bulk', 'POST'),
)
MARKER = '# PRODUCTS-WRITES-v1: three idempotent commands; Nuxt authorization required.'


def render_product_writes(original, binding):
    host, _ = validate_binding(binding)
    require(digest(original) == binding['source_sha256'], 'SOURCE_HASH_MISMATCH')
    require(original.count('# ADM-01-READS-v1:') == 1, 'ACCEPTED_READ_POLICY_REQUIRED')
    require('PRODUCTS-WRITES-v1' not in original, 'PRODUCT_WRITES_ALREADY_PRESENT')
    nodes = parse(original)
    prefix = '$' + binding['variable_prefix']
    read_variable, variable = prefix + '_read_method_denied', prefix + '_method_denied'
    maps = [n for n in nodes if n['name'] == 'map' and n['args'][-1] in (read_variable, variable)]
    read_map = 'map $request_method ' + read_variable + ' {\n    default 1;\n    ~^(GET|HEAD)$ 0;\n}'
    method_map = ('map "$host|$request_method|$request_uri" ' + variable + ' {\n'
                  '    default ' + read_variable + ';\n'
                  '    ~^' + re.escape(host) + '[|]POST[|]' + AUDIT_API + '$ 0;\n}')
    require(len(maps) == 2 and {original[n['start']:n['end']] for n in maps} == {read_map, method_map},
            'ACCEPTED_METHOD_MAP_DRIFT')
    fronts = [n for n in nodes if n['name'] == 'server' and any(
        c['name'] == 'server_name' and host in c['args'] for c in n['children'])]
    require(len(fronts) == 1, 'CANONICAL_FRONTEND_REQUIRED')
    front = fronts[0]
    require(sum(original[c['start']:c['end']] == 'if (' + variable + ' = 1) { return 405; }'
                for c in front['children']) == 1, 'ACCEPTED_SERVER_METHOD_GUARD')
    locations = [n for n in walk(front['children']) if n['name'] == 'location']
    policy = read_policy()
    allowed = [r for r in policy['routes'] if r['decision'] == 'allow']
    require(len(allowed) == 70 and len(policy['routes']) == 80, 'READ_POLICY_COUNT_DRIFT')

    def selector(path):
        return ['~', read_path_pattern(path)] if ':' in path else ['=', path]

    def one(path):
        found = [n for n in locations if n['args'] == selector(path)]
        require(len(found) == 1, 'ACCEPTED_LOCATION_MISSING_OR_DUPLICATE')
        return found[0]

    for row in policy['routes']:
        if row['decision'] == 'hold':
            require(not any(n['args'] == selector(row['path']) for n in locations), 'HELD_ROUTE_CONFLICT')
            continue
        node = one(row['path'])
        methods = row['methods'] + (['POST'] if row['path'] == AUDIT_API else [])
        require(sum(original[n['start']:n['end']] ==
                    'if ($request_method !~ ^(' + '|'.join(methods) + ')$) { return 405; }'
                    for n in node['children']) == 1, 'ACCEPTED_READ_METHOD_DRIFT')

    edits = []
    for path, method in WRITES:
        node = one(path)
        text = original[node['start']:node['end']]
        pattern = read_path_pattern(path)
        require('if ($host != ' + host + ') { return 403; }' in text
                and 'if ($request_uri !~ "' + pattern[:-1] + '([?].*)?$") { return 403; }' in text,
                'ACCEPTED_PATH_GUARD_DRIFT')
        children = list(walk(node['children']))
        require([n['args'] for n in children if n['name'] == 'proxy_pass'] == [[binding['runtime_upstream']]],
                'RUNTIME_UPSTREAM_DRIFT')
        require(not any(n['name'] in ('include', 'rewrite', 'try_files', 'location', 'error_page')
                        for n in children), 'UNEXPECTED_WRITE_ROUTING')
        for control in ('proxy_cache', 'proxy_store'):
            require([n['args'] for n in children if n['name'] == control] == [['off']], 'WRITE_CACHE_DRIFT')
        row = next(r for r in allowed if r['path'] == path)
        before = 'if ($request_method !~ ^(' + '|'.join(row['methods']) + ')$) { return 405; }'
        after = 'if ($request_method !~ ^(' + '|'.join(row['methods'] + [method]) + ')$) { return 405; }'
        require(text.count(before) == 1, 'ACCEPTED_WRITE_METHOD_DRIFT')
        guards = [n for n in node['children'] if original[n['start']:n['end']] == before]
        require(len(guards) == 1, 'ACCEPTED_WRITE_METHOD_NODE')
        edits.append((guards[0]['start'], guards[0]['end'], after))
        # Never retry a command through an upstream/fallback automatically.
        retries = [n for n in children if n['name'] == 'proxy_next_upstream']
        require(len(retries) <= 1, 'UPSTREAM_RETRY_DRIFT')
        if retries:
            edits.append((retries[0]['start'], retries[0]['end'], 'proxy_next_upstream off;'))
        else:
            edits.append((node['end'] - 1, node['end'] - 1, '\nproxy_next_upstream off;\n'))
    added_rules = ''.join('    "~^' + re.escape(host) + '[|]' + method + '[|]'
                          + read_path_pattern(path)[1:] + '" 0;\n' for path, method in WRITES)
    replacement = MARKER + '\n' + method_map[:-1] + added_rules + '}'
    map_node = next(n for n in maps if original[n['start']:n['end']] == method_map)
    edits.append((map_node['start'], map_node['end'], replacement))
    candidate = original
    for start, end, value in sorted(edits, reverse=True):
        candidate = candidate[:start] + value + candidate[end:]
    parse(candidate)
    return candidate, dict(result='PASS', source_sha256=digest(original), candidate_sha256=digest(candidate),
                           write_commands=[dict(path=p, method=m) for p, m in WRITES],
                           approved_get_patterns=70, held_get_patterns=10,
                           authentication_unchanged=True, automatic_upstream_retry=False,
                           production_changes=0, deployment_authorized=False)
