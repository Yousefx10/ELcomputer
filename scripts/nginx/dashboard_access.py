"""Pure, fail-closed ADM-01 renderer for the existing browse-only policy.

Deployment identity is supplied by a separately reviewed binding. The only file
read loads the colocated reviewed registry. No deployment I/O, writes, commands
or authentication decisions occur here. Nuxt/RLS remain authoritative.
"""
import hashlib
import fnmatch
import json
from pathlib import Path
import posixpath
import re
from urllib.parse import urlsplit

from config_parser import parse, walk

READ_APIS = (
    '/api/admin-erp/state',
    '/api/admin-dashboard/summary',
    '/api/admin-products/list',
    '/api/admin-products/filter-options',
    '/api/admin-inventory/items',
    '/api/admin-inventory/options',
    '/api/storefront/dashboard-appearance',
    '/api/_nuxt_icon/lucide.json',
)
AUDIT_API = '/api/admin-logs'
UUID_PATH = r'^/api/admin-products/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
METHOD_GUARD = 'if ($request_method !~ ^(GET|HEAD)$) { return 405; }'
PAGE_GUARD = 'if ($uri ~ "^/(?:ar/)?(?:dashboard|account|checkout|cart|login|signup|support|email)(?:/|$)") { return 403; }'
CUSTOMER_GUARD = PAGE_GUARD.replace('dashboard|', '')


def digest(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def require(value, code):
    if not value:
        raise ValueError(code)


def validate_binding(binding):
    require(set(binding) == {'format', 'site_origin', 'canonical_alias', 'variable_prefix',
                            'source_sha256', 'runtime_upstream'}, 'BINDING_KEYS')
    require(binding['format'] == 1, 'BINDING_VERSION')
    origin = urlsplit(binding['site_origin'])
    host = origin.hostname or ''
    require(origin.scheme == 'https' and origin.netloc == host and not origin.path
            and not origin.query and not origin.fragment and not origin.username,
            'HTTPS_ORIGIN_REQUIRED')
    host_pattern = r'(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?'
    require(re.fullmatch(host_pattern, host) and '..' not in host, 'CANONICAL_HOST')
    alias = binding['canonical_alias']
    require(isinstance(alias, str) and re.fullmatch(host_pattern, alias)
            and '..' not in alias and alias != host, 'CANONICAL_ALIAS')
    require(re.fullmatch(r'[a-z][a-z0-9_]{2,60}', binding['variable_prefix']), 'VARIABLE_PREFIX')
    require(re.fullmatch(r'[0-9a-f]{64}', binding['source_sha256']), 'SOURCE_HASH_FORMAT')
    require(re.fullmatch(r'http://127\.0\.0\.1:[1-9][0-9]{0,4}', binding['runtime_upstream'])
            and int(binding['runtime_upstream'].rsplit(':', 1)[1]) <= 65535,
            'LOOPBACK_UPSTREAM_REQUIRED')
    return host, alias


def render(original, binding, inherited_add_headers=None):
    host, alias = validate_binding(binding)
    require(digest(original) == binding['source_sha256'], 'SOURCE_HASH_MISMATCH')
    variable = '$' + binding['variable_prefix'] + '_method_denied'
    read_variable = '$' + binding['variable_prefix'] + '_read_method_denied'
    require('$' + binding['variable_prefix'] + '_' not in original, 'VARIABLE_COLLISION')
    nodes = parse(original)
    servers = [node for node in nodes if node['name'] == 'server']
    fronts = []
    edits = []
    for server in servers:
        methods = [c for c in server['children'] if original[c['start']:c['end']] == METHOD_GUARD]
        if not methods:
            continue
        require(len(methods) == 1, 'METHOD_GUARD_COUNT')
        names = [c for c in server['children'] if c['name'] == 'server_name']
        require(len(names) == 1, 'SERVER_IDENTITY')
        public_names = set(names[0]['args']).intersection({host, alias})
        require(len(public_names) == 1, 'FRONTEND_IDENTITY')
        pages = [c for c in server['children'] if original[c['start']:c['end']] == PAGE_GUARD]
        require(len(pages) == 1, 'PAGE_GUARD_COUNT')
        edits += [(methods[0]['start'], methods[0]['end'],
                   'if (' + variable + ' = 1) { return 405; }'),
                  (pages[0]['start'], pages[0]['end'], CUSTOMER_GUARD)]
        fronts.append((server, public_names.pop()))
    require(len(fronts) == 2 and {name for _, name in fronts} == {host, alias}, 'FRONTEND_COUNT')
    front = next(server for server, name in fronts if name == host)
    roots = [c for c in front['children'] if c['name'] == 'location' and c['args'] == ['/']]
    require(len(roots) == 1, 'ROOT_LOCATION')
    root = roots[0]
    require(all(c['name'] not in {'include', 'rewrite', 'try_files', 'return', 'location',
                                'fastcgi_pass', 'uwsgi_pass', 'scgi_pass', 'grpc_pass'}
                for c in walk(root['children'])), 'UNEXPECTED_ROOT_ROUTING')
    proxies = [c for c in walk(root['children']) if c['name'] == 'proxy_pass']
    require(len(proxies) == 1 and proxies[0]['args'] == [binding['runtime_upstream']], 'RUNTIME_UPSTREAM')
    for directive in ('proxy_cache', 'proxy_store'):
        require([c['args'] for c in root['children'] if c['name'] == directive] == [['off']],
                'ROOT_CACHE_POLICY')
    denies = [c for c in front['children'] if c['name'] == 'location' and c['args'] == ['^~', '/api/']]
    require(len(denies) == 1 and len(denies[0]['children']) == 1
            and denies[0]['children'][0]['name'] == 'return'
            and denies[0]['children'][0]['args'] == ['403'], 'API_DENY_POLICY')
    additions = set(READ_APIS) | {AUDIT_API, '/dashboard', '/dashboard/', '/ar/dashboard', '/ar/dashboard/'}
    for c in front['children']:
        if c['name'] != 'location' or c in (root, denies[0]):
            continue
        args = c['args']
        require(not (args and args[-1] in additions), 'EXISTING_ROUTE_CONFLICT')
        # A pre-existing narrower API selector must never silently lose priority.
        require(not (args and args[0] not in ('~', '~*')
                     and args[-1].startswith('/api/admin-')), 'EXISTING_ADMIN_ROUTE_CONFLICT')

    # Adding a location-level header otherwise suppresses inherited security
    # headers in older Nginx. Copy the effective original header set first.
    headers = [original[c['start']:c['end']] for c in root['children'] if c['name'] == 'add_header']
    if not headers:
        headers = (list(inherited_add_headers) if inherited_add_headers is not None else
                   [original[c['start']:c['end']] for c in front['children'] if c['name'] == 'add_header'])
        for header in headers:
            parsed = parse(header)
            require(len(parsed) == 1 and parsed[0]['name'] == 'add_header'
                    and not parsed[0]['children'], 'INHERITED_HEADER_DIRECTIVE')
        inherited = '\n'.join(headers)
    else:
        inherited = ''  # Already in the copied root body.
    body = original[root['body_start']:root['end'] - 1]
    require(not any(c['name'] == 'proxy_hide_header' and c['args'] == ['Cache-Control']
                    for c in root['children']), 'CACHE_HEADER_CONFLICT')
    body += '\n' + inherited + '\nproxy_hide_header Cache-Control;\n'
    body += 'add_header Cache-Control "private, no-store" always;\n'

    def location(selector, methods):
        # macOS Nginx compares prefix/exact locations without case. Keep API
        # reachability identical to Linux rather than relying on that behavior.
        exact_path = selector[2:] if selector.startswith('= /api/') else None
        path_guard = ('if ($uri != ' + exact_path + ') { return 403; }\n') if exact_path else ''
        # Preserve any opaque server_name aliases without giving them new admin
        # access. The reviewed canonical alias redirects before location lookup.
        host_guard = 'if ($host != ' + host + ') { return 403; }\n'
        return '\nlocation ' + selector + ' {\n' + host_guard + path_guard + 'if ($request_method !~ ^(' + methods + ')$) { return 405; }\n' + body + '\n}\n'

    new = ''.join(location('= ' + path, 'GET|HEAD') for path in READ_APIS)
    new += location('= ' + AUDIT_API, 'POST')
    # Ordinary prefixes preserve existing regex security locations (hidden-file
    # denials, for example). Exact login/API paths never become filesystem reads.
    for selector in ('= /dashboard', '/dashboard/', '= /ar/dashboard', '/ar/dashboard/'):
        new += location(selector, 'GET|HEAD')
    # The nested regex is evaluated inside the existing ^~ /api/ prefix. A
    # top-level regex would be skipped by that prefix. Every other API stays 403.
    deny = '\nlocation ^~ /api/ {\n' + location('~ "' + UUID_PATH + '"', 'GET|HEAD') + '\nreturn 403;\n}\n'
    edits.append((denies[0]['start'], denies[0]['end'], deny))
    edits.append((front['body_start'], front['body_start'], '\n# ADM-01: existing authenticated dashboard only.\n' + new))
    method_map = ('# ADM-01: classify the method independently of untrusted Host/URI.\n'
                  'map $request_method ' + read_variable + ' {\n'
                  '    default 1;\n'
                  '    ~^(GET|HEAD)$ 0;\n}\n'
                  '# Exact canonical-host login audit is the sole mutation exception.\n'
                  'map "$host|$request_method|$request_uri" ' + variable + ' {\n'
                  '    default ' + read_variable + ';\n'
                  '    ~^' + re.escape(host) + '[|]POST[|]' + AUDIT_API + '$ 0;\n}\n')
    edits.append((0, 0, method_map))
    candidate = original
    for begin, end, value in sorted(edits, key=lambda item: item[0], reverse=True):
        candidate = candidate[:begin] + value + candidate[end:]
    parse(candidate)
    # Removing exactly the replacements/additions reproduces the old bytes.
    # Every other server, TLS control, SEO map and public location is untouched.
    return candidate, dict(result='PASS', source_sha256=digest(original),
                           candidate_sha256=digest(candidate),
                           canonical_origin=binding['site_origin'],
                           read_api_paths=list(READ_APIS), uuid_product_detail=True,
                           only_write_exception='POST ' + AUDIT_API,
                           application_authentication_unchanged=True,
                           runtime_rebuild_required=False, production_changes=0)


def read_policy():
    """Load only the colocated reviewed platform registry, never deployment data."""
    policy = json.loads(Path(__file__).with_name('dashboard_read_policy.json').read_text())
    require(policy['version'] == 1, 'READ_POLICY_VERSION')
    paths = [row['path'] for row in policy['routes']]
    require(len(paths) == len(set(paths)), 'READ_POLICY_DUPLICATE')
    for row in policy['routes']:
        require(row['handler_method'] == 'GET', 'READ_POLICY_HANDLER_METHOD')
        require(re.fullmatch(r'/api/(?:[a-z-]+|:id|:sessionId|:token)(?:/(?:[a-z-]+|:id|:sessionId|:token))*', row['path']), 'READ_POLICY_PATH')
        require(row['decision'] in ('allow', 'hold'), 'READ_POLICY_DECISION')
        require(row['methods'] in (['GET'], ['GET', 'HEAD']) if row['decision'] == 'allow' else row['methods'] == [], 'READ_POLICY_METHODS')
        require(row['decision'] != 'allow' or row['side_effects'] == 'none', 'READ_POLICY_EFFECTS')
        require(row['decision'] != 'allow' or ':token' not in row['path'], 'READ_POLICY_PARAMETER')
    return policy


def read_path_pattern(path):
    """Only explicit UUID parameters; no catchall or arbitrary suffix."""
    return '^' + '/'.join(
        '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
        if part in (':id', ':sessionId') else re.escape(part)
        for part in path.split('/')) + '$'


def effective_context(configuration):
    """Expand only authenticated snapshot bytes, never live include paths."""
    require(configuration is not None, 'AUXILIARY_CONTEXT_REQUIRED')
    files = configuration['files']
    require({digest(p): digest(text) for p, text in files.items()} == configuration['approved_files'], 'AUXILIARY_CONTEXT_DRIFT')
    entry, main, prefix = (configuration[k] for k in ('entry', 'main', 'prefix'))
    require(all(p.startswith('/') and posixpath.normpath(p) == p for p in files)
            and prefix.startswith('/'), 'AUXILIARY_CONTEXT_PATH')
    parsed = {p: parse(text) for p, text in files.items()}
    def direct(nodes, origin, stack):
        for node in nodes:
            if node['name'] != 'include':
                yield node, origin, stack
                continue
            require(len(node['args']) == 1 and not any(c in node['args'][0] for c in '$\\{}\x00'), 'AUXILIARY_INCLUDE')
            pattern = posixpath.normpath(posixpath.join(prefix, node['args'][0]))
            def matches(path):
                a, b = pattern.split('/'), path.split('/')
                return len(a) == len(b) and all(fnmatch.fnmatchcase(n, p) and
                    (not n.startswith('.') or p.startswith('.')) for p, n in zip(a, b))
            names = sorted(p for p in files if matches(p))
            require(names or any(c in pattern for c in '*?['), 'AUXILIARY_INCLUDE_MISSING')
            for path in names:
                require(path not in stack and len(stack) < 32, 'AUXILIARY_INCLUDE_CYCLE')
                yield from direct(parsed[path], path, stack + (path,))
    def tree(nodes, origin, stack):
        return [dict(n, children=tree(n['children'], p, trail)) for n, p, trail in direct(nodes, origin, stack)]
    http = [n for n in parsed[entry] if n['name'] == 'http']
    require(len(http) == 1, 'AUXILIARY_HTTP_CONTEXT')
    return files, main, list(direct(http[0]['children'], entry, (entry,))), tree


def listener_port(node):
    require(node['args'] and re.fullmatch(r'(?:[0-9]+|(?:\[[0-9a-fA-F:]+\]|[0-9.]+|\*):[0-9]+)', node['args'][0]), 'LISTENER_BINDING')
    port = int(node['args'][0].rsplit(':', 1)[-1])
    require(0 < port <= 65535, 'LISTENER_BINDING')
    return port


def read_server_roles(original, nodes, binding, contract, configuration):
    """Select structural frontend roles; exclude only a pinned terminal server."""
    host, alias = validate_binding(binding)
    if contract is not None:
        require(set(contract) == {'format', 'frontend_ports', 'auxiliary'} and contract['format'] == 1
                and contract['frontend_ports'] and all(type(p) is int and 0 < p <= 65535 for p in contract['frontend_ports'])
                and len(set(contract['frontend_ports'])) == len(contract['frontend_ports'])
                and len(contract['auxiliary']) == 1, 'AUXILIARY_CONTRACT')
    fronts, auxiliaries = [], []
    for node in nodes:
        if node['name'] != 'server':
            continue
        names = [c['args'] for c in node['children'] if c['name'] == 'server_name']
        require(len(names) == 1, 'SERVER_IDENTITY')
        identity = set(names[0]).intersection({host, alias})
        if not identity:
            continue
        require(len(identity) == 1, 'FRONTEND_IDENTITY')
        name = next(iter(identity))
        roots = [c for c in node['children'] if c['name'] == 'location' and c['args'] == ['/']]
        canonical = name == host and len(roots) == 1 and [c['args'] for c in walk(roots[0]['children'])
                    if c['name'] == 'proxy_pass'] == [[binding['runtime_upstream']]]
        redirect = name == alias and not roots and [c['args'] for c in node['children']
                    if c['name'] == 'return'] == [['301', 'https://' + host + '$request_uri']]
        if canonical or redirect:
            listeners = [c for c in node['children'] if c['name'] == 'listen']
            require(listeners and (contract is None or {listener_port(c) for c in listeners}
                    == set(contract['frontend_ports'])), 'FRONTEND_LISTENERS')
            for text in (CUSTOMER_GUARD, 'if ($' + binding['variable_prefix'] + '_method_denied = 1) { return 405; }'):
                require(sum(original[c['start']:c['end']] == text for c in node['children']) == 1, 'ACCEPTED_GUARD_DRIFT')
            fronts.append((node, name))
            continue
        require(name == host and contract is not None and not roots, 'UNCLASSIFIED_SAME_HOST_SERVER')
        expected = contract['auxiliary'][0]
        require(set(expected) == {'block_sha256', 'port', 'locations', 'fastcgi_passes'}
                and re.fullmatch(r'[0-9a-f]{64}', expected['block_sha256'])
                and type(expected['port']) is int and 0 < expected['port'] <= 65535
                and expected['port'] not in contract['frontend_ports']
                and expected['locations'] == 2 and expected['fastcgi_passes'] == 1, 'AUXILIARY_CONTRACT')
        require(digest(original[node['start']:node['end']]) == expected['block_sha256'], 'AUXILIARY_BLOCK_DRIFT')
        files, main, http, tree = effective_context(configuration)
        require(files[main] == original and sum(p == main and n['start'] == node['start']
                and n['name'] == 'server' for n, p, _ in http) == 1, 'AUXILIARY_CONTEXT_BINDING')
        related = [(n, p) for n, p, _ in http if n['name'] == 'server' and any(
            c['name'] == 'server_name' and set(c['args']).intersection({host, alias}) for c in n['children'])]
        require(len(related) == 3 and all(p == main for _, p in related), 'AUXILIARY_CONTEXT_BINDING')
        children = tree(node['children'], main, (configuration['entry'], main))
        require(not any(n['name'] in {'error_page', 'recursive_error_pages'}
                for n in children + [n for n, _, _ in http]), 'AUXILIARY_ERROR_HANDLING')
        actions = [n for n in children if n['name'] in {'return', 'rewrite', 'if', 'set', 'break'}]
        require(actions and actions[0]['name'] == 'return' and actions[0]['args'] == ['404']
                and actions[0]['body_start'] is None, 'AUXILIARY_TERMINAL_RETURN')
        listeners = [n for n in children if n['name'] == 'listen']
        port = str(expected['port'])
        require(len(listeners) == 2 and {listener_port(n) for n in listeners} == {expected['port']}
                and sum(n['args'][0] in (port, '*:' + port, '0.0.0.0:' + port) for n in listeners) == 1
                and sum(n['args'][0] == '[::]:' + port for n in listeners) == 1
                and all(len(n['args']) == 1 for n in listeners), 'AUXILIARY_LISTENERS')
        descendants = list(walk(children))
        locations = [n for n in descendants if n['name'] == 'location']
        require(len(locations) == expected['locations'] and all(n['args'] != ['/'] for n in locations), 'AUXILIARY_LOCATIONS')
        handlers = [n for n in descendants if n['name'].endswith('_pass') or n['name'] in {'auth_request', 'mirror', 'perl'}
                    or n['name'].startswith(('js_', 'lua_')) or '_lua' in n['name']]
        require(len(handlers) == expected['fastcgi_passes'] and all(n['name'] == 'fastcgi_pass'
                and len(n['args']) == 1 and re.fullmatch(r'(?:127\.0\.0\.1|\[::1\]):[1-9][0-9]{0,4}', n['args'][0])
                and int(n['args'][0].rsplit(':', 1)[-1]) <= 65535
                and 'http://' + n['args'][0] != binding['runtime_upstream'] for n in handlers), 'AUXILIARY_HANDLERS')
        auxiliaries.append(node)
    require(len(fronts) == 2 and {name for _, name in fronts} == {host, alias}, 'FRONTEND_COUNT')
    require(len(auxiliaries) == (1 if contract is not None else 0), 'AUXILIARY_COUNT')
    return fronts, auxiliaries


def render_reads(original, binding, inherited_add_headers=None, auxiliary_contract=None, configuration=None):
    """Upgrade CURRENT accepted ADM-01 bytes, never a historical launch preimage.

    Existing routes, proxy controls and method maps must match the accepted
    narrow policy. Only API location spans are replaced; dashboards, aliases,
    TLS, SEO, other sites and method maps remain byte-identical. Exact loaded
    peer identities and full shadow syntax are separate deployment gates.
    """
    host, alias = validate_binding(binding)
    require(digest(original) == binding['source_sha256'], 'SOURCE_HASH_MISMATCH')
    require('# ADM-01-READS-v1' not in original, 'READ_POLICY_ALREADY_PRESENT')
    nodes = parse(original)
    fronts, auxiliaries = read_server_roles(original, nodes, binding, auxiliary_contract, configuration)
    prefix = '$' + binding['variable_prefix']
    maps = [c for c in nodes if c['name'] == 'map' and c['args'][-1] in (prefix + '_read_method_denied', prefix + '_method_denied')]
    require(len(maps) == 2, 'ACCEPTED_METHOD_MAPS')
    expected_maps = [
        'map $request_method ' + prefix + '_read_method_denied {\n    default 1;\n    ~^(GET|HEAD)$ 0;\n}',
        'map "$host|$request_method|$request_uri" ' + prefix + '_method_denied {\n    default ' + prefix + '_read_method_denied;\n    ~^' + re.escape(host) + '[|]POST[|]' + AUDIT_API + '$ 0;\n}']
    require(sorted(original[c['start']:c['end']] for c in maps) == sorted(expected_maps), 'ACCEPTED_METHOD_MAP_DRIFT')
    front = next(node for node, name in fronts if name == host)
    locations = [c for c in front['children'] if c['name'] == 'location']
    def one(args):
        matches = [c for c in locations if c['args'] == args]
        require(len(matches) == 1, 'ACCEPTED_LOCATION_MISSING_OR_DUPLICATE')
        return matches[0]
    root = one(['/'])
    require(all(c['name'] not in {'include', 'rewrite', 'try_files', 'return', 'location', 'fastcgi_pass', 'uwsgi_pass', 'scgi_pass', 'grpc_pass'} for c in walk(root['children'])), 'UNEXPECTED_ROOT_ROUTING')
    require([c['args'] for c in walk(root['children']) if c['name'] == 'proxy_pass'] == [[binding['runtime_upstream']]], 'RUNTIME_UPSTREAM')
    for name in ('proxy_cache', 'proxy_store'):
        require([c['args'] for c in root['children'] if c['name'] == name] == [['off']], 'ROOT_CACHE_POLICY')
    sample = one(['=', READ_APIS[0]])
    def guards(path, methods):
        return ('if ($host != ' + host + ') { return 403; }\n'
                + ('if ($uri != ' + path + ') { return 403; }\n' if path else '')
                + 'if ($request_method !~ ^(' + methods + ')$) { return 405; }\n')
    sample_body = original[sample['body_start']:sample['end'] - 1]
    expected = '\n' + guards(READ_APIS[0], 'GET|HEAD')
    require(sample_body.startswith(expected), 'ACCEPTED_PROXY_GUARDS')
    body = sample_body[len(expected):]
    # Preserve the accepted controls, including effective inherited headers and
    # root ACLs. Check they are still an exact extension of the current root.
    root_body = original[root['body_start']:root['end'] - 1]
    require(body.startswith(root_body) and body.endswith('\n'), 'ACCEPTED_PROXY_BODY')
    suffix = parse(body[len(root_body):])
    root_headers = [c for c in root['children'] if c['name'] == 'add_header']
    effective_headers = [c for c in front['children'] if c['name'] == 'add_header']
    expected_suffix = ([] if root_headers else list(inherited_add_headers) if inherited_add_headers is not None
                       else [original[c['start']:c['end']] for c in effective_headers])
    for header in expected_suffix:
        parsed = parse(header)
        require(len(parsed) == 1 and parsed[0]['name'] == 'add_header' and not parsed[0]['children'], 'INHERITED_HEADER_DIRECTIVE')
    expected_suffix += ['proxy_hide_header Cache-Control;', 'add_header Cache-Control "private, no-store" always;']
    require([body[len(root_body):][c['start']:c['end']] for c in suffix] == expected_suffix, 'ACCEPTED_HEADERS_DRIFT')
    edits = []
    for path in READ_APIS + (AUDIT_API,):
        node = one(['=', path])
        require(original[node['body_start']:node['end'] - 1] == '\n' + guards(path, 'POST' if path == AUDIT_API else 'GET|HEAD') + body, 'ACCEPTED_ROUTE_DRIFT')
        edits.append((node['start'], node['end'], ''))
    deny = one(['^~', '/api/'])
    nested = deny['children']
    require(len(nested) == 2 and nested[0]['name'] == 'location' and nested[0]['args'] == ['~', UUID_PATH]
            and nested[1]['name'] == 'return' and nested[1]['args'] == ['403'], 'ACCEPTED_API_DENY_DRIFT')
    require(original[nested[0]['body_start']:nested[0]['end'] - 1] == '\n' + guards(None, 'GET|HEAD') + body, 'ACCEPTED_UUID_DRIFT')
    removed = {begin for begin, _, _ in edits} | {deny['start']}
    for node in walk([n for n in nodes if n not in auxiliaries]):
        if node['name'] != 'location' or not node['args'] or node['start'] in removed or node is nested[0]:
            continue
        selector = node['args'][-1]
        # Unexpected admin/customer selectors anywhere must be reviewed first.
        require('api/admin-' not in selector and 'api/customer-users' not in selector, 'EXISTING_ADMIN_ROUTE_CONFLICT')
    policy = read_policy()
    allowed = [r for r in policy['routes'] if r['decision'] == 'allow']
    def location(path, methods):
        pattern = read_path_pattern(path)
        dynamic = ':' in path
        selector = '~ "' + pattern + '"' if dynamic else '= ' + path
        # Match raw paths as well as Nginx's normalized URI. Encodings, dot
        # segments and doubled slashes never become alternative API entries.
        raw_guard = 'if ($request_uri !~ "' + pattern[:-1] + '([?].*)?$") { return 403; }\n'
        return '\nlocation ' + selector + ' {\n' + guards(None if dynamic else path, methods) + raw_guard + body + '}\n'
    exact = ''.join(location(r['path'], '|'.join(r['methods'] + (['POST'] if r['path'] == AUDIT_API else []))) for r in allowed if ':' not in r['path'])
    exact += ''.join(location(path, 'GET|HEAD') for path in READ_APIS if not path.startswith('/api/admin-'))
    dynamic = ''.join(location(r['path'], '|'.join(r['methods'])) for r in allowed if ':' in r['path'])
    edits.append((deny['start'], deny['end'], '\nlocation ^~ /api/ {\n' + dynamic + '\nreturn 403;\n}\n'))
    edits.append((front['body_start'], front['body_start'], '\n# ADM-01-READS-v1: explicit reads; Nuxt authorization required.\n' + exact))
    candidate = original
    for begin, end, replacement in sorted(edits, key=lambda edit: edit[0], reverse=True):
        candidate = candidate[:begin] + replacement + candidate[end:]
    parse(candidate)
    for auxiliary in auxiliaries:
        require(original[auxiliary['start']:auxiliary['end']] in candidate, 'AUXILIARY_BYTES_CHANGED')
    return candidate, dict(result='PASS', source_sha256=digest(original), candidate_sha256=digest(candidate),
                           policy_sha256=digest(json.dumps(policy, sort_keys=True)), policy_version=policy['version'],
                           approved_reads=len(allowed), held_reads=len(policy['routes']) - len(allowed),
                           canonical_origin=binding['site_origin'], only_write_exception='POST ' + AUDIT_API,
                           application_authentication_unchanged=True, runtime_rebuild_required=False, production_changes=0)
